from fastapi import APIRouter, HTTPException, Depends
from app.schemas.user import UserCreate
from app.database.connection import get_db
from app.utils.dependencies import get_current_user, require_role
from app.utils.roles import Role
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