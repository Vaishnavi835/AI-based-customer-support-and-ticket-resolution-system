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
    # Count only user turns (either prompt key present, or role == "user")
    user_turns = sum(
        1 for m in messages
        if m.get("prompt") is not None or m.get("role") == "user"
    )
    return user_turns >= MAX_AI_TURNS


def check_sentiment_trigger(ticket: dict) -> bool:
    """Return True if ticket carries negative sentiment or angry mood."""
    sentiment = ticket.get("sentiment", "neutral")
    mood      = ticket.get("customer_mood", "calm")
    return sentiment == "negative" or mood == "angry"


def check_risk_score_trigger(ticket: dict) -> bool:
    """Return True if ticket's AI-assigned escalation_risk is high."""
    return ticket.get("escalation_risk", "low") == "high"


def check_contextual_trigger(message: str, messages: list) -> bool:
    """Return True if AI previously offered an agent and user affirmed."""
    if not messages:
        return False
    
    last_msg = messages[-1]
    if last_msg.get("response"):
        last_response = last_msg["response"].lower()
        if "human agent" in last_response or "transfer" in last_response or "connect you" in last_response:
            affirmative = ["yes", "yeah", "yep", "sure", "please", "ok", "okay", "do it", "connect me", "i would"]
            msg_lower = message.lower().strip().strip(".!?,")
            if any(msg_lower == word or msg_lower.startswith(word + " ") for word in affirmative):
                return True
    return False


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
        
    if check_contextual_trigger(message, messages):
        return EscalationReason.keyword_match

    if check_risk_score_trigger(ticket):
        return EscalationReason.high_risk_score

    if check_sentiment_trigger(ticket):
        return EscalationReason.negative_sentiment

    if check_turn_count_trigger(messages):
        return EscalationReason.high_turn_count

    return None


# ── Core escalation operations ────────────────────────────────────────────────

async def _broadcast_escalation_update(chat_id: str, ticket_id: str):
    """Broadcast websocket updates to keep clients in sync."""
    try:
        from app.services.websocket_manager import manager
        from app.services.ticket_service import get_ticket_by_id, _format_ticket_for_ws

        # 1. Broadcast chat update
        chat_event = {"type": "chat_updated", "chat_id": chat_id, "ticket_id": ticket_id}
        db = get_db()
        chat = await db.chat_col.find_one({"_id": chat_id})
        if chat:
            await manager.send_personal_message(chat_event, chat["user_id"])
        await manager.broadcast_to_roles(chat_event, ["admin", "support_agent"])

        # 2. Broadcast ticket update
        ticket = await get_ticket_by_id(ticket_id)
        ticket_payload = _format_ticket_for_ws(ticket)
        ticket_event = {
            "type": "ticket_updated",
            "ticket": ticket_payload
        }
        await manager.send_personal_message(ticket_event, ticket_payload["user_id"])
        await manager.broadcast_to_roles(ticket_event, ["admin", "support_agent"])
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to broadcast escalation update: {e}")


async def _find_best_agent_for_category(category: str) -> str | None:
    """
    Finds the least busy agent in the given department (or 'all').
    If none found, falls back to any available agent/admin.
    Returns the agent's _id, or None if no suitable agent is found.
    """
    db = get_db()
    # Find agents in matching department or wildcard 'all'
    agents = await db.users_col.find({
        "role": {"$in": ["support_agent", "admin"]},
        "department": {"$in": [category, "all"]}
    }).to_list(100)

    if not agents:
        # Fallback: Find any agent/admin regardless of department
        agents = await db.users_col.find({
            "role": {"$in": ["support_agent", "admin"]}
        }).to_list(100)
        
    if not agents:
        return None

    best_agent_id = None
    min_workload = float('inf')

    for agent in agents:
        agent_id = agent["_id"]
        # Count open tickets/escalations for this agent
        open_count = await db.tickets_col.count_documents({
            "assigned_to": agent_id,
            "status": {"$in": ["open", "pending", "escalated"]}
        })
        
        if open_count < min_workload:
            min_workload = open_count
            best_agent_id = agent_id

    return best_agent_id


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

    # Determine ticket category and try to auto-assign
    ticket = await db.tickets_col.find_one({"_id": ticket_id})
    category = ticket.get("category", "general") if ticket else "general"
    
    assigned_agent_id = await _find_best_agent_for_category(category)
    status = EscalationStatus.active.value if assigned_agent_id else EscalationStatus.pending.value

    doc = {
        "_id":            str(uuid.uuid4()),
        "chat_id":        chat_id,
        "ticket_id":      ticket_id,
        "triggered_by":   triggered_by,
        "reason":         reason.value,
        "note":           note,
        "status":         status,
        "assigned_agent": assigned_agent_id,
        "created_at":     _now(),
        "resolved_at":    None,
        "resolution_note": None,
    }
    await db.escalations_col.insert_one(doc)

    # Mark the chat so AI stops replying, and assign agent if auto-routed
    chat_update = {
        "escalated":    True,
        "escalated_at": _now(),
        "updated_at":   _now(),
    }
    if assigned_agent_id:
        chat_update["agent_id"] = assigned_agent_id

    await db.chat_col.update_one(
        {"_id": chat_id},
        {"$set": chat_update}
    )

    # Also escalate the ticket status if it's still open/pending
    if ticket and ticket.get("status") in ["open", "pending"]:
        ticket_update = {"status": "escalated", "updated_at": _now()}
        if assigned_agent_id:
            ticket_update["assigned_to"] = assigned_agent_id
            
        await db.tickets_col.update_one(
            {"_id": ticket_id},
            {"$set": ticket_update}
        )

    doc["id"] = doc.pop("_id")
    await _broadcast_escalation_update(chat_id, ticket_id)
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

    ticket_id = escalation.get("ticket_id")
    if ticket_id:
        await _broadcast_escalation_update(chat_id, ticket_id)

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

    ticket_id = escalation.get("ticket_id")
    if ticket_id:
        await _broadcast_escalation_update(chat_id, ticket_id)

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