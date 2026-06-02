"""
Ticket Service — business logic layer.

Routes call these functions instead of talking to MongoDB directly.
This separates concerns:
  - Routes handle HTTP (request/response)
  - Services handle business logic (rules, validation, data manipulation)
  - Database handles storage
"""

from fastapi import HTTPException
from datetime import datetime, timezone
from app.database.connection import get_db
from app.schemas.ticket import (
    TicketCreate, TicketUpdate, TicketAssign,
    Status, Priority, is_valid_transition
)
import uuid


def _now():
    return datetime.now(timezone.utc)


def _history_entry(changed_by: str, field: str, old_value: str, new_value: str) -> dict:
    """Build a single history entry dict."""
    return {
        "changed_by": changed_by,
        "field":      field,
        "old_value":  str(old_value),
        "new_value":  str(new_value),
        "changed_at": _now(),
    }


# ── Create ────────────────────────────────────────────────────────────────────

async def create_ticket(ticket: TicketCreate, user_id: str) -> dict:
    """
    Create a new support ticket.
    - user_id always comes from the authenticated user's token
    - Status starts as 'open' always
    - history starts empty
    """
    col = get_db().tickets_col
    doc = {
        "_id":         str(uuid.uuid4()),
        "title":       ticket.title,
        "description": ticket.description,
        "priority":    ticket.priority.value,
        "user_id":     user_id,
        "assigned_to": None,
        "status":      Status.open.value,
        "created_at":  _now(),
        "updated_at":  None,
        "history":     [],
    }
    await col.insert_one(doc)
    return {"message": "Ticket created", "id": doc["_id"]}


# ── Read ──────────────────────────────────────────────────────────────────────

async def get_ticket_by_id(ticket_id: str) -> dict:
    """Fetch a single ticket by ID. Raises 404 if not found."""
    col    = get_db().tickets_col
    ticket = await col.find_one({"_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket["id"] = ticket.pop("_id")
    return ticket


async def list_tickets(
    user_id: str,
    role: str,
    status: str = None,
    priority: str = None,
    assigned_to: str = None,
    page: int = 1,
    limit: int = 10,
) -> dict:
    """
    List tickets with filtering and pagination.

    - Admin/Support Agent: see all tickets
    - Customer: see only their own tickets

    Filters: status, priority, assigned_to
    Pagination: page and limit params
    """
    col = get_db().tickets_col

    # Base query — role-based filtering
    query = {}
    if role == "customer":
        query["user_id"] = user_id   # customers only see their own

    # Optional filters
    if status:
        try:
            Status(status)   # validate it's a real status
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
        query["status"] = status

    if priority:
        try:
            Priority(priority)   # validate it's a real priority
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid priority: {priority}")
        query["priority"] = priority

    if assigned_to and role != "customer":
        query["assigned_to"] = assigned_to

    # Pagination
    skip  = (page - 1) * limit
    total = await col.count_documents(query)

    tickets = await col.find(query).skip(skip).limit(limit).to_list(limit)
    for t in tickets:
        t["id"] = t.pop("_id")

    return {
        "tickets":    tickets,
        "total":      total,
        "page":       page,
        "limit":      limit,
        "total_pages": (total + limit - 1) // limit,
    }


async def get_ticket_stats() -> dict:
    """Return ticket counts by status and high-priority count. Admin only."""
    col = get_db().tickets_col
    total       = await col.count_documents({})
    open_count = await col.count_documents(
    {"status": Status.open.value}
)

    pending_count = await col.count_documents(
        {"status": Status.pending.value}
)

    escalated_count = await col.count_documents(
    {"status": Status.escalated.value}
)

    resolved_count = await col.count_documents(
    {"status": Status.resolved.value}
)

    closed_count = await col.count_documents(
    {"status": Status.closed.value}
)
    high_prio   = await col.count_documents({"priority": Priority.high.value})

    return {
    "total": total,
    "open": open_count,
    "pending": pending_count,
    "escalated": escalated_count,
    "resolved": resolved_count,
    "closed": closed_count,
    "high_priority": high_prio,
}

# ── Update ────────────────────────────────────────────────────────────────────

async def update_ticket(
    ticket_id: str,
    updates: TicketUpdate,
    changed_by: str,
) -> dict:
    """
    Update ticket status or priority with:
    - Status lifecycle validation (can't skip steps)
    - History tracking (records every change with who made it)
    - updated_at timestamp
    """
    col    = get_db().tickets_col
    ticket = await col.find_one({"_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    fields  = {}
    history = []

    # ── Status update with lifecycle validation ───────────────────────────────
    if updates.status is not None:
        current_status = ticket.get("status", Status.open.value)
        new_status     = updates.status.value

        if new_status == current_status:
            raise HTTPException(
                status_code=400,
                detail=f"Ticket is already '{current_status}'"
            )

        if not is_valid_transition(current_status, new_status):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid transition: '{current_status}' → '{new_status}'. "
                       f"Allowed: {[s.value for s in __import__('app.schemas.ticket', fromlist=['VALID_TRANSITIONS']).VALID_TRANSITIONS.get(__import__('app.schemas.ticket', fromlist=['Status']).Status(current_status), [])]}"
            )

        fields["status"] = new_status
        history.append(_history_entry(changed_by, "status", current_status, new_status))

    # ── Priority update ───────────────────────────────────────────────────────
    if updates.priority is not None:
        current_priority = ticket.get("priority", Priority.medium.value)
        new_priority     = updates.priority.value

        if new_priority != current_priority:
            fields["priority"] = new_priority
            history.append(_history_entry(changed_by, "priority", current_priority, new_priority))

    if not fields:
        raise HTTPException(status_code=400, detail="No changes to make")

    fields["updated_at"] = _now()

    # Build MongoDB update — set fields + push history entries
    update_op = {"$set": fields}
    if history:
        update_op["$push"] = {"history": {"$each": history}}

    await col.update_one({"_id": ticket_id}, update_op)
    return {"message": "Ticket updated", "changes": list(fields.keys())}


# ── Assign ────────────────────────────────────────────────────────────────────

async def assign_ticket(
    ticket_id: str,
    assign_data: TicketAssign,
    changed_by: str,
) -> dict:
    """
    Assign a ticket to a support agent.
    Records who made the assignment in history.
    """
    col    = get_db().tickets_col
    ticket = await col.find_one({"_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Verify the agent exists in users collection
    users_col = get_db().users_col
    agent     = await users_col.find_one({"_id": assign_data.assigned_to})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.get("role") not in ["support_agent", "admin"]:
        raise HTTPException(status_code=400, detail="User is not a support agent or admin")

    old_assigned = ticket.get("assigned_to") or "unassigned"
    history_entry = _history_entry(
        changed_by, "assigned_to", old_assigned, assign_data.assigned_to
    )

    await col.update_one(
        {"_id": ticket_id},
        {
            "$set":  {"assigned_to": assign_data.assigned_to, "updated_at": _now()},
            "$push": {"history": history_entry},
        }
    )
    return {"message": "Ticket assigned", "assigned_to": assign_data.assigned_to}


# ── Delete ────────────────────────────────────────────────────────────────────

async def delete_ticket(ticket_id: str) -> dict:
    """
    Delete a ticket permanently.
    Also deletes all chat history linked to this ticket.
    """
    col = get_db().tickets_col

    ticket = await col.find_one({"_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Delete linked chat history first
    chat_col = get_db().chat_col
    await chat_col.delete_many({"ticket_id": ticket_id})

    # Delete the ticket
    await col.delete_one({"_id": ticket_id})
    return {"message": "Ticket and related chat history deleted"}