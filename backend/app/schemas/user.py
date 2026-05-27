from pydantic import BaseModel
from datetime import datetime


class UserCreate(BaseModel):
    name:  str
    email: str
    role:  str = "customer"


class UserResponse(BaseModel):
    id:         str
    name:       str
    email:      str
    role:       str
    created_at: datetime