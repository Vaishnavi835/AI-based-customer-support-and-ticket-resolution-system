from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


# ── Enums ─────────────────────────────────────────────────────────────────────

class Priority(str, Enum):
    low    = "low"
    medium = "medium"
    high   = "high"


class Status(str, Enum):
    open        = "open"
    in_progress = "in_progress"
    resolved    = "resolved"
    closed      = "closed"


# ── Valid status transitions ───────────────────────────────────────────────────
# Defines which status changes are allowed.
# e.g. open → in_progress is allowed, but closed → open is NOT.

VALID_TRANSITIONS = {
    Status.open:        [Status.in_progress, Status.closed],
    Status.in_progress: [Status.resolved, Status.closed],
    Status.resolved:    [Status.closed],
    Status.closed:      [],   # closed is final — no transitions allowed
}


def is_valid_transition(current: str, new: str) -> bool:
    """Check if a status change is allowed."""
    try:
        allowed = VALID_TRANSITIONS.get(Status(current), [])
        return Status(new) in allowed
    except ValueError:
        return False


# ── Request schemas ───────────────────────────────────────────────────────────

class TicketCreate(BaseModel):
    title:       str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=10)
    priority:    Priority = Priority.medium


class TicketUpdate(BaseModel):
    status:   Optional[Status]   = None
    priority: Optional[Priority] = None


class TicketAssign(BaseModel):
    assigned_to: str   # user_id of the support agent


# ── Response schemas ──────────────────────────────────────────────────────────

class TicketHistoryEntry(BaseModel):
    changed_by:  str
    field:       str
    old_value:   str
    new_value:   str
    changed_at:  datetime


class TicketResponse(BaseModel):
    id:          str
    title:       str
    description: str
    priority:    str
    status:      str
    user_id:     str
    assigned_to: Optional[str] = None
    created_at:  datetime
    updated_at:  Optional[datetime] = None
    history:     Optional[List[TicketHistoryEntry]] = []


class TicketStats(BaseModel):
    total:       int
    open:        int
    in_progress: int
    resolved:    int
    closed:      int
    high_priority: int