from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.services.websocket_manager import manager
from app.utils.jwt import verify_access_token
from app.database.connection import get_db
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.websocket("")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    """
    WebSocket endpoint that authenticates connections using JWT token
    passed in query parameters, e.g. ws://localhost:8000/ws?token=<token>
    """
    try:
        # Authenticate JWT token
        payload = verify_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            logger.error("WebSocket auth error: Sub claim missing in payload")
            await websocket.close(code=4003)
            return
            
        # Retrieve user role from database
        db = get_db()
        user = await db.users_col.find_one({"_id": user_id})
        if not user:
            logger.error(f"WebSocket auth error: User {user_id} not found in DB")
            await websocket.close(code=4004)
            return
            
        role = user.get("role", "customer")
    except Exception as e:
        logger.error(f"WebSocket authentication failed: {e}")
        await websocket.close(code=4003)
        return

    # Connection accepted & registered in manager
    await manager.connect(websocket, user_id, role)
    
    try:
        while True:
            # Wait for any text data (e.g. pings) from the client to keep connection alive
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        manager.disconnect(websocket, user_id)
