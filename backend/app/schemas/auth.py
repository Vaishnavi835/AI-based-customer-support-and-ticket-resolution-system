from pydantic import BaseModel, Field, field_validator
import re


class RegisterRequest(BaseModel):
    name:     str = Field(..., min_length=3, max_length=100)
    email:    str = Field(..., min_length=5, max_length=100)
    password: str = Field(..., min_length=8, max_length=100)
    role:     str = "customer"

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        allowed = ["customer", "support_agent", "admin"]
        if v not in allowed:
            raise ValueError(f"Invalid role: {v}. Must be one of {allowed}")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, v):
            raise ValueError("Invalid email format")
        return v.lower()

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError("Name cannot be empty or whitespace")
        return v.strip()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain at least one special character")
        return v


class LoginRequest(BaseModel):
    email:    str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user_id:      str
    name:         str
    email:        str
    role:         str
