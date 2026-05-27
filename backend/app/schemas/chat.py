from pydantic import BaseModel
from typing import List
from datetime import datetime


class ChatMessage(BaseModel):
    role:    str
    content: str


class ChatCreate(BaseModel):
    ticket_id: str
    user_id:   str
    message:   str


class ChatResponse(BaseModel):
    id:         str
    ticket_id:  str
    user_id:    str
    messages:   List[ChatMessage]
    created_at: datetime