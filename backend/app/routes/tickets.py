from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from app.schemas.ticket import TicketCreate, TicketUpdate, TicketAssign
from app.services.ticket_service import (
    create_ticket,
    get_ticket_by_id,
    list_tickets,
    get_ticket_stats,
    update_ticket,
    assign_ticket,
    delete_ticket,
)
from app.utils.dependencies import get_current_user, require_role
from app.utils.roles import Role

router = APIRouter(tags=["tickets"])


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("/")
async def create_ticket_route(
    ticket: TicketCreate,
    current_user: dict = Depends(get_current_user),
):
    """Any authenticated user can create a ticket."""
    return await create_ticket(ticket, user_id=current_user["id"])


# ── Read — stats (must be before /{ticket_id}) ────────────────────────────────

@router.get("/stats")
async def ticket_stats(
    current_user: dict = Depends(require_role(Role.admin, Role.support_agent)),
):
    """Ticket counts by status. Admin and Support Agent only."""
    return await get_ticket_stats()


# ── Read — list with filters ──────────────────────────────────────────────────

@router.get("/")
async def list_tickets_route(
    status:      Optional[str] = Query(None, description="Filter by status"),
    priority:    Optional[str] = Query(None, description="Filter by priority"),
    assigned_to: Optional[str] = Query(None, description="Filter by assigned agent"),
    page:        int           = Query(1,    ge=1,  description="Page number"),
    limit:       int           = Query(10,   ge=1, le=100, description="Items per page"),
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


# ── Read — single ticket ──────────────────────────────────────────────────────

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


# ── Update — status/priority ──────────────────────────────────────────────────

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


# ── Assign ────────────────────────────────────────────────────────────────────

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


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{ticket_id}")
async def delete_ticket_route(
    ticket_id: str,
    current_user: dict = Depends(require_role(Role.admin)),
):
    """
    Permanently delete a ticket and all its chat history. Admin only.
    """
    return await delete_ticket(ticket_id)