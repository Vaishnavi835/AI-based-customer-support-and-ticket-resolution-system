from fastapi import APIRouter, HTTPException, Depends
from app.schemas.chat import ChatCreate, ChatMessage
from app.database.connection import get_db
from app.utils.dependencies import get_current_user, require_role
from app.utils.roles import Role
from datetime import datetime, timezone
import uuid

router = APIRouter(tags=["chat"])


@router.post("/")
async def start_chat(
    data: ChatCreate,
    current_user: dict = Depends(get_current_user),   # all authenticated users
):
    """Any authenticated user can start a chat on their ticket."""
    db     = get_db()
    ticket = await db.tickets_col.find_one({"_id": data.ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Customers can only chat on their own tickets
    role = current_user.get("role")
    if role == Role.customer and ticket["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied. You can only chat on your own tickets."
        )

    doc = {
        "_id":        str(uuid.uuid4()),
        "ticket_id":  data.ticket_id,
        "user_id":    current_user["id"],
        "messages":   [{"role": "user", "content": data.message}],
        "created_at": datetime.now(timezone.utc),
    }
    await db.chat_col.insert_one(doc)
    return {"message": "Chat started", "id": doc["_id"]}


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


@router.get("/{ticket_id}")
async def get_chat_history(
    ticket_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Admin/Support Agent — see any ticket's chat history.
    Customer           — see only their own ticket's chat.
    """
    col    = get_db().chat_col
    role   = current_user.get("role")

    if role in [Role.admin, Role.support_agent]:
        chats = await col.find({"ticket_id": ticket_id}).to_list(100)
    else:
        chats = await col.find({
            "ticket_id": ticket_id,
            "user_id":   current_user["id"]
        }).to_list(100)

    for c in chats:
        c["id"] = c.pop("_id")
    return chats


@router.post("/{chat_id}/message")
async def add_message(
    chat_id: str,
    msg: ChatMessage,
    current_user: dict = Depends(get_current_user),
):
    """Any authenticated user can add a message to a chat they own."""
    col    = get_db().chat_col
    chat   = await col.find_one({"_id": chat_id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found")

    # Customers can only add messages to their own chats
    role = current_user.get("role")
    if role == Role.customer and chat["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied. You can only message in your own chats." 
        )

    await col.update_one(
        {"_id": chat_id},
        {"$push": {"messages": msg.model_dump()}}
    )
    return {"message": "Message added"}