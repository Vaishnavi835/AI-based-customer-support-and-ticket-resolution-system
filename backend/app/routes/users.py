from fastapi import APIRouter, HTTPException, Depends
from app.schemas.user import UserCreate, UserUpdateRole, DepartmentUpdate, ProfileUpdate, PasswordUpdate
from app.database.connection import get_db
from app.utils.dependencies import get_current_user, require_role
from app.utils.roles import Role
from app.utils.auth import hash_password, verify_password
from datetime import datetime, timezone
import uuid

router = APIRouter(tags=["users"])


@router.post("/")
async def create_user(user: UserCreate):
    """Public route — create user without auth (used for testing only).
    In production, use /auth/register instead."""
    col      = get_db().users_col
    existing = await col.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "_id":        str(uuid.uuid4()),
        "name":       user.name,
        "email":      user.email,
        "role":       user.role,
        "created_at": datetime.now(timezone.utc),
    }
    await col.insert_one(doc)
    return {"message": "User created", "id": doc["_id"]}


@router.get("/")
async def list_users(
    current_user: dict = Depends(require_role(Role.admin, Role.support_agent)),
):
    """Only Admin and Support Agent can list all users."""
    col   = get_db().users_col
    users = await col.find({}).to_list(100)
    for u in users:
        u.pop("password", None)
        u["id"] = u.pop("_id")
    return users


@router.get("/me")
async def get_my_profile(
    current_user: dict = Depends(get_current_user),
):
    """Any authenticated user can view their own profile."""
    return current_user


@router.get("/{user_id}")
async def get_user(
    user_id: str,
    current_user: dict = Depends(require_role(Role.admin, Role.support_agent)),
):
    """Only Admin and Support Agent can look up any user by ID."""
    col  = get_db().users_col
    user = await col.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.pop("password", None)
    user["id"] = user.pop("_id")
    return user


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    current_user: dict = Depends(require_role(Role.admin)),
):
    """Only Admin can delete users."""
    col    = get_db().users_col
    result = await col.delete_one({"_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}


@router.patch("/{user_id}")
async def update_user_role(
    user_id: str,
    data: UserUpdateRole,
    current_user: dict = Depends(require_role(Role.admin)),
):
    """Only Admin can update a user's role."""
    col    = get_db().users_col
    result = await col.update_one({"_id": user_id}, {"$set": {"role": data.role}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User role updated successfully"}


@router.patch("/{user_id}/department")
async def update_user_department(
    user_id: str,
    data: DepartmentUpdate,
    current_user: dict = Depends(require_role(Role.admin)),
):
    """Admin-only: Set the department for a support agent."""
    col  = get_db().users_col
    user = await col.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") not in ["support_agent", "admin"]:
        raise HTTPException(
            status_code=400,
            detail="Department can only be set on support agents or admins."
        )
    await col.update_one({"_id": user_id}, {"$set": {"department": data.department}})
    return {"message": "Department updated successfully", "department": data.department}


@router.patch("/me/profile")
async def update_my_profile(
    data: ProfileUpdate,
    current_user: dict = Depends(get_current_user),
):
    col = get_db().users_col
    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name.strip()
    if data.email is not None:
        email_clean = data.email.strip().lower()
        if email_clean != current_user["email"]:
            existing = await col.find_one({"email": email_clean})
            if existing:
                raise HTTPException(status_code=400, detail="Email already registered")
        update_data["email"] = email_clean
    
    if not update_data:
        return {"message": "No changes made"}
        
    await col.update_one({"_id": current_user["_id"]}, {"$set": update_data})
    return {"message": "Profile updated successfully"}


@router.patch("/me/password")
async def update_my_password(
    data: PasswordUpdate,
    current_user: dict = Depends(get_current_user),
):
    col = get_db().users_col
    user = await col.find_one({"_id": current_user["_id"]})
    if not user or not verify_password(data.current_password, user.get("password", "")):
        raise HTTPException(status_code=400, detail="Invalid current password")
    
    hashed = hash_password(data.new_password)
    await col.update_one({"_id": current_user["_id"]}, {"$set": {"password": hashed}})
    return {"message": "Password updated successfully"}


@router.delete("/me")
async def delete_my_account(
    current_user: dict = Depends(get_current_user),
):
    col = get_db().users_col
    await col.delete_one({"_id": current_user["_id"]})
    return {"message": "Account deleted successfully"}
