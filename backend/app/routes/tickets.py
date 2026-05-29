from fastapi import APIRouter, HTTPException, Depends
from app.schemas.ticket import TicketCreate, TicketUpdate
from app.database.connection import get_db
from app.utils.dependencies import (
    get_current_user,
    require_role,
)
from app.utils.roles import Role
from datetime import datetime, timezone
import uuid

router = APIRouter(tags=["tickets"])


@router.post("/")
async def create_ticket(
    ticket: TicketCreate,
    current_user: dict = Depends(get_current_user),   # all logged-in users
):
    """Any authenticated user can create a ticket."""
    col = get_db().tickets_col
    doc = {
        "_id":         str(uuid.uuid4()),
        "title":       ticket.title,
        "description": ticket.description,
        "priority":    ticket.priority,
        "user_id":     current_user["id"],   # always use the logged-in user's id
        "status":      "open",
        "created_at":  datetime.now(timezone.utc),
    }
    await col.insert_one(doc)
    return {"message": "Ticket created", "id": doc["_id"]}


@router.get("/")
async def list_tickets(
    current_user: dict = Depends(get_current_user),
):
    """
    Admin/Support Agent — see ALL tickets.
    Customer           — see only their own tickets.
    """
    col  = get_db().tickets_col
    role = current_user.get("role")

    if role in [Role.admin, Role.support_agent]:
        tickets = await col.find({}).to_list(100)
    else:
        # customers only see their own tickets
        tickets = await col.find({"user_id": current_user["id"]}).to_list(100)

    for t in tickets:
        t["id"] = t.pop("_id")
    return tickets


@router.get("/{ticket_id}")
async def get_ticket(
    ticket_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Admin/Support Agent — get any ticket.
    Customer           — get only their own ticket.
    """
    col    = get_db().tickets_col
    ticket = await col.find_one({"_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    role = current_user.get("role")
    if role == Role.customer and ticket["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied. You can only view your own tickets."
        )

    ticket["id"] = ticket.pop("_id")
    return ticket


@router.patch("/{ticket_id}")
async def update_ticket(
    ticket_id: str,
    updates: TicketUpdate,
    current_user: dict = Depends(require_role(Role.admin, Role.support_agent)),  # customers cannot update
):
    """Only Admin and Support Agent can update ticket status/priority."""
    col    = get_db().tickets_col
    fields = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await col.update_one({"_id": ticket_id}, {"$set": fields})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"message": "Ticket updated"}


@router.delete("/{ticket_id}")
async def delete_ticket(
    ticket_id: str,
    current_user: dict = Depends(require_role(Role.admin)),   # admin only
):
    """Only Admin can delete tickets."""
    col    = get_db().tickets_col
    result = await col.delete_one({"_id": ticket_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"message": "Ticket deleted"}
