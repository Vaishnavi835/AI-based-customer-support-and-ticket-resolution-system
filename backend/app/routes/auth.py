from datetime import datetime, timezone, timedelta
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.database.connection import get_db
from app.schemas.auth import RegisterRequest, TokenResponse
from app.utils.auth import hash_password, verify_password
from app.utils.dependencies import get_current_user
from app.utils.jwt import create_access_token
from app.utils.roles import Role

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
    role = data.role
    user_doc = {
        "_id": user_id,
        "name": data.name,
        "email": data.email,
        "password": hash_password(data.password),
        "role": role,
        "created_at": datetime.now(timezone.utc),
    }

    await users_col.insert_one(user_doc)

    access_token = create_access_token({"sub": user_id, "email": data.email})
    return TokenResponse(
        access_token=access_token,
        user_id=user_id,
        name=data.name,
        email=data.email,
        role=role,
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: OAuth2PasswordRequestForm = Depends()):
    users_col = get_db().users_col
    user = await users_col.find_one({"email": data.username})

    # Note: To avoid email enumeration (letting attackers guess valid emails),
    # we return "Invalid email or password" unless the account is locked out.
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # 1. Check if the account is currently locked out
    lockout_until = user.get("lockout_until")
    if lockout_until:
        # Ensure the datetime is timezone aware
        if lockout_until.tzinfo is None:
            lockout_until = lockout_until.replace(tzinfo=timezone.utc)
        
        now = datetime.now(timezone.utc)
        if now < lockout_until:
            time_remaining = lockout_until - now
            minutes_left = int(time_remaining.total_seconds() / 60) + 1
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account is temporarily locked. Try again in {minutes_left} minutes.",
            )

    # 2. Check the password
    hashed_password = user.get("password")
    if not hashed_password or not verify_password(data.password, hashed_password):
        # Incorrect password: increment failed attempts count
        attempts = user.get("failed_login_attempts", 0) + 1
        update_fields = {"failed_login_attempts": attempts}

        # Lock account if failed attempts reach 5
        if attempts >= 5:
            lockout_time = datetime.now(timezone.utc) + timedelta(minutes=15)
            update_fields["lockout_until"] = lockout_time
            await users_col.update_one({"_id": user["_id"]}, {"$set": update_fields})
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is temporarily locked due to multiple failed login attempts. Try again in 15 minutes.",
            )
        else:
            await users_col.update_one({"_id": user["_id"]}, {"$set": update_fields})
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

    # 3. Successful login: reset attempts and lockout timers
    if user.get("failed_login_attempts", 0) > 0 or user.get("lockout_until"):
        await users_col.update_one(
            {"_id": user["_id"]},
            {"$set": {"failed_login_attempts": 0, "lockout_until": None}}
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
