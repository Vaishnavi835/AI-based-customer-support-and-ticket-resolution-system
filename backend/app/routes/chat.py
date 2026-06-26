"""
Chat routes — updated Day 18 to use RAG responses.

Key change from Day 17:
  Before: generate_contextual_response() → plain Gemini, generic answers
  After:  generate_rag_response()        → Gemini + knowledge base, specific answers

The RAG function searches the knowledge base first, then sends
question + relevant docs to Gemini so it answers from YOUR policies.
"""

from fastapi import APIRouter, HTTPException, Depends
from app.schemas.chat import ChatCreate, ChatMessage
from app.database.connection import get_db
from app.utils.dependencies import get_current_user, require_role
from app.utils.roles import Role
from app.services.rag_service import (
    generate_rag_response,
    search_knowledge_base,
    is_rag_ready,
)
from app.services.ai_service import (
    generate_contextual_response,   # fallback if RAG not ready
    summarize_conversation,
)
from app.services.escalation_service import (
    detect_escalation_reason,
    create_escalation,
    handle_ai_failure,
)
from datetime import datetime, timezone
import uuid
from app.services.websocket_manager import manager

router = APIRouter(tags=["chat"])

async def notify_chat_updated(chat_id: str, ticket_id: str, customer_id: str):
    try:
        event = {"type": "chat_updated", "chat_id": chat_id, "ticket_id": ticket_id}
        # Send to customer
        await manager.send_personal_message(event, customer_id)
        # Send to all agents/admins
        await manager.broadcast_to_roles(event, ["admin", "support_agent"])
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to send chat update: {e}")


async def get_ai_response(
    message: str,
    conversation_history: list,
    ticket_context: dict,
) -> tuple[str, list]:
    if is_rag_ready():
        return await generate_rag_response(
            question=message,
            conversation_history=conversation_history,  # ← NEW: pass it through
            ticket_context=ticket_context,
        )
    else:
        text = await generate_contextual_response(
            conversation_history=conversation_history,
            ticket_context=ticket_context,
        )
        return text, []


# ── Start chat ────────────────────────────────────────────────────────────────

