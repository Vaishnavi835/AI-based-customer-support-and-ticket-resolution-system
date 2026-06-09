from fastapi import APIRouter, HTTPException, Depends
from app.schemas.chat import ChatCreate, ChatMessage
from app.database.connection import get_db
from app.utils.dependencies import get_current_user, require_role
from app.utils.roles import Role
from app.services.ai_service import (
    generate_contextual_response,
    summarize_conversation,
)
from app.services.escalation_service import (
    detect_escalation_reason,
    create_escalation,
    handle_ai_failure,
)
from datetime import datetime, timezone
import uuid

router = APIRouter(tags=["chat"])


# ── Start chat ────────────────────────────────────────────────────────────────

@router.post("/")
async def start_chat(
    data: ChatCreate,
    current_user: dict = Depends(get_current_user),
):
    """Start a new chat session. AI responds immediately with ticket context."""
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

    # Try AI response — fall back gracefully on failure
    try:
        ai_response = await generate_contextual_response(
            conversation_history=[{"role": "user", "content": data.message}],
            ticket_context=ticket,
        )
        escalated_on_start = False
    except Exception as e:
        # Will be escalated after doc is created (we need chat_id first)
        ai_response = (
            "I'm having trouble processing your request right now. "
            "A support agent has been notified and will assist you shortly."
        )
        escalated_on_start = str(e)

    doc = {
        "_id":        str(uuid.uuid4()),
        "ticket_id":  data.ticket_id,
        "user_id":    current_user["id"],
        "status":     "active",
        "escalated":  False,
        "agent_id":   None,
        "messages": [
            {"role": "user",      "content": data.message,  "timestamp": datetime.now(timezone.utc).isoformat()},
            {"role": "assistant", "content": ai_response,   "timestamp": datetime.now(timezone.utc).isoformat()},
        ],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.chat_col.insert_one(doc)

    # If AI failed on startup, create the escalation now that we have chat_id
    if escalated_on_start:
        await handle_ai_failure(
            chat_id=doc["_id"],
            ticket_id=data.ticket_id,
            error_msg=escalated_on_start,
        )

    return {
        "message":    "Chat started",
        "id":         doc["_id"],
        "ai_response": ai_response,
        "escalated":  bool(escalated_on_start),
    }


# ── Add message — context-aware with escalation check ────────────────────────

@router.post("/{chat_id}/message")
async def add_message(
    chat_id: str,
    msg:     ChatMessage,
    current_user: dict = Depends(get_current_user),
):
    """
    Add a message to an existing chat.

    Escalation logic:
      - If chat is escalated AND an agent has taken over → only that agent
        can reply; AI is bypassed entirely.
      - If chat is escalated but no agent yet → customer can still message,
        AI is bypassed, message queued for agent.
      - Otherwise → check triggers on this message; escalate if needed,
        otherwise let AI reply normally.
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

    ticket       = await db.tickets_col.find_one({"_id": chat["ticket_id"]})
    history      = chat.get("messages", [])
    is_escalated = chat.get("escalated", False)
    assigned_agent = chat.get("agent_id")

    now = datetime.now(timezone.utc).isoformat()
    new_messages = [{"role": "user", "content": msg.content, "timestamp": now}]

    # ── Branch 1: escalated + agent has taken over ────────────────────────────
    # Only the assigned agent (or admin) can reply; AI is bypassed.
    if is_escalated and assigned_agent:
        if role == Role.customer:
            # Customer message is stored and queued for agent — no AI reply
            await col.update_one(
                {"_id": chat_id},
                {
                    "$push": {"messages": {"$each": new_messages}},
                    "$set":  {"updated_at": datetime.now(timezone.utc)},
                }
            )
            return {
                "message":    "Message queued for agent",
                "ai_response": None,
                "escalated":  True,
                "agent_id":   assigned_agent,
            }

        # Agent/admin posting their reply
        agent_message = {
            "role":      "agent",
            "content":   msg.content,
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
        return {
            "message":    "Agent reply added",
            "ai_response": None,
            "escalated":  True,
        }

    # ── Branch 2: escalated but no agent yet ─────────────────────────────────
    # Store the message and tell the customer to wait.
    if is_escalated and not assigned_agent:
        await col.update_one(
            {"_id": chat_id},
            {
                "$push": {"messages": {"$each": new_messages}},
                "$set":  {"updated_at": datetime.now(timezone.utc)},
            }
        )
        return {
            "message":    "Your message has been received. A support agent will assist you shortly.",
            "ai_response": None,
            "escalated":  True,
        }

    # ── Branch 3: normal flow — check triggers then try AI ───────────────────
    history_for_ai = [{"role": m["role"], "content": m["content"]} for m in history]
    history_for_ai.append({"role": "user", "content": msg.content})

    escalation_reason = detect_escalation_reason(
        message=msg.content,
        messages=history,
        ticket=ticket or {},
    )

    if escalation_reason:
        # Trigger detected — escalate before AI replies
        await col.update_one(
            {"_id": chat_id},
            {
                "$push": {"messages": {"$each": new_messages}},
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
        return {
            "message":    "Your request has been escalated to a human agent.",
            "ai_response": None,
            "escalated":  True,
            "reason":     escalation_reason.value,
            "escalation_id": escalation["id"],
        }

    # Normal AI reply — with fallback on failure
    try:
        ai_response = await generate_contextual_response(
            conversation_history=history_for_ai,
            ticket_context=ticket,
        )
        assistant_message = {
            "role":      "assistant",
            "content":   ai_response,
            "timestamp": now,
        }
        all_new = new_messages + [assistant_message]

        await col.update_one(
            {"_id": chat_id},
            {
                "$push": {"messages": {"$each": all_new}},
                "$set":  {"updated_at": datetime.now(timezone.utc)},
            }
        )
        return {
            "message":     "Message added",
            "ai_response": ai_response,
            "escalated":   False,
        }

    except Exception as e:
        # AI failed mid-conversation → auto-escalate
        await col.update_one(
            {"_id": chat_id},
            {
                "$push": {"messages": {"$each": new_messages}},
                "$set":  {"updated_at": datetime.now(timezone.utc)},
            }
        )
        fallback = await handle_ai_failure(
            chat_id=chat_id,
            ticket_id=chat["ticket_id"],
            error_msg=str(e),
        )
        return {
            "message":     fallback["ai_response"],
            "ai_response": fallback["ai_response"],
            "escalated":   True,
            "reason":      fallback["reason"],
        }


# ── List all chats ────────────────────────────────────────────────────────────

@router.get("/")
async def list_all_chats(
    current_user: dict = Depends(require_role(Role.admin, Role.support_agent)),
):
    """Only Admin and Support Agent can list all chats."""
    col   = get_db().chat_col
    chats = await col.find({}).to_list(100)
    for c in chats:
        c["id"] = c.pop("_id")
    return chats


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
    """
    Generate AI summary of the full conversation.
    Admin and Support Agent only — useful for reviewing tickets.
    """
    col  = get_db().chat_col
    chat = await col.find_one({"_id": chat_id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found")

    history = [
        {"role": m["role"], "content": m["content"]}
        for m in chat.get("messages", [])
    ]

    summary = await summarize_conversation(history)

    return {
        "chat_id":        chat_id,
        "ticket_id":      chat["ticket_id"],
        "summary":        summary,
        "total_messages": len(chat.get("messages", [])),
        "escalated":      chat.get("escalated", False),
    }