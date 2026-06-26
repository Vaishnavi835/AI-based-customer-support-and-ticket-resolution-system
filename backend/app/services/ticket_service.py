"""
Ticket Service — business logic layer.

Routes call these functions instead of talking to MongoDB directly.
This separates concerns:
  - Routes handle HTTP (request/response)
  - Services handle business logic (rules, validation, data manipulation)
  - Database handles storage
"""

from fastapi import HTTPException
from datetime import datetime, timezone, timedelta
from app.database.connection import get_db
from app.schemas.ticket import (
    TicketCreate, TicketUpdate, TicketAssign, TicketReassign, TicketUpdateCC,
    Status, Priority, is_valid_transition, VALID_TRANSITIONS,
)
from app.services.ai_service import classify_ticket
from pymongo import ASCENDING, DESCENDING
from app.services.websocket_manager import manager
from app.services.notification_service import create_notification, notify_agents_and_admins

import uuid
import re
import logging

logger = logging.getLogger(__name__)

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


def _format_ticket_for_ws(ticket: dict) -> dict:
    """Format ticket dictionary for websocket transmission (serialize datetimes)."""
    if not ticket:
        return ticket
    formatted = ticket.copy()
    for k, v in formatted.items():
        if isinstance(v, datetime):
            formatted[k] = v.isoformat()
        if k == "history" and isinstance(v, list):
            formatted[k] = [
                {hk: (hv.isoformat() if isinstance(hv, datetime) else hv) for hk, hv in entry.items()}
                for entry in v
            ]
    return formatted

async def _broadcast_ticket_update(ticket_id: str):
    try:
        col = get_db().tickets_col
        ticket = await col.find_one({"_id": ticket_id})
        if ticket:
            ticket["id"] = ticket.pop("_id")
            event = {"type": "ticket_updated", "ticket": _format_ticket_for_ws(ticket)}
            await manager.broadcast(event)
    except Exception as e:
        logger.error(f"Failed to broadcast ticket update: {e}")



async def create_ticket(ticket: TicketCreate, user_id: str) -> dict:
    """
    Create a new support ticket.
    - user_id always comes from the authenticated user's token
    - Status starts as 'open' always (unless it's an incident)
    - history starts empty
    """
    col = get_db().tickets_col
    incident_type = getattr(ticket, "incident_type", "ticket") or "ticket"
    contact_info = getattr(ticket, "contact_info", None)
    attachments = getattr(ticket, "attachments", []) or []

    classification = await classify_ticket(
        ticket.title,
        ticket.description,
        incident_type=incident_type,
    )

    status_val = Status.escalated.value if incident_type == "incident" else Status.open.value
    priority_val = Priority.high.value if incident_type == "incident" else classification["priority"]
    urgency_val = "high" if incident_type == "incident" else classification["urgency"]
    escalation_risk_val = "high" if incident_type == "incident" else classification["escalation_risk"]

    doc = {
        "_id":         str(uuid.uuid4()),
        "title":       ticket.title,
        "description": ticket.description,
        "incident_type": incident_type,
        "contact_info": contact_info,
        "attachments": attachments,
        "category": classification["category"],
        "priority": priority_val,
        "urgency": urgency_val,
        "sentiment": classification["sentiment"],
        "customer_mood": classification["customer_mood"],
        "escalation_risk": escalation_risk_val,
        "user_id":     user_id,
        "assigned_to": None,
        "status":      status_val,
        "created_at":  _now(),
        "updated_at":  None,
        "history":     [],
    }
    await col.insert_one(doc)

    if incident_type == "incident":
        try:
            await notify_agents_and_admins(
                text=f"🚨 New Incident reported: {ticket.title}",
                ticket_id=doc["_id"]
            )
        except Exception as e:
            logger.error(f"Failed to alert agents on new incident creation: {e}")

    return {"message": "Ticket created", "id": doc["_id"]}



