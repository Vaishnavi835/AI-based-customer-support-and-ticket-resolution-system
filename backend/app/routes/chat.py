from fastapi import APIRouter, HTTPException
from app.schemas.chat import ChatCreate, ChatMessage
from app.database.connection import chat_col, tickets_col
from datetime import datetime, timezone
import uuid

router = APIRouter(tags=["chat"])


@router.post("/")
async def start_chat(data: ChatCreate):
    ticket = await tickets_col.find_one({"_id": data.ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    doc = {
        "_id":        str(uuid.uuid4()),
        "ticket_id":  data.ticket_id,
        "user_id":    data.user_id,
        "messages":   [{"role": "user", "content": data.message}],
        "created_at": datetime.now(timezone.utc),
    }
    await chat_col.insert_one(doc)
    return {"message": "Chat started", "id": doc["_id"]}


@router.get("/{ticket_id}")
async def get_chat_history(ticket_id: str):
    chats = await chat_col.find({"ticket_id": ticket_id}).to_list(100)
    for c in chats:
        c["id"] = c.pop("_id")
    return chats


@router.post("/{chat_id}/message")
async def add_message(chat_id: str, msg: ChatMessage):
    result = await chat_col.update_one(
        {"_id": chat_id},
        {"$push": {"messages": msg.model_dump()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return {"message": "Message added"}