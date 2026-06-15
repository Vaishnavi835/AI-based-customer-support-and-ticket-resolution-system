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
    open = "open"
    pending = "pending"
    escalated = "escalated"
    resolved = "resolved"
    closed = "closed"

class Urgency(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class Category(str, Enum):
    authentication = "authentication"
    billing = "billing"
    technical = "technical"
    account = "account"
    finance = "finance"
    general = "general"



VALID_TRANSITIONS = {
    Status.open: [
        Status.pending,
        Status.escalated,
        Status.resolved,
    ],

    Status.pending: [
        Status.escalated,
        Status.resolved,
    ],

    Status.escalated: [
        Status.pending,
        Status.resolved,
    ],

    Status.resolved: [
        Status.closed,
    ],

    Status.closed: [],
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

class TicketReassign(BaseModel):
    assigned_to: str    
    reason:      str    


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
    category: Optional[str] = None
    urgency: Optional[str] = None
    sentiment: Optional[str] = None
    customer_mood: Optional[str] = None
    escalation_risk: Optional[str] = None
    status:      str
    user_id:     str
    assigned_to: Optional[str] = None
    created_at:  datetime
    updated_at:  Optional[datetime] = None
    history:     Optional[List[TicketHistoryEntry]] = []


class TicketStats(BaseModel):
    total: int
    open: int
    pending: int
    escalated: int
    resolved: int
    closed: int
    high_priority: int

class TicketSearchParams(BaseModel):
    """All possible search and filter parameters for listing tickets."""
    search:        Optional[str] = None   # keyword in title or description
    customer_email: Optional[str] = None  # filter by customer's email
    status:        Optional[Status] = None
    priority:      Optional[Priority] = None
    assigned_to:   Optional[str] = None
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    sort_by:       str = "created_at"     # created_at | priority | status
    sort_order:    str = "desc"           # asc | desc
    page:          int = Field(1,  ge=1)
    limit:         int = Field(10, ge=1, le=100)