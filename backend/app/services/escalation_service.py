"""
Escalation Service — the brain of the human-in-the-loop system.

Responsibilities:
  1. Detect escalation triggers in a message / chat state
  2. Create escalation records in MongoDB
  3. Mark a chat as "escalated" so AI stops auto-replying
  4. Let an agent take over (sets assigned_agent, status → active)
  5. Resolve an escalation
  6. AI fallback: if Gemini errors, auto-escalate instead of returning garbage
"""

from datetime import datetime, timezone
from fastapi import HTTPException
from app.database.connection import get_db
from app.schemas.escalation import EscalationReason, EscalationStatus
import uuid
import re


# ── Constants ─────────────────────────────────────────────────────────────────

# Words / phrases that immediately flag a message for human review
ESCALATION_KEYWORDS = [
    "speak to a human",
    "talk to a person",
    "real agent",
    "human agent",
    "supervisor",
    "manager",
    "escalate",
    "unacceptable",
    "this is ridiculous",
    "useless",
    "terrible service",
    "worst",
    "lawsuit",
    "legal action",
    "i want a refund",
    "fraud",
    "scam",
    "threatening",
    "furious",
    "outraged",
]

# After this many message turns the AI flags for human review
MAX_AI_TURNS = 10


def _now():
    return datetime.now(timezone.utc)


# ── Trigger detection ─────────────────────────────────────────────────────────

def check_keyword_trigger(message: str) -> bool:
    """Return True if the message contains any escalation keyword."""
    lower = message.lower()
    return any(kw in lower for kw in ESCALATION_KEYWORDS)


def check_turn_count_trigger(messages: list) -> bool:
    """Return True if the conversation has exceeded MAX_AI_TURNS."""
    # Count only user turns
    user_turns = sum(1 for m in messages if m.get("role") == "user")
    return user_turns >= MAX_AI_TURNS


def check_sentiment_trigger(ticket: dict) -> bool:
    """Return True if ticket carries negative sentiment or angry mood."""
    sentiment = ticket.get("sentiment", "neutral")
    mood      = ticket.get("customer_mood", "calm")
    return sentiment == "negative" or mood == "angry"


def check_risk_score_trigger(ticket: dict) -> bool:
    """Return True if ticket's AI-assigned escalation_risk is high."""
    return ticket.get("escalation_risk", "low") == "high"


def detect_escalation_reason(
    message: str,
    messages: list,
    ticket: dict,
) -> EscalationReason | None:
    """
    Run all trigger checks in priority order.
    Returns the first matching reason, or None if no escalation needed.
    """
    if check_keyword_trigger(message):
        return EscalationReason.keyword_match

    if check_risk_score_trigger(ticket):
        return EscalationReason.high_risk_score

    if check_sentiment_trigger(ticket):
        return EscalationReason.negative_sentiment

    if check_turn_count_trigger(messages):
        return EscalationReason.high_turn_count

    return None


# ── Core escalation operations ────────────────────────────────────────────────

async def create_escalation(
    chat_id:      str,
    ticket_id:    str,
    reason:       EscalationReason,
    triggered_by: str,             # user_id or "system"
    note:         str | None = None,
) -> dict:
    """
    Insert an escalation record and mark the chat as escalated.
    Idempotent: if the chat already has an active escalation, returns it.
    """
    db = get_db()

    # Idempotency guard — don't double-escalate
    existing = await db.escalations_col.find_one({
        "chat_id": chat_id,
        "status":  {"$in": [EscalationStatus.pending.value, EscalationStatus.active.value]},
    })
    if existing:
        existing["id"] = existing.pop("_id")
        return existing

    doc = {
        "_id":            str(uuid.uuid4()),
        "chat_id":        chat_id,
        "ticket_id":      ticket_id,
        "triggered_by":   triggered_by,
        "reason":         reason.value,
        "note":           note,
        "status":         EscalationStatus.pending.value,
        "assigned_agent": None,
        "created_at":     _now(),
        "resolved_at":    None,
        "resolution_note": None,
    }
    await db.escalations_col.insert_one(doc)

    # Mark the chat so AI stops replying
    await db.chat_col.update_one(
        {"_id": chat_id},
        {"$set": {
            "escalated":    True,
            "escalated_at": _now(),
            "updated_at":   _now(),
        }}
    )

    # Also escalate the ticket status if it's still open/pending
    ticket = await db.tickets_col.find_one({"_id": ticket_id})
    if ticket and ticket.get("status") in ["open", "pending"]:
        await db.tickets_col.update_one(
            {"_id": ticket_id},
            {"$set": {"status": "escalated", "updated_at": _now()}}
        )

    doc["id"] = doc.pop("_id")
    return doc


