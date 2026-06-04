from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from app.schemas.ticket import TicketCreate, TicketUpdate, TicketAssign, TicketReassign
from app.services.ticket_service import (
    create_ticket,
    get_ticket_by_id,
    list_tickets,
    get_ticket_stats,
    update_ticket,
    assign_ticket,
    reassign_ticket,
    unassign_ticket,
    get_agent_tickets,
    get_agent_workload,
    delete_ticket,
    search_tickets,
)
from app.utils.dependencies import get_current_user, require_role
from app.utils.roles import Role

router = APIRouter(tags=["tickets"])



@router.post("/")
async def create_ticket_route(
    ticket: TicketCreate,
    current_user: dict = Depends(get_current_user),
):
    """Any authenticated user can create a ticket."""
    return await create_ticket(ticket, user_id=current_user["id"])



@router.get("/stats")
async def ticket_stats(
    current_user: dict = Depends(require_role(Role.admin, Role.support_agent)),
):
    """Ticket counts by status. Admin and Support Agent only."""
    return await get_ticket_stats()


@router.get("/workload")
async def agent_workload_route(
    current_user: dict = Depends(require_role(Role.admin, Role.support_agent)),
):
    """Get open ticket count per agent. Sorted least busy first."""
    return await get_agent_workload()


@router.get("/agent/{agent_id}")
async def agent_tickets_route(
    agent_id:     str,
    current_user: dict = Depends(require_role(Role.admin, Role.support_agent)),
):
    """Get all tickets assigned to a specific agent, grouped by status."""
    return await get_agent_tickets(agent_id)



@router.get("/")
async def list_tickets_route(
    status:      Optional[str] = Query(None, description="Filter by status"),
    priority:    Optional[str] = Query(None, description="Filter by priority"),
    assigned_to: Optional[str] = Query(None, description="Filter by assigned agent"),
    page:        int           = Query(1,   ge=1,       description="Page number"),
    limit:       int           = Query(10,  ge=1, le=100, description="Items per page"),
    current_user: dict = Depends(get_current_user),
):
    """
    List tickets with optional filtering and pagination.
    Admin/Agent — all tickets. Customer — own tickets only.
    """
    return await list_tickets(
        user_id=current_user["id"],
        role=current_user["role"],
        status=status,
        priority=priority,
        assigned_to=assigned_to,
        page=page,
        limit=limit,
    )

@router.get("/search")
async def search_tickets_route(
    search:         Optional[str] = Query(None, description="Keyword search in title/description"),
    customer_email: Optional[str] = Query(None, description="Filter by customer email"),
    status:         Optional[str] = Query(None, description="Filter by status"),
    priority:       Optional[str] = Query(None, description="Filter by priority"),
    assigned_to:    Optional[str] = Query(None, description="Filter by assigned agent ID"),
    sort_by:        str           = Query("created_at", description="Sort field: created_at, priority, status"),
    sort_order:     str           = Query("desc", description="Sort order: asc or desc"),
    page:           int           = Query(1,  ge=1, description="Page number"),
    limit:          int           = Query(10, ge=1, le=100, description="Items per page"),
    current_user:   dict          = Depends(require_role(Role.admin, Role.support_agent)),
):
    """Advanced search with keyword search, customer email lookup, 
    filtering, sorting, and pagination. Admin/Agent only."""
    return await search_tickets(
        search=search,
        customer_email=customer_email,
        status=status,
        priority=priority,
        assigned_to=assigned_to,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        limit=limit,
    )


@router.get("/{ticket_id}")
async def get_ticket_route(
    ticket_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Get a single ticket by ID.
    Admin/Agent — any ticket. Customer — only their own.
    """
    ticket = await get_ticket_by_id(ticket_id)
    role   = current_user.get("role")
    if role == Role.customer and ticket["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied. You can only view your own tickets."
        )
    return ticket



@router.patch("/{ticket_id}")
async def update_ticket_route(
    ticket_id: str,
    updates:   TicketUpdate,
    current_user: dict = Depends(require_role(Role.admin, Role.support_agent)),
):
    """
    Update ticket status or priority. Admin and Support Agent only.
    Status changes are validated against allowed lifecycle transitions.
    All changes are recorded in ticket history.
    """
    return await update_ticket(
        ticket_id=ticket_id,
        updates=updates,
        changed_by=current_user["id"],
    )



@router.patch("/{ticket_id}/assign")
async def assign_ticket_route(
    ticket_id:   str,
    assign_data: TicketAssign,
    current_user: dict = Depends(require_role(Role.admin, Role.support_agent)),
):
    """
    Assign a ticket to a support agent.
    Admin and Support Agent only. Validates the agent exists.
    """
    return await assign_ticket(
        ticket_id=ticket_id,
        assign_data=assign_data,
        changed_by=current_user["id"],
    )



@router.patch("/{ticket_id}/reassign")
async def reassign_ticket_route(
    ticket_id:     str,
    reassign_data: TicketReassign,
    current_user:  dict = Depends(require_role(Role.admin, Role.support_agent)),
):
    """
    Reassign a ticket to a different agent with a reason.
    Records old agent, new agent and reason in history.
    """
    return await reassign_ticket(
        ticket_id=ticket_id,
        reassign_data=reassign_data,
        changed_by=current_user["id"],
    )



@router.patch("/{ticket_id}/unassign")
async def unassign_ticket_route(
    ticket_id:    str,
    current_user: dict = Depends(require_role(Role.admin, Role.support_agent)),
):
    """Remove the assigned agent from a ticket. Admin and Support Agent only."""
    return await unassign_ticket(
        ticket_id=ticket_id,
        changed_by=current_user["id"],
    )



@router.delete("/{ticket_id}")
async def delete_ticket_route(
    ticket_id: str,
    current_user: dict = Depends(require_role(Role.admin)),
):
    """Permanently delete a ticket and all its chat history. Admin only."""
    return await delete_ticket(ticket_id)