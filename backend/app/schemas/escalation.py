from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class EscalationReason(str, Enum):
    keyword_match    = "keyword_match"     # angry / urgent words in message
    high_turn_count  = "high_turn_count"   # too many back-and-forth turns
    negative_sentiment = "negative_sentiment"  # AI-detected negative mood
    high_risk_score  = "high_risk_score"   # AI escalation_risk = "high"
    ai_failure       = "ai_failure"        # Gemini threw an error
    manual           = "manual"            # agent/admin triggered manually
    incident         = "incident"          # customer flagged as incident report


class EscalationStatus(str, Enum):
    pending  = "pending"   # flagged, waiting for agent to pick up
    active   = "active"    # agent has taken over
    resolved = "resolved"  # issue handled, back to normal or closed


class EscalationCreate(BaseModel):
    chat_id: str
    reason:  EscalationReason
    note:    Optional[str] = None   # free-text context for the agent


class EscalationResolve(BaseModel):
    resolution_note: Optional[str] = None


class EscalationResponse(BaseModel):
    id:              str
    chat_id:         str
    ticket_id:       str
    triggered_by:    str                  # user_id or "system"
    reason:          str
    note:            Optional[str] = None
    status:          str
    assigned_agent:  Optional[str] = None
    created_at:      datetime
    resolved_at:     Optional[datetime] = None
    resolution_note: Optional[str] = None