async def agent_takeover(
    chat_id:  str,
    agent_id: str,
) -> dict:
    """
    Assign an agent to the escalation and move status → active.
    From this point AI will not reply; only the agent can add messages.
    """
    db = get_db()
    escalation = await db.escalations_col.find_one({
        "chat_id": chat_id,
        "status":  EscalationStatus.pending.value,
    })
    if not escalation:
        raise HTTPException(
            status_code=404,
            detail="No pending escalation found for this chat."
        )

    await db.escalations_col.update_one(
        {"_id": escalation["_id"]},
        {"$set": {
            "assigned_agent": agent_id,
            "status":         EscalationStatus.active.value,
        }}
    )

    # Mark chat so the add_message route knows an agent owns it
    await db.chat_col.update_one(
        {"_id": chat_id},
        {"$set": {
            "agent_id":   agent_id,
            "updated_at": _now(),
        }}
    )

    return {
        "message":    "Agent takeover successful",
        "chat_id":    chat_id,
        "agent_id":   agent_id,
        "escalation": str(escalation["_id"]),
    }


async def resolve_escalation(
    chat_id:         str,
    agent_id:        str,
    resolution_note: str | None = None,
) -> dict:
    """
    Mark the escalation as resolved.
    The chat remains open so the agent can continue if needed.
    """
    db = get_db()
    escalation = await db.escalations_col.find_one({
        "chat_id": chat_id,
        "status":  EscalationStatus.active.value,
    })
    if not escalation:
        raise HTTPException(
            status_code=404,
            detail="No active escalation found for this chat."
        )

    await db.escalations_col.update_one(
        {"_id": escalation["_id"]},
        {"$set": {
            "status":          EscalationStatus.resolved.value,
            "resolved_at":     _now(),
            "resolution_note": resolution_note,
        }}
    )

    return {"message": "Escalation resolved", "chat_id": chat_id}


async def get_escalation_by_chat(chat_id: str) -> dict | None:
    """Return the active/pending escalation for a chat, or None."""
    db = get_db()
    doc = await db.escalations_col.find_one({
        "chat_id": chat_id,
        "status":  {"$in": [
            EscalationStatus.pending.value,
            EscalationStatus.active.value,
        ]},
    })
    if doc:
        doc["id"] = doc.pop("_id")
    return doc


async def list_pending_escalations() -> list:
    """All pending escalations — for agent dashboard."""
    db   = get_db()
    docs = await db.escalations_col.find(
        {"status": EscalationStatus.pending.value}
    ).sort("created_at", 1).to_list(100)
    for d in docs:
        d["id"] = d.pop("_id")
    return docs


# ── AI fallback handler ───────────────────────────────────────────────────────

async def handle_ai_failure(
    chat_id:   str,
    ticket_id: str,
    error_msg: str,
) -> dict:
    """
    Called when Gemini throws an exception.
    Escalates automatically so a human can step in,
    and returns a safe fallback message for the customer.
    """
    await create_escalation(
        chat_id=chat_id,
        ticket_id=ticket_id,
        reason=EscalationReason.ai_failure,
        triggered_by="system",
        note=f"AI service error: {error_msg[:200]}",
    )

    return {
        "ai_response": (
            "I'm having trouble processing your request right now. "
            "A support agent has been notified and will assist you shortly."
        ),
        "escalated": True,
        "reason":    EscalationReason.ai_failure.value,
    }