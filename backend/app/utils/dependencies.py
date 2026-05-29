from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.utils.jwt import verify_access_token
from app.utils.roles import Role, has_permission
from app.database.connection import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ── Base dependency — just checks token is valid ──────────────────────────────

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Validates JWT token and returns the current user dict."""
    payload = verify_access_token(token)
    col     = get_db().users_col
    user    = await col.find_one({"_id": payload["sub"]})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    user.pop("password", None)
    user["id"] = user.pop("_id")
    return user


# ── Role-based dependency factories ──────────────────────────────────────────

def require_role(*allowed_roles: Role):
    """
    Dependency factory — restricts a route to specific roles.

    Usage:
        @router.delete("/{id}")
        async def delete(user=Depends(require_role(Role.admin))):
            ...

        @router.patch("/{id}")
        async def update(user=Depends(require_role(Role.admin, Role.support_agent))):
            ...
    """
    async def role_checker(current_user: dict = Depends(get_current_user)):
        user_role = current_user.get("role")
        if user_role not in [r.value for r in allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {[r.value for r in allowed_roles]}"
            )
        return current_user
    return role_checker


def require_permission(permission: str):
    """
    Dependency factory — restricts a route to users who have a specific permission.

    Usage:
        @router.delete("/{id}")
        async def delete(user=Depends(require_permission("delete:ticket"))):
            ...
    """
    async def permission_checker(current_user: dict = Depends(get_current_user)):
        user_role = current_user.get("role")
        if not has_permission(user_role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Missing permission: {permission}"
            )
        return current_user
    return permission_checker


# ── Convenience shortcuts ─────────────────────────────────────────────────────

def admin_only():
    return require_role(Role.admin)

def agent_or_admin():
    return require_role(Role.admin, Role.support_agent)

def all_authenticated():
    return get_current_user