@router.post("/")
async def start_chat(
    data: ChatCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Start a new chat session.
    AI responds immediately using RAG — searches knowledge base
    before answering so the response is grounded in your policies.
    """
    db     = get_db()
    ticket = await db.tickets_col.find_one({"_id": data.ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    role = current_user.get("role")
    if role == Role.customer and ticket["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied. You can only chat on your own tickets."
        )

    escalated_on_start = False
    try:
        ai_response, sources = await get_ai_response(
            message=data.message,
            # Fix #11: Pass empty history for new chat — _build_rag_prompt
            # already adds data.message as "Customer question:" so we don't
            # duplicate it by also putting it in conversation_history.
            conversation_history=[],
            ticket_context=ticket,
        )
    except Exception as e:
        ai_response = (
            "I'm having trouble processing your request right now. "
            "A support agent has been notified and will assist you shortly."
        )
        sources = []
        escalated_on_start = str(e)

    doc = {
        "_id":        str(uuid.uuid4()),
        "ticket_id":  data.ticket_id,
        "user_id":    current_user["id"],
        "status":     "active",
        "escalated":  False,
        "agent_id":   None,
        "rag_enabled": is_rag_ready(),
        "messages": [
            {
                "prompt":    data.message,
                "response":  ai_response,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "rag_used":  is_rag_ready(),
                "sources":   sources,
            }
        ],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.chat_col.insert_one(doc)

    if escalated_on_start:
        await handle_ai_failure(
            chat_id=doc["_id"],
            ticket_id=data.ticket_id,
            error_msg=escalated_on_start,
        )

    await notify_chat_updated(doc["_id"], data.ticket_id, current_user["id"])

    return {
        "message":    "Chat started",
        "id":         doc["_id"],
        "ai_response": ai_response,
        "rag_used":   is_rag_ready(),
        "escalated":  bool(escalated_on_start),
    }


# ── Add message ───────────────────────────────────────────────────────────────

@router.post("/{chat_id}/message")
async def add_message(
    chat_id: str,
    msg:     ChatMessage,
    current_user: dict = Depends(get_current_user),
):
    """
    Add a message. Uses RAG to find relevant knowledge base docs
    before generating the AI reply.

    Escalation logic unchanged from Day 15:
      - Keyword / sentiment / risk / turn count triggers → escalate
      - Escalated + agent → agent replies, AI bypassed
      - Escalated + no agent → queue message
      - Normal → RAG response
    """
    db   = get_db()
    col  = db.chat_col
    chat = await col.find_one({"_id": chat_id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found")

    role = current_user.get("role")
    if role == Role.customer and chat["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied. You can only message in your own chats."
        )

    if chat.get("status") == "closed":
        raise HTTPException(
            status_code=400,
            detail="This chat session is closed. Start a new one."
        )

    ticket         = await db.tickets_col.find_one({"_id": chat["ticket_id"]})
    history        = chat.get("messages", [])
    is_escalated   = chat.get("escalated", False)
    assigned_agent = chat.get("agent_id")
    now            = datetime.now(timezone.utc).isoformat()
    # ── Branch 1: escalated + agent has taken over ────────────────────────────
    if is_escalated and assigned_agent:
        if role == Role.customer:
            new_interaction = {"prompt": msg.content, "response": None, "timestamp": now}
            await col.update_one(
                {"_id": chat_id},
                {
                    "$push": {"messages": new_interaction},
                    "$set":  {"updated_at": datetime.now(timezone.utc)},
                }
            )
            await notify_chat_updated(chat_id, chat["ticket_id"], chat["user_id"])
            return {
                "message":    "Message queued for agent",
                "ai_response": None,
                "escalated":  True,
                "agent_id":   assigned_agent,
            }

        agent_message = {
            "prompt":    None,
            "response":  msg.content,
            "agent_id":  current_user["id"],
            "timestamp": now,
        }
        await col.update_one(
            {"_id": chat_id},
            {
                "$push": {"messages": agent_message},
                "$set":  {"updated_at": datetime.now(timezone.utc)},
            }
        )
        await notify_chat_updated(chat_id, chat["ticket_id"], chat["user_id"])
        return {"message": "Agent reply added", "ai_response": None, "escalated": True}

    # ── Branch 2: escalated but no agent yet ─────────────────────────────────
    if is_escalated and not assigned_agent:
        new_interaction = {"prompt": msg.content, "response": None, "timestamp": now}
        await col.update_one(
            {"_id": chat_id},
            {
                "$push": {"messages": new_interaction},
                "$set":  {"updated_at": datetime.now(timezone.utc)},
            }
        )
        await notify_chat_updated(chat_id, chat["ticket_id"], chat["user_id"])
        return {
            "message":    "Your message has been received. A support agent will assist you shortly.",
            "ai_response": None,
            "escalated":  True,
        }

    # ── Branch 3: normal flow — check triggers then RAG ──────────────────────
    history_for_ai = []
    for m in history:
        if m.get("prompt"):
            history_for_ai.append({"role": "user", "content": m.get("prompt")})
        if m.get("response"):
            role_type = "agent" if m.get("agent_id") else "assistant"
            history_for_ai.append({"role": role_type, "content": m.get("response")})
            
    history_for_ai.append({"role": "user", "content": msg.content})

    escalation_reason = detect_escalation_reason(
        message=msg.content,
        messages=history,
        ticket=ticket or {},
    )

    if escalation_reason:
        new_interaction = {"prompt": msg.content, "response": None, "timestamp": now}
        await col.update_one(
            {"_id": chat_id},
            {
                "$push": {"messages": new_interaction},
                "$set":  {"updated_at": datetime.now(timezone.utc)},
            }
        )
        escalation = await create_escalation(
            chat_id=chat_id,
            ticket_id=chat["ticket_id"],
            reason=escalation_reason,
            triggered_by="system",
            note=f"Auto-detected: {escalation_reason.value}",
        )
        await notify_chat_updated(chat_id, chat["ticket_id"], chat["user_id"])
        return {
            "message":       "Your request has been escalated to a human agent.",
            "ai_response":   None,
            "escalated":     True,
            "reason":        escalation_reason.value,
            "escalation_id": escalation["id"],
        }

    # Normal RAG response
    try:
        ai_response, sources = await get_ai_response(
            message=msg.content,
            conversation_history=history_for_ai,
            ticket_context=ticket,
        )

        interaction = {
            "prompt":    msg.content,
            "response":  ai_response,
            "timestamp": now,
            "rag_used":  is_rag_ready(),
            "sources":   sources,
        }
        await col.update_one(
            {"_id": chat_id},
            {
                "$push": {"messages": interaction},
                "$set":  {"updated_at": datetime.now(timezone.utc)},
            }
        )
        await notify_chat_updated(chat_id, chat["ticket_id"], chat["user_id"])
        return {
            "message":     "Message added",
            "ai_response": ai_response,
            "escalated":   False,
            "rag_used":    is_rag_ready(),
        }

    except Exception as e:
        new_interaction = {"prompt": msg.content, "response": None, "timestamp": now}
        await col.update_one(
            {"_id": chat_id},
            {
                "$push": {"messages": new_interaction},
                "$set":  {"updated_at": datetime.now(timezone.utc)},
            }
        )
        fallback = await handle_ai_failure(
            chat_id=chat_id,
            ticket_id=chat["ticket_id"],
            error_msg=str(e),
        )
        await notify_chat_updated(chat_id, chat["ticket_id"], chat["user_id"])
        return {
            "message":     fallback["ai_response"],
            "ai_response": fallback["ai_response"],
            "escalated":   True,
            "reason":      fallback["reason"],
        }


# ── List all chats ────────────────────────────────────────────────────────────────────
# Fix #12: Changed from "/" to "/all" to avoid path collision with "/{ticket_id}"

@router.get("/all")
async def list_all_chats(
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(require_role(Role.admin, Role.support_agent)),
):
    """
    Only Admin and Support Agent can list all chats.
    Fix #10: Supports pagination instead of hard-capping at 100.
    """
    col   = get_db().chat_col
    skip  = (page - 1) * limit
    total = await col.count_documents({})
    chats = await col.find({}).skip(skip).limit(limit).to_list(limit)
    for c in chats:
        c["id"] = c.pop("_id")
    return {
        "chats":       chats,
        "total":       total,
        "page":        page,
        "limit":       limit,
        "total_pages": (total + limit - 1) // limit,
    }


# ── Get chat history for a ticket ────────────────────────────────────────────

@router.get("/{ticket_id}")
async def get_chat_history(
    ticket_id:    str,
    current_user: dict = Depends(get_current_user),
):
    """
    Admin/Agent — see any ticket's chat history.
    Customer    — see only their own chats.
    """
    col  = get_db().chat_col
    role = current_user.get("role")

    if role in [Role.admin, Role.support_agent]:
        chats = await col.find({"ticket_id": ticket_id}).to_list(100)
    else:
        chats = await col.find({
            "ticket_id": ticket_id,
            "user_id":   current_user["id"],
        }).to_list(100)

    for c in chats:
        c["id"] = c.pop("_id")
    return chats


# ── Close a chat session ──────────────────────────────────────────────────────

@router.patch("/{chat_id}/close")
async def close_chat(
    chat_id:      str,
    current_user: dict = Depends(get_current_user),
):
    """Close a chat session. No more messages can be added after closing."""
    col  = get_db().chat_col
    chat = await col.find_one({"_id": chat_id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found")

    role = current_user.get("role")
    if role == Role.customer and chat["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied.")

    if chat.get("status") == "closed":
        raise HTTPException(status_code=400, detail="Chat is already closed.")

    await col.update_one(
        {"_id": chat_id},
        {"$set": {"status": "closed", "updated_at": datetime.now(timezone.utc)}}
    )
    return {"message": "Chat session closed"}


# ── Summarize conversation ────────────────────────────────────────────────────

@router.get("/{chat_id}/summary")
async def get_chat_summary(
    chat_id:      str,
    current_user: dict = Depends(require_role(Role.admin, Role.support_agent)),
):
    """Generate AI summary of the full conversation. Admin/Agent only."""
    col  = get_db().chat_col
    chat = await col.find_one({"_id": chat_id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found")

    history = []
    for m in chat.get("messages", []):
        if m.get("prompt"):
            history.append({"role": "user", "content": m.get("prompt")})
        if m.get("response"):
            role_type = "agent" if m.get("agent_id") else "assistant"
            history.append({"role": role_type, "content": m.get("response")})
    summary = await summarize_conversation(history)

    return {
        "chat_id":        chat_id,
        "ticket_id":      chat["ticket_id"],
        "summary":        summary,
        "total_messages": len(chat.get("messages", [])),
        "escalated":      chat.get("escalated", False),
        "rag_enabled":    chat.get("rag_enabled", False),
    }