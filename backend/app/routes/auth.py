from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.database.connection import get_db
from app.schemas.auth import RegisterRequest, TokenResponse
from app.utils.auth import hash_password, verify_password
from app.utils.dependencies import get_current_user
from app.utils.jwt import create_access_token

router = APIRouter(tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(data: RegisterRequest):
    users_col = get_db().users_col

    existing_user = await users_col.find_one({"email": data.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user_id = str(uuid.uuid4())
    user_doc = {
        "_id": user_id,
        "name": data.name,
        "email": data.email,
        "password": hash_password(data.password),
        "role": data.role,
        "created_at": datetime.now(timezone.utc),
    }

    await users_col.insert_one(user_doc)

    access_token = create_access_token({"sub": user_id, "email": data.email})
    return TokenResponse(
        access_token=access_token,
        user_id=user_id,
        name=data.name,
        email=data.email,
        role=data.role,
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: OAuth2PasswordRequestForm = Depends()):
    users_col = get_db().users_col
    user = await users_col.find_one({"email": data.username})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    hashed_password = user.get("password")
    if not hashed_password or not verify_password(data.password, hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token({"sub": user["_id"], "email": user["email"]})
    return TokenResponse(
        access_token=access_token,
        user_id=user["_id"],
        name=user["name"],
        email=user["email"],
        role=user["role"],
    )


@router.get("/me")
async def read_current_user(current_user: dict = Depends(get_current_user)):
    return current_user
