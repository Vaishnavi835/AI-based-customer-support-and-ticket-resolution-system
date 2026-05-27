from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class Priority(str, Enum):
    low    = "low"
    medium = "medium"
    high   = "high"


class Status(str, Enum):
    open        = "open"
    in_progress = "in_progress"
    resolved    = "resolved"
    closed      = "closed"


class TicketCreate(BaseModel):
    title:       str
    description: str
    priority:    Priority = Priority.medium
    user_id:     str


class TicketUpdate(BaseModel):
    status:   Optional[Status]   = None
    priority: Optional[Priority] = None


class TicketResponse(BaseModel):
    id:          str
    title:       str
    description: str
    priority:    str
    status:      str
    user_id:     str
    created_at:  datetime