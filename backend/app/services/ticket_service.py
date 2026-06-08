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
    TicketCreate, TicketUpdate, TicketAssign, TicketReassign,
    Status, Priority, is_valid_transition, VALID_TRANSITIONS,
)
from app.services.ai_service import classify_ticket
from pymongo import ASCENDING, DESCENDING

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




async def create_ticket(ticket: TicketCreate, user_id: str) -> dict:
    """
    Create a new support ticket.
    - user_id always comes from the authenticated user's token
    - Status starts as 'open' always
    - history starts empty
    """
    col = get_db().tickets_col

    classification = await classify_ticket(
    ticket.title,
    ticket.description,
)
    doc = {
        "_id":         str(uuid.uuid4()),
        "title":       ticket.title,
        "description": ticket.description,
        "category": classification["category"],
        "priority": classification["priority"],
        "urgency": classification["urgency"],
        "sentiment": classification["sentiment"],
        "customer_mood": classification["customer_mood"],
        "escalation_risk": classification["escalation_risk"],
        "user_id":     user_id,
        "assigned_to": None,
        "status":      Status.open.value,
        "created_at":  _now(),
        "updated_at":  None,
        "history":     [],
    }
    await col.insert_one(doc)
    return {"message": "Ticket created", "id": doc["_id"]}



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
    """
    col = get_db().tickets_col

    # Base query — role-based filtering
    query = {}
    if role == "customer":
        query["user_id"] = user_id

    # Optional filters
    if status:
        try:
            Status(status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
        query["status"] = status

    if priority:
        try:
            Priority(priority)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid priority: {priority}")
        query["priority"] = priority

    if assigned_to and role != "customer":
        query["assigned_to"] = assigned_to

    # Pagination
    skip  = (page - 1) * limit
    total = await col.count_documents(query)

    tickets = await col.find(query).sort("created_at", DESCENDING).skip(skip).limit(limit).to_list(limit)

    for t in tickets:
        t["id"] = t.pop("_id")

    return {
        "tickets":     tickets,
        "total":       total,
        "page":        page,
        "limit":       limit,
        "total_pages": (total + limit - 1) // limit,
    }


async def get_ticket_stats() -> dict:
    """Return ticket counts by status and high-priority count. Admin only."""
    col = get_db().tickets_col

    total          = await col.count_documents({})
    open_count     = await col.count_documents({"status": Status.open.value})
    pending_count  = await col.count_documents({"status": Status.pending.value})
    escalated_count = await col.count_documents({"status": Status.escalated.value})
    resolved_count = await col.count_documents({"status": Status.resolved.value})
    closed_count   = await col.count_documents({"status": Status.closed.value})
    high_prio      = await col.count_documents({"priority": Priority.high.value})

    return {
        "total":         total,
        "open":          open_count,
        "pending":       pending_count,
        "escalated":     escalated_count,
        "resolved":      resolved_count,
        "closed":        closed_count,
        "high_priority": high_prio,
    }



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

    if updates.status is not None:
        current_status = ticket.get("status", Status.open.value)
        new_status     = updates.status.value

        if new_status == current_status:
            raise HTTPException(
                status_code=400,
                detail=f"Ticket is already '{current_status}'"
            )

        if not is_valid_transition(current_status, new_status):
            allowed = [s.value for s in VALID_TRANSITIONS.get(Status(current_status), [])]
            raise HTTPException(
                status_code=400,
                detail=f"Invalid transition: '{current_status}' → '{new_status}'. Allowed: {allowed}"
            )

        fields["status"] = new_status
        history.append(_history_entry(changed_by, "status", current_status, new_status))

    if updates.priority is not None:
        current_priority = ticket.get("priority", Priority.medium.value)
        new_priority     = updates.priority.value

        if new_priority != current_priority:
            fields["priority"] = new_priority
            history.append(_history_entry(changed_by, "priority", current_priority, new_priority))

    if not fields:
        raise HTTPException(status_code=400, detail="No changes to make")

    fields["updated_at"] = _now()

    update_op = {"$set": fields}
    if history:
        update_op["$push"] = {"history": {"$each": history}}

    await col.update_one({"_id": ticket_id}, update_op)
    return {"message": "Ticket updated", "changes": list(fields.keys())}



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

    users_col = get_db().users_col
    agent     = await users_col.find_one({"_id": assign_data.assigned_to})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.get("role") not in ["support_agent", "admin"]:
        raise HTTPException(status_code=400, detail="User is not a support agent or admin")

    old_assigned  = ticket.get("assigned_to") or "unassigned"
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



async def delete_ticket(ticket_id: str) -> dict:
    """
    Delete a ticket permanently.
    Also deletes all chat history linked to this ticket.
    """
    col    = get_db().tickets_col
    ticket = await col.find_one({"_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    chat_col = get_db().chat_col
    await chat_col.delete_many({"ticket_id": ticket_id})
    await col.delete_one({"_id": ticket_id})
    return {"message": "Ticket and related chat history deleted"}


async def reassign_ticket(
    ticket_id: str,
    reassign_data: TicketReassign,
    changed_by: str,
) -> dict:
    """
    Reassign a ticket from one agent to another.
    Records the old agent, new agent, and reason in history.
    """
    col    = get_db().tickets_col
    ticket = await col.find_one({"_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    current_agent = ticket.get("assigned_to")
    if not current_agent:
        raise HTTPException(
            status_code=400,
            detail="Ticket is not assigned to anyone. Use assign instead."
        )

    if current_agent == reassign_data.assigned_to:
        raise HTTPException(
            status_code=400,
            detail="Ticket is already assigned to this agent."
        )

    # Validate new agent exists and has correct role
    users_col = get_db().users_col
    new_agent = await users_col.find_one({"_id": reassign_data.assigned_to})
    if not new_agent:
        raise HTTPException(status_code=404, detail="New agent not found")
    if new_agent.get("role") not in ["support_agent", "admin"]:
        raise HTTPException(status_code=400, detail="User is not a support agent or admin")

    history_entry = _history_entry(
        changed_by,
        "assigned_to",
        current_agent,
        f"{reassign_data.assigned_to} (reason: {reassign_data.reason})"
    )

    await col.update_one(
        {"_id": ticket_id},
        {
            "$set":  {"assigned_to": reassign_data.assigned_to, "updated_at": _now()},
            "$push": {"history": history_entry},
        }
    )
    return {
        "message":      "Ticket reassigned",
        "from_agent":   current_agent,
        "to_agent":     reassign_data.assigned_to,
        "reason":       reassign_data.reason,
    }



async def unassign_ticket(ticket_id: str, changed_by: str) -> dict:
    """Remove the assigned agent from a ticket."""
    col    = get_db().tickets_col
    ticket = await col.find_one({"_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    current_agent = ticket.get("assigned_to")
    if not current_agent:
        raise HTTPException(
            status_code=400,
            detail="Ticket is not assigned to anyone."
        )

    history_entry = _history_entry(
        changed_by, "assigned_to", current_agent, "unassigned"
    )

    await col.update_one(
        {"_id": ticket_id},
        {
            "$set":  {"assigned_to": None, "updated_at": _now()},
            "$push": {"history": history_entry},
        }
    )
    return {"message": "Ticket unassigned", "previous_agent": current_agent}



async def get_agent_tickets(agent_id: str) -> dict:
    """Get all tickets assigned to a specific agent, grouped by status."""
    users_col = get_db().users_col
    agent     = await users_col.find_one({"_id": agent_id})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.get("role") not in ["support_agent", "admin"]:
        raise HTTPException(status_code=400, detail="User is not a support agent or admin")

    col     = get_db().tickets_col
    tickets = await col.find({"assigned_to": agent_id}).to_list(200)
    for t in tickets:
        t["id"] = t.pop("_id")

    # Group by status
    grouped = {"open": [], "pending": [], "escalated": [], "resolved": [], "closed": []}
    for t in tickets:
        status = t.get("status", "open")
        if status in grouped:
            grouped[status].append(t)

    return {
        "agent_id":   agent_id,
        "agent_name": agent.get("name"),
        "total":      len(tickets),
        "tickets":    grouped,
    }



async def get_agent_workload() -> list:
    """
    Get open ticket count for every support agent.
    Useful for admins to balance workload before assigning.
    """
    users_col = get_db().users_col
    agents    = await users_col.find(
        {"role": {"$in": ["support_agent", "admin"]}}
    ).to_list(100)

    col      = get_db().tickets_col
    workload = []

    for agent in agents:
        agent_id    = agent["_id"]
        open_count  = await col.count_documents({
            "assigned_to": agent_id,
            "status":      {"$in": ["open", "pending", "escalated"]}
        })
        total_count = await col.count_documents({"assigned_to": agent_id})

        workload.append({
            "agent_id":     agent_id,
            "agent_name":   agent.get("name"),
            "email":        agent.get("email"),
            "role":         agent.get("role"),
            "open_tickets": open_count,
            "total_tickets": total_count,
        })

    # Sort by open tickets ascending — least busy first
    workload.sort(key=lambda x: x["open_tickets"])
    return workload

async def search_tickets(
    search: str = None,
    customer_email: str = None,
    status: str = None,
    priority: str = None,
    assigned_to: str = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = 1,
    limit: int = 10,
) -> dict:
    """
    Advanced ticket search with:
    - Keyword search (title/description)
    - Customer email lookup
    - Status/priority/agent filtering
    - Sorting
    - Pagination
    """
    col = get_db().tickets_col
    query = {}

    # --- 1. Keyword search in title and description ---
    if search:
        query["$or"] = [
            {"title":       {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]

    # --- 2. Search by customer email (cross-collection lookup) ---
    if customer_email:
        users_col = get_db().users_col
        user = await users_col.find_one({"email": customer_email})
        if not user:
            raise HTTPException(status_code=404, detail=f"No customer found with email: {customer_email}")
        query["user_id"] = user["_id"]

    # --- 3. Filter by status ---
    if status:
        try:
            Status(status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
        query["status"] = status

    # --- 4. Filter by priority ---
    if priority:
        try:
            Priority(priority)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid priority: {priority}")
        query["priority"] = priority

    # --- 5. Filter by assigned agent ---
    if assigned_to:
        query["assigned_to"] = assigned_to

    # --- 6. Sorting ---
    allowed_sort_fields = ["created_at", "priority", "status", "updated_at"]
    if sort_by not in allowed_sort_fields:
        sort_by = "created_at"

    from pymongo import ASCENDING, DESCENDING
    direction = ASCENDING if sort_order == "asc" else DESCENDING

    # --- 7. Pagination ---
    skip  = (page - 1) * limit
    total = await col.count_documents(query)

    tickets = await col.find(query).sort(sort_by, direction).skip(skip).limit(limit).to_list(limit)

    for t in tickets:
        t["id"] = t.pop("_id")

    return {
        "tickets":     tickets,
        "total":       total,
        "page":        page,
        "limit":       limit,
        "total_pages": (total + limit - 1) // limit,
        "filters_applied": {
            "search":         search,
            "customer_email": customer_email,
            "status":         status,
            "priority":       priority,
            "assigned_to":    assigned_to,
            "sort_by":        sort_by,
            "sort_order":     sort_order,
        }
    }
