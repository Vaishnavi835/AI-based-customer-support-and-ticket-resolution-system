from fastapi import APIRouter, HTTPException, Depends
from app.schemas.escalation import EscalationCreate, EscalationResolve
from app.services.escalation_service import (
    create_escalation,
    agent_takeover,
    resolve_escalation,
    get_escalation_by_chat,
    list_pending_escalations,
)
from app.utils.dependencies import get_current_user, require_role
from app.utils.roles import Role
from app.database.connection import get_db

router = APIRouter(tags=["escalation"])


@router.post("/")
async def manual_escalate(
    data: EscalationCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Manually escalate a chat to a human agent.
    Any authenticated user can trigger this (customer asking for a human,
    agent flagging a tricky case).
    """
    db   = get_db()
    chat = await db.chat_col.find_one({"_id": data.chat_id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    return await create_escalation(
        chat_id=data.chat_id,
        ticket_id=chat["ticket_id"],
        reason=data.reason,
        triggered_by=current_user["id"],
        note=data.note,
    )


@router.get("/pending")
async def get_pending_escalations(
    current_user: dict = Depends(require_role(Role.admin, Role.support_agent)),
):
    """
    List all pending escalations waiting for an agent.
    Admin and Support Agent only — this is their work queue.
    """
    return await list_pending_escalations()


@router.get("/chat/{chat_id}")
async def get_chat_escalation(
    chat_id:      str,
    current_user: dict = Depends(get_current_user),
):
    """
    Get the current escalation record for a chat.
    Returns 404 if no active/pending escalation exists.
    """
    escalation = await get_escalation_by_chat(chat_id)
    if not escalation:
        raise HTTPException(
            status_code=404,
            detail="No active escalation for this chat."
        )
    return escalation


@router.patch("/chat/{chat_id}/takeover")
async def takeover_chat(
    chat_id:      str,
    current_user: dict = Depends(require_role(Role.admin, Role.support_agent)),
):
    """
    Agent claims an escalated chat.
    Moves escalation status from pending → active.
    AI will no longer auto-reply to this chat.
    """
    return await agent_takeover(
        chat_id=chat_id,
        agent_id=current_user["id"],
    )


@router.patch("/chat/{chat_id}/resolve")
async def resolve_chat_escalation(
    chat_id:      str,
    data:         EscalationResolve = EscalationResolve(),
    current_user: dict = Depends(require_role(Role.admin, Role.support_agent)),
):
    """
    Mark an active escalation as resolved.
    Agent provides an optional resolution note.
    """
    return await resolve_escalation(
        chat_id=chat_id,
        agent_id=current_user["id"],
        resolution_note=data.resolution_note,
    )