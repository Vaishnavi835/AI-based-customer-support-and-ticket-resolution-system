from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime


# Valid departments — mirrors ticket Category enum + "all" wildcard
DEPARTMENT_CHOICES = [
    "authentication",
    "billing",
    "technical",
    "account",
    "finance",
    "general",
    "all",
]


class UserCreate(BaseModel):
    name:  str = Field(..., min_length=3, max_length=100)
    email: str = Field(..., min_length=5, max_length=100)
    role:  str = "customer"

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        allowed = ["customer", "support_agent", "admin"]
        if v not in allowed:
            raise ValueError(f"Invalid role: {v}. Must be one of {allowed}")
        return v


class UserResponse(BaseModel):
    id:         str
    name:       str
    email:      str
    role:       str
    department: Optional[str] = None
    created_at: datetime


class UserUpdateRole(BaseModel):
    role: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        allowed = ["customer", "support_agent", "admin"]
        if v not in allowed:
            raise ValueError(f"Invalid role: {v}. Must be one of {allowed}")
        return v


class DepartmentUpdate(BaseModel):
    department: str

    @field_validator("department")
    @classmethod
    def validate_department(cls, v):
        if v not in DEPARTMENT_CHOICES:
            raise ValueError(f"Invalid department '{v}'. Must be one of {DEPARTMENT_CHOICES}")
        return v


class ProfileUpdate(BaseModel):
    name: str | None = Field(None, min_length=3, max_length=100)
    email: str | None = Field(None, min_length=5, max_length=100)


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str

