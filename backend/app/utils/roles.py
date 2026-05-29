from enum import Enum


class Role(str, Enum):
    admin         = "admin"
    support_agent = "support_agent"
    customer      = "customer"


# Permission map — defines what each role can do
ROLE_PERMISSIONS = {
    Role.admin: [
        "create:ticket",
        "read:ticket",
        "update:ticket",
        "delete:ticket",
        "read:users",
        "delete:user",
        "read:chat",
        "create:chat",
        "manage:all",        # admin-only superpower
    ],
    Role.support_agent: [
        "create:ticket",
        "read:ticket",
        "update:ticket",     # can change status/priority
        "read:users",
        "read:chat",
        "create:chat",
    ],
    Role.customer: [
        "create:ticket",
        "read:ticket",       # only their own tickets
        "read:chat",         # only their own chats
        "create:chat",
    ],
}


def get_permissions(role: str) -> list:
    """Return list of permissions for a given role string."""
    try:
        return ROLE_PERMISSIONS.get(Role(role), [])
    except ValueError:
        return []


def has_permission(role: str, permission: str) -> bool:
    """Check if a role has a specific permission."""
    return permission in get_permissions(role)