from fastapi import APIRouter, HTTPException
from app.schemas.ticket import TicketCreate, TicketUpdate
from app.database.connection import tickets_col
from datetime import datetime, timezone
import uuid

router = APIRouter(tags=["tickets"])


@router.post("/")
async def create_ticket(ticket: TicketCreate):
    doc = {
        "_id":         str(uuid.uuid4()),
        "title":       ticket.title,
        "description": ticket.description,
        "priority":    ticket.priority,
        "user_id":     ticket.user_id,
        "status":      "open",
        "created_at":  datetime.now(timezone.utc),
    }
    await tickets_col.insert_one(doc)
    return {"message": "Ticket created", "id": doc["_id"]}


@router.get("/")
async def list_tickets():
    tickets = await tickets_col.find({}).to_list(100)
    for t in tickets:
        t["id"] = t.pop("_id")
    return tickets


@router.get("/{ticket_id}")
async def get_ticket(ticket_id: str):
    ticket = await tickets_col.find_one({"_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket["id"] = ticket.pop("_id")
    return ticket


@router.patch("/{ticket_id}")
async def update_ticket(ticket_id: str, updates: TicketUpdate):
    fields = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await tickets_col.update_one({"_id": ticket_id}, {"$set": fields})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"message": "Ticket updated"}


@router.delete("/{ticket_id}")
async def delete_ticket(ticket_id: str):
    result = await tickets_col.delete_one({"_id": ticket_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"message": "Ticket deleted"}