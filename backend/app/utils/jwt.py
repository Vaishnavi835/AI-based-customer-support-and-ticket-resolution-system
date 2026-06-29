from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, status
from dotenv import load_dotenv
import os
import logging

load_dotenv()

logger = logging.getLogger(__name__)

# Fix #4: Fail fast if JWT_SECRET_KEY is not configured
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
_KNOWN_DEFAULT = "your_super_secret_key_change_this_in_production"
if not SECRET_KEY or SECRET_KEY == _KNOWN_DEFAULT:
    raise RuntimeError(
        "JWT_SECRET_KEY environment variable is not set or still has the default value. "
        "Please set a strong, unique secret in your .env file before starting the server."
    )

ALGORITHM      = os.getenv("JWT_ALGORITHM",  "HS256")
EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))

# Fix #7: In-memory token blocklist for revocation on logout
# NOTE: For multi-server deployments, replace with Redis or MongoDB storage
_revoked_tokens: set[str] = set()


def create_access_token(data: dict) -> str:
    payload = data.copy()
    expire  = datetime.now(timezone.utc) + timedelta(minutes=EXPIRE_MINUTES)
    payload.update({"exp": expire})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_access_token(token: str) -> dict:
    # Fix #7: Check if token has been revoked (logged out)
    if token in _revoked_tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked (logged out)",
        )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token is invalid or expired")


def revoke_token(token: str) -> None:
    """Add a token to the blocklist so it can no longer be used."""
    _revoked_tokens.add(token)
    logger.info(f"Token revoked (blocklist size: {len(_revoked_tokens)})")


def is_token_revoked(token: str) -> bool:
    """Check if a token has been revoked."""
    return token in _revoked_tokens