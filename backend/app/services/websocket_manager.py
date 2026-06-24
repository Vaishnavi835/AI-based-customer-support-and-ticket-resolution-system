from fastapi import WebSocket
import logging
from typing import Dict, List, Set

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # Maps user_id -> set of active WebSockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Maps user_id -> role
        self.user_roles: Dict[str, str] = {}

    async def connect(self, websocket: WebSocket, user_id: str, role: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        self.user_roles[user_id] = role
        logger.info(f"WebSocket connected: user_id={user_id}, role={role}. Total connections for user={len(self.active_connections[user_id])}")

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                self.user_roles.pop(user_id, None)
        logger.info(f"WebSocket disconnected: user_id={user_id}")

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            dead_sockets = set()
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending message to user {user_id}: {e}")
                    dead_sockets.add(connection)
            
            for dead_socket in dead_sockets:
                self.disconnect(dead_socket, user_id)

    async def broadcast(self, message: dict):
        for user_id in list(self.active_connections.keys()):
            await self.send_personal_message(message, user_id)

    async def broadcast_to_role(self, message: dict, role: str):
        for user_id, user_role in list(self.user_roles.items()):
            if user_role == role:
                await self.send_personal_message(message, user_id)

    async def broadcast_to_roles(self, message: dict, roles: List[str]):
        for user_id, user_role in list(self.user_roles.items()):
            if user_role in roles:
                await self.send_personal_message(message, user_id)

# Singleton manager instance
manager = ConnectionManager()
