from datetime import datetime, timezone, timedelta
import uuid
import inspect

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm

from app.database.connection import get_db
from app.schemas.auth import RegisterRequest, TokenResponse
from app.utils.auth import hash_password, verify_password
from app.utils.dependencies import get_current_user
from app.utils.jwt import create_access_token, revoke_token, verify_access_token
from app.utils.roles import Role
from fastapi.security import OAuth2PasswordBearer
from app.utils.rate_limiter import limiter

router = APIRouter(tags=["auth"])


def parse_user_agent(ua: str) -> tuple[str, str]:
    if not ua:
        return "Unknown Device", "Unknown Browser"
    ua_lower = ua.lower()
    
    # Determine Browser
    if "edg" in ua_lower:
        browser = "Microsoft Edge"
    elif "chrome" in ua_lower and "safari" in ua_lower:
        browser = "Chrome Browser"
    elif "firefox" in ua_lower:
        browser = "Firefox Browser"
    elif "safari" in ua_lower and "chrome" not in ua_lower:
        browser = "Safari Browser"
    else:
        browser = "Web Browser"

    # Determine Device
    if "android" in ua_lower:
        device = "Android Phone"
    elif "iphone" in ua_lower or "ipad" in ua_lower:
        device = "iOS Device"
    elif "macintosh" in ua_lower:
        device = "Mac Computer"
    elif "windows" in ua_lower:
        device = "Windows PC"
    elif "linux" in ua_lower:
        device = "Linux Machine"
    else:
        device = "Unknown Device"
        
    return device, browser


async def _await_if_coro(res):
    if inspect.isawaitable(res):
        return await res
    return res


# Fix #6: Rate limit — 3 registrations per minute per IP
@router.post("/register", response_model=TokenResponse)
@limiter.limit("3/minute")
async def register(request: Request, data: RegisterRequest):
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

    session_id = str(uuid.uuid4())
    access_token = create_access_token({"sub": user_id, "email": data.email, "sid": session_id})
    
    # Save active session
    ua = request.headers.get("user-agent", "")
    device, browser = parse_user_agent(ua)
    session_doc = {
        "_id": session_id,
        "user_id": user_id,
        "device": device,
        "browser": browser,
        "ip_address": request.client.host if request.client else "127.0.0.1",
        "last_active": datetime.now(timezone.utc),
        "token": access_token
    }
    sessions_col = get_db().db["sessions"]
    await _await_if_coro(sessions_col.insert_one(session_doc))

    return TokenResponse(
        access_token=access_token,
        user_id=user_id,
        name=data.name,
        email=data.email,
        role=role,
    )


# Fix #6: Rate limit — 5 login attempts per minute per IP
@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, data: OAuth2PasswordRequestForm = Depends()):
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

    session_id = str(uuid.uuid4())
    access_token = create_access_token({"sub": user["_id"], "email": user["email"], "sid": session_id})
    
    # Save active session
    ua = request.headers.get("user-agent", "")
    device, browser = parse_user_agent(ua)
    session_doc = {
        "_id": session_id,
        "user_id": user["_id"],
        "device": device,
        "browser": browser,
        "ip_address": request.client.host if request.client else "127.0.0.1",
        "last_active": datetime.now(timezone.utc),
        "token": access_token
    }
    sessions_col = get_db().db["sessions"]
    await _await_if_coro(sessions_col.insert_one(session_doc))

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


# Fix #7: Token revocation — invalidate token on logout
_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

@router.post("/logout")
async def logout(
    token: str = Depends(_oauth2_scheme),
    current_user: dict = Depends(get_current_user),
):
    """Revoke the current access token so it can no longer be used."""
    revoke_token(token)
    try:
        payload = verify_access_token(token)
        sid = payload.get("sid")
        if sid:
            sessions_col = get_db().db["sessions"]
            await _await_if_coro(sessions_col.delete_one({"_id": sid}))
    except Exception:
        pass
    return {"message": "Successfully logged out"}


@router.get("/sessions")
async def get_active_sessions(
    request: Request,
    token: str = Depends(_oauth2_scheme),
    current_user: dict = Depends(get_current_user),
):
    """Get the list of active sessions for the current user."""
    sessions_col = get_db().db["sessions"]
    cursor = sessions_col.find({"user_id": current_user["id"]})
    sessions = await _await_if_coro(cursor.to_list(length=100))
    
    payload = verify_access_token(token)
    current_sid = payload.get("sid")
    
    has_current = any(s["_id"] == current_sid for s in (sessions or [])) if current_sid else False
    
    if not sessions or (current_sid and not has_current):
        # Self-healing: register the current connection as a session on the fly
        sid_to_use = current_sid if current_sid else str(uuid.uuid4())
        ua = request.headers.get("user-agent", "")
        device, browser = parse_user_agent(ua)
        new_session = {
            "_id": sid_to_use,
            "user_id": current_user["id"],
            "device": device,
            "browser": browser,
            "ip_address": request.client.host if request.client else "127.0.0.1",
            "last_active": datetime.now(timezone.utc),
            "token": token
        }
        await _await_if_coro(sessions_col.insert_one(new_session))
        if not sessions:
            sessions = []
        sessions.append(new_session)
        if not current_sid:
            current_sid = sid_to_use
            
    result = []
    for s in (sessions or []):
        active_val = "Now"
        if s["_id"] != current_sid:
            last_active = s.get("last_active")
            if isinstance(last_active, datetime):
                active_val = last_active.isoformat() + "Z"
            else:
                active_val = "Recently"
        result.append({
            "id": s["_id"],
            "device": s.get("device", "Unknown Device"),
            "browser": s.get("browser", "Unknown Browser"),
            "ip_address": s.get("ip_address", "127.0.0.1"),
            "active": active_val,
            "is_current": s["_id"] == current_sid
        })
    return result


@router.post("/sessions/logout-others")
async def logout_other_devices(
    token: str = Depends(_oauth2_scheme),
    current_user: dict = Depends(get_current_user),
):
    """Revoke all sessions for the current user EXCEPT the current session."""
    payload = verify_access_token(token)
    current_sid = payload.get("sid")
    if not current_sid:
        raise HTTPException(status_code=400, detail="Invalid session context")
        
    sessions_col = get_db().db["sessions"]
    cursor = sessions_col.find({"user_id": current_user["id"], "_id": {"$ne": current_sid}})
    other_sessions = await _await_if_coro(cursor.to_list(length=100))
    
    # Revoke tokens of other sessions in memory blocklist
    for s in (other_sessions or []):
        other_token = s.get("token")
        if other_token:
            revoke_token(other_token)
            
    # Delete them from DB
    await _await_if_coro(sessions_col.delete_many({"user_id": current_user["id"], "_id": {"$ne": current_sid}}))
    return {"message": "Logged out from all other sessions"}
