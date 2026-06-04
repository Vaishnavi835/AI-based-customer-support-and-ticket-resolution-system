from pydantic import BaseModel, Field, field_validator
from datetime import datetime


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
    created_at: datetime
