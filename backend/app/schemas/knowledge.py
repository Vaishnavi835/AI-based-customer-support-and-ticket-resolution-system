from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime


VALID_CATEGORIES = [
    "billing",
    "authentication",
    "technical",
    "account",
    "general",
]


class KBDocCreate(BaseModel):
    """Schema for adding a new KB document (admin only)."""
    title:    str = Field(..., min_length=3,  max_length=200)
    category: str
    content:  str = Field(..., min_length=10)

    @field_validator("category")
    @classmethod
    def validate_category(cls, v):
        if v not in VALID_CATEGORIES:
            raise ValueError(
                f"Invalid category '{v}'. Must be one of: {VALID_CATEGORIES}"
            )
        return v


class KBDocUpdate(BaseModel):
    """Schema for updating an existing KB document. All fields optional."""
    title:    Optional[str] = Field(None, min_length=3, max_length=200)
    category: Optional[str] = None
    content:  Optional[str] = Field(None, min_length=10)

    @field_validator("category")
    @classmethod
    def validate_category(cls, v):
        if v is not None and v not in VALID_CATEGORIES:
            raise ValueError(
                f"Invalid category '{v}'. Must be one of: {VALID_CATEGORIES}"
            )
        return v


class KBDocResponse(BaseModel):
    """Schema for reading a KB document (includes timestamps)."""
    id:         str
    title:      str
    category:   str
    content:    str
    created_at: datetime
    updated_at: datetime