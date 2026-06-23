from fastapi import APIRouter, Depends, HTTPException, status
from app.utils.dependencies import get_current_user
from app.services.notification_service import (
    list_notifications,
    mark_all_read,
    mark_read
)

router = APIRouter(tags=["notifications"])

@router.get("/")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    """Fetch notifications for the currently logged-in user."""
    return await list_notifications(user_id=current_user["id"])

@router.post("/mark-all-read")
async def mark_notifications_all_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read for the currently logged-in user."""
    return await mark_all_read(user_id=current_user["id"])

@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark a specific notification as read."""
    return await mark_read(notification_id=notification_id, user_id=current_user["id"])