async def get_ticket_by_id(ticket_id: str) -> dict:
    """Fetch a single ticket by ID. Raises 404 if not found."""
    col    = get_db().tickets_col
    ticket = await col.find_one({"_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket["id"] = ticket.pop("_id")

    # Add chat history status
    chat_col = get_db().chat_col
    chat = await chat_col.find_one({"ticket_id": ticket["id"]})
    ticket["has_chat"] = chat is not None
    ticket["ai_replied"] = False
    if chat and "messages" in chat and len(chat["messages"]) > 0:
        ticket["ai_replied"] = any(msg.get("response") for msg in chat["messages"])

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

    chat_col = get_db().chat_col
    for t in tickets:
        t["id"] = t.pop("_id")
        chat = await chat_col.find_one({"ticket_id": t["id"]})
        t["has_chat"] = chat is not None
        t["ai_replied"] = False
        if chat and "messages" in chat and len(chat["messages"]) > 0:
            t["ai_replied"] = any(msg.get("response") for msg in chat["messages"])

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

    rating_pipeline = [
        {"$match": {"rating": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": None, "avg_rating": {"$avg": "$rating"}, "count": {"$sum": 1}}}
    ]
    rating_cursor = col.aggregate(rating_pipeline)
    rating_list = await rating_cursor.to_list(1)

    satisfaction = 94
    if rating_list and rating_list[0]["count"] > 0:
        satisfaction = round((rating_list[0]["avg_rating"] / 5.0) * 100)

    return {
        "total":         total,
        "open":          open_count,
        "pending":       pending_count,
        "escalated":     escalated_count,
        "resolved":      resolved_count,
        "closed":        closed_count,
        "high_priority": high_prio,
        "satisfaction_rate": satisfaction,
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

        if new_status in [Status.resolved.value, Status.closed.value]:
            fields["resolved_at"] = _now()
        elif current_status in [Status.resolved.value, Status.closed.value] and new_status not in [Status.resolved.value, Status.closed.value]:
            fields["resolved_at"] = None

    if updates.priority is not None:
        current_priority = ticket.get("priority", Priority.medium.value)
        new_priority     = updates.priority.value

        if new_priority != current_priority:
            fields["priority"] = new_priority
            history.append(_history_entry(changed_by, "priority", current_priority, new_priority))

    if updates.rating is not None:
        if not (1 <= updates.rating <= 5):
            raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
        fields["rating"] = updates.rating
        history.append(_history_entry(changed_by, "rating", ticket.get("rating", "none"), updates.rating))

    if not fields:
        raise HTTPException(status_code=400, detail="No changes to make")

    fields["updated_at"] = _now()

    update_op = {"$set": fields}
    if history:
        update_op["$push"] = {"history": {"$each": history}}

    await col.update_one({"_id": ticket_id}, update_op)
    await _broadcast_ticket_update(ticket_id)
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
    await _broadcast_ticket_update(ticket_id)
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
    await _broadcast_ticket_update(ticket_id)
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
    await _broadcast_ticket_update(ticket_id)
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
    resolved_after: datetime = None,
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
    # Fix #3: Escape user input to prevent ReDoS via MongoDB regex
    if search:
        safe_search = re.escape(search)
        query["$or"] = [
            {"title":       {"$regex": safe_search, "$options": "i"}},
            {"description": {"$regex": safe_search, "$options": "i"}},
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

    # --- 6. Filter by resolved_after ---
    if resolved_after:
        query["resolved_at"] = {"$gte": resolved_after}

    # --- 7. Sorting ---
    allowed_sort_fields = ["created_at", "priority", "status", "updated_at", "resolved_at"]
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
            "resolved_after": resolved_after,
            "sort_by":        sort_by,
            "sort_order":     sort_order,
        }
    }


async def update_ticket_cc(ticket_id: str, data: TicketUpdateCC, changed_by: str, requester_id: str, requester_role: str) -> dict:
    """
    Add or remove an agent from a ticket's CC list.
    Only admins or the assigned agent can modify CCs.
    """
    col = get_db().tickets_col
    ticket = await col.find_one({"_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if requester_role != "admin" and ticket.get("assigned_to") != requester_id:
        raise HTTPException(status_code=403, detail="Only the assigned agent or an admin can manage CCs.")

    users_col = get_db().users_col
    update_op = {"$set": {"updated_at": _now()}}
    history_entry = None

    if data.add_agent_id:
        agent = await users_col.find_one({"_id": data.add_agent_id, "role": {"$in": ["support_agent", "admin"]}})
        if not agent:
            raise HTTPException(status_code=404, detail="Agent to add not found or invalid role")
        if data.add_agent_id == ticket.get("assigned_to"):
            raise HTTPException(status_code=400, detail="Agent is already assigned to this ticket")
            
        update_op["$addToSet"] = {"cc_agents": data.add_agent_id}
        history_entry = _history_entry(changed_by, "cc_agents", "n/a", f"Added {data.add_agent_id}")

    elif data.remove_agent_id:
        update_op["$pull"] = {"cc_agents": data.remove_agent_id}
        history_entry = _history_entry(changed_by, "cc_agents", "n/a", f"Removed {data.remove_agent_id}")

    else:
        raise HTTPException(status_code=400, detail="Must provide add_agent_id or remove_agent_id")

    if history_entry:
        update_op.setdefault("$push", {})["history"] = history_entry

    await col.update_one({"_id": ticket_id}, update_op)
    
    # Broadcast and notify
    try:
        updated_ticket = await get_ticket_by_id(ticket_id)
        event = {"type": "ticket_updated", "ticket": _format_ticket_for_ws(updated_ticket)}
        await manager.broadcast_to_roles(event, ["admin", "support_agent"])
        
        if data.add_agent_id:
            await create_notification(data.add_agent_id, f"You were CC'd on Ticket #{ticket_id[:8]}.", ticket_id)
            cc_event = {"type": "ticket_cc_added", "ticket_id": ticket_id}
            await manager.send_personal_message(cc_event, data.add_agent_id)
    except Exception as e:
        logger.error(f"Failed to broadcast CC update: {e}")

    return {"message": "Ticket CC list updated"}


async def get_cc_tickets(agent_id: str) -> list:
    """Fetch all tickets where the agent is CC'd."""
    col = get_db().tickets_col
    tickets = await col.find({"cc_agents": agent_id}).sort("updated_at", DESCENDING).to_list(100)
    for t in tickets:
        t["id"] = t.pop("_id")
    return tickets


async def get_cc_tickets_count(agent_id: str) -> int:
    """Get the count of tickets where the agent is CC'd."""
    col = get_db().tickets_col
    return await col.count_documents({"cc_agents": agent_id})


async def get_completed_recent_tickets(days: int = 30) -> list:
    """Get tickets resolved or closed in the last N days."""
    col = get_db().tickets_col
    resolved_after = _now() - timedelta(days=days)
    query = {
        "status": {"$in": ["resolved", "closed"]},
        "resolved_at": {"$gte": resolved_after}
    }
    tickets = await col.find(query).sort("resolved_at", DESCENDING).to_list(100)
    for t in tickets:
        t["id"] = t.pop("_id")
    return tickets


async def get_ticket_analytics(days: int = 30) -> dict:
    """
    Get analytics data for reports (Admin and Support Agents).
    Returns volume trends, category distribution, status distribution, and priorities.
    """
    col = get_db().tickets_col
    cutoff_date = _now() - timedelta(days=days)
    
    # 1. Volume Trend (Tickets opened vs resolved per day)
    opened_pipeline = [
        {"$match": {"created_at": {"$gte": cutoff_date}}},
        {
            "$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "opened": {"$sum": 1}
            }
        }
    ]
    opened_cursor = col.aggregate(opened_pipeline)
    opened_data = await opened_cursor.to_list(100)
    
    resolved_pipeline = [
        {"$match": {
            "status": {"$in": ["resolved", "closed"]},
            "resolved_at": {"$gte": cutoff_date}
        }},
        {
            "$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$resolved_at"}},
                "resolved": {"$sum": 1}
            }
        }
    ]
    resolved_cursor = col.aggregate(resolved_pipeline)
    resolved_data = await resolved_cursor.to_list(100)

    date_map = {}
    for doc in opened_data:
        date_map[doc["_id"]] = {"date": doc["_id"], "opened": doc["opened"], "resolved": 0}
    for doc in resolved_data:
        if doc["_id"] not in date_map:
            date_map[doc["_id"]] = {"date": doc["_id"], "opened": 0, "resolved": 0}
        date_map[doc["_id"]]["resolved"] = doc["resolved"]

    filled_trend = []
    for i in range(days + 1):
        d_str = (cutoff_date + timedelta(days=i)).strftime("%Y-%m-%d")
        filled_trend.append(date_map.get(d_str, {"date": d_str, "opened": 0, "resolved": 0}))

    # 2. Category Distribution
    cat_pipeline = [
        {"$group": {"_id": "$category", "value": {"$sum": 1}}},
        {"$sort": {"value": DESCENDING}}
    ]
    cat_cursor = col.aggregate(cat_pipeline)
    cat_data = await cat_cursor.to_list(100)
    categories = [{"name": doc["_id"], "value": doc["value"]} for doc in cat_data]
    
    # 3. Status Distribution
    status_pipeline = [
        {"$group": {"_id": "$status", "value": {"$sum": 1}}}
    ]
    status_cursor = col.aggregate(status_pipeline)
    status_data = await status_cursor.to_list(100)
    statuses = [{"name": doc["_id"], "value": doc["value"]} for doc in status_data]

    # 4. Priority Distribution
    priority_pipeline = [
        {"$group": {"_id": "$priority", "value": {"$sum": 1}}}
    ]
    priority_cursor = col.aggregate(priority_pipeline)
    priority_data = await priority_cursor.to_list(100)
    priorities = [{"name": doc["_id"], "value": doc["value"]} for doc in priority_data]

    return {
        "trend": filled_trend,
        "categories": categories,
        "statuses": statuses,
        "priorities": priorities
    }
