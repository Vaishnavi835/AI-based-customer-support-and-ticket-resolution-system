import os
import json
import asyncio
import logging
from dotenv import load_dotenv
from google import genai

load_dotenv()

logger = logging.getLogger(__name__)

# ── Fix #5: Validate GEMINI_API_KEY at startup ────────────────────────────────
_gemini_api_key = os.getenv("GEMINI_API_KEY")
if not _gemini_api_key:
    raise RuntimeError(
        "GEMINI_API_KEY environment variable is not set. "
        "Please set it in your .env file or environment before starting the server."
    )

client = genai.Client(api_key=_gemini_api_key)

SYSTEM_PROMPT = """
You are a helpful customer support assistant.
First, determine if you have enough details from the customer to understand their specific issue.
If their request is vague or lacks necessary details, politely ask clarifying questions before attempting to provide a solution.
Once you have enough details, provide clear, concise, and professional responses.
"""


# ── Fix #1: All Gemini calls wrapped in run_in_executor ───────────────────────

async def generate_ai_response(user_message: str) -> str:
    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.models.generate_content(
                model="gemini-2.5-flash",
                contents=f"{SYSTEM_PROMPT}\n\nUser: {user_message}",
            ),
        )
        return response.text
    except Exception as e:
        raise e


async def generate_contextual_response(
    conversation_history: list,
    ticket_context: dict = None,
) -> str:
    try:
        prompt = SYSTEM_PROMPT + "\n\n"

        if ticket_context:
            prompt += f"""
Ticket Information:
Title: {ticket_context.get("title", "")}
Description: {ticket_context.get("description", "")}
Status: {ticket_context.get("status", "")}

"""

        prompt += "Conversation History:\n"

        for msg in conversation_history:
            prompt += f"{msg['role']}: {msg['content']}\n"

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
            ),
        )

        return response.text

    except Exception as e:
        raise e


async def summarize_conversation(
    conversation_history: list,
) -> str:
    try:
        prompt = "Summarize this support conversation:\n\n"

        for msg in conversation_history:
            prompt += f"{msg['role']}: {msg['content']}\n"

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
            ),
        )

        return response.text

    except Exception as e:
        raise e
    
async def classify_ticket(
    title: str,
    description: str,
) -> dict:
    try:
        prompt = f"""
You are a support ticket classifier.

Analyze the ticket and return ONLY valid JSON.

Allowed categories:
- authentication
- billing
- technical
- account
- finance
- general

Allowed priorities:
- low
- medium
- high

Allowed urgencies:
- low
- medium
- high

Allowed sentiments:
- positive
- negative
- neutral

Allowed customer moods:
- calm
- frustrated
- angry

Allowed escalation risks:
- low
- medium
- high

Title:
{title}

Description:
{description}

Return:

{{
  "category": "",
  "priority": "",
  "urgency": "",
  "sentiment": "",
  "customer_mood": "",
  "escalation_risk": ""
}}
"""

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
            ),
        )

        clean_text = (
            response.text
            .replace("```json", "")
            .replace("```", "")
            .strip()
        )

        result = json.loads(clean_text)

        

        return result

    except Exception as e:
        return {
            "category": "general",
            "priority": "medium",
            "urgency": "medium",
            "sentiment":       "neutral",
            "customer_mood":   "calm",
            "escalation_risk": "low",
        }