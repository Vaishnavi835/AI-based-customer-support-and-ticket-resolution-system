from fastapi import APIRouter, HTTPException, Depends
from app.schemas.chat import ChatCreate, ChatMessage
from app.database.connection import get_db
from app.utils.dependencies import get_current_user, require_role
from app.utils.roles import Role
from app.services.ai_service import (
    generate_ai_response,
    generate_contextual_response,
    summarize_conversation,
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

    # Generate AI response with ticket context
    ai_response = await generate_contextual_response(
        conversation_history=[{"role": "user", "content": data.message}],
        ticket_context=ticket,
    )

    doc = {
        "_id":        str(uuid.uuid4()),
        "ticket_id":  data.ticket_id,
        "user_id":    current_user["id"],
        "status":     "active",
        "messages": [
            {"role": "user",      "content": data.message,  "timestamp": datetime.now(timezone.utc).isoformat()},
            {"role": "assistant", "content": ai_response,   "timestamp": datetime.now(timezone.utc).isoformat()},
        ],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.chat_col.insert_one(doc)

    return {
        "message":    "Chat started",
        "id":         doc["_id"],
        "ai_response": ai_response,
    }


# ── Add message — context-aware ───────────────────────────────────────────────

@router.post("/{chat_id}/message")
async def add_message(
    chat_id: str,
    msg:     ChatMessage,
    current_user: dict = Depends(get_current_user),
):
    """
    Add a message to an existing chat.
    AI reads the FULL conversation history before replying.
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

    # Get ticket context
    ticket = await db.tickets_col.find_one({"_id": chat["ticket_id"]})

    # Build full history + new message for context
    history = chat.get("messages", [])
    history_for_ai = [
        {"role": m["role"], "content": m["content"]}
        for m in history
    ]
    history_for_ai.append({"role": "user", "content": msg.content})

    # Generate context-aware AI response
    ai_response = await generate_contextual_response(
        conversation_history=history_for_ai,
        ticket_context=ticket,
    )

    now = datetime.now(timezone.utc).isoformat()
    new_messages = [
        {"role": "user",      "content": msg.content,  "timestamp": now},
        {"role": "assistant", "content": ai_response,   "timestamp": now},
    ]

    await col.update_one(
        {"_id": chat_id},
        {
            "$push": {"messages": {"$each": new_messages}},
            "$set":  {"updated_at": datetime.now(timezone.utc)},
        }
    )

    return {
        "message":     "Message added",
        "ai_response": ai_response,
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
        "chat_id":   chat_id,
        "ticket_id": chat["ticket_id"],
        "summary":   summary,
        "total_messages": len(chat.get("messages", [])),
    }