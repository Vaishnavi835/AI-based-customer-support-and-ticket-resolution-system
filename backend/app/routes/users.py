from fastapi import APIRouter, HTTPException
from app.schemas.user import UserCreate
from app.database.connection import get_db
from datetime import datetime, timezone
import uuid

router = APIRouter(tags=["users"])


@router.post("/")
async def create_user(user: UserCreate):
    col = get_db().users_col
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
async def list_users():
    col = get_db().users_col
    users = await col.find({}).to_list(100)
    for u in users:
        u["id"] = u.pop("_id")
    return users


@router.get("/{user_id}")
async def get_user(user_id: str):
    col = get_db().users_col
    user = await col.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user["id"] = user.pop("_id")
    return user