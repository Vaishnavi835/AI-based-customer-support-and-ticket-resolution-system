import uuid
import logging
from datetime import datetime, timezone
from app.database.connection import get_db
from app.services.websocket_manager import manager

logger = logging.getLogger(__name__)

def _now():
    return datetime.now(timezone.utc)

async def create_notification(user_id: str, text: str, ticket_id: str = None) -> dict:
    """Create a notification in the database and send it via WebSocket if active."""
    col = get_db().notifications_col
    
    doc = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "text": text,
        "ticket_id": ticket_id,
        "unread": True,
        "created_at": _now()
    }
    
    await col.insert_one(doc)
    
    # Format document to serialize dates properly for WS
    serialized_doc = doc.copy()
    serialized_doc["id"] = serialized_doc.pop("_id")
    serialized_doc["created_at"] = serialized_doc["created_at"].isoformat()
    
    # Dispatch via WebSocket
    await manager.send_personal_message({
        "type": "notification",
        "notification": serialized_doc
    }, user_id)
    
    return serialized_doc

async def notify_agents_and_admins(text: str, ticket_id: str = None):
    """Notify all agents and admins about a system or ticket event."""
    users_col = get_db().users_col
    staff_users = await users_col.find(
        {"role": {"$in": ["admin", "support_agent"]}}
    ).to_list(1000)
    
    for user in staff_users:
        try:
            await create_notification(user["_id"], text, ticket_id)
        except Exception as e:
            logger.error(f"Failed to create notification for staff {user['_id']}: {e}")

async def list_notifications(user_id: str, limit: int = 50) -> list:
    """List recent notifications for a user."""
    col = get_db().notifications_col
    docs = await col.find({"user_id": user_id}).sort("created_at", -1).limit(limit).to_list(limit)
    
    for doc in docs:
        doc["id"] = doc.pop("_id")
        if isinstance(doc["created_at"], datetime):
            doc["created_at"] = doc["created_at"].isoformat()
            
    return docs

async def mark_all_read(user_id: str) -> dict:
    """Mark all notifications for a user as read."""
    col = get_db().notifications_col
    await col.update_many({"user_id": user_id, "unread": True}, {"$set": {"unread": False}})
    return {"message": "All notifications marked as read"}

async def mark_read(notification_id: str, user_id: str) -> dict:
    """Mark a specific notification as read."""
    col = get_db().notifications_col
    result = await col.update_one(
        {"_id": notification_id, "user_id": user_id},
        {"$set": {"unread": False}}
    )
    if result.matched_count == 0:
        return {"message": "Notification not found or access denied"}
    return {"message": "Notification marked as read"}
