import os
import json
from dotenv import load_dotenv
from google import genai

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

SYSTEM_PROMPT = """
You are a helpful customer support assistant.
Provide clear, concise, and professional responses.
"""


async def generate_ai_response(user_message: str) -> str:
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"{SYSTEM_PROMPT}\n\nUser: {user_message}",
        )
        return response.text
    except Exception as e:
        return f"AI service error: {str(e)}"


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

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        return response.text

    except Exception as e:
        return f"AI service error: {str(e)}"


async def summarize_conversation(
    conversation_history: list,
) -> str:
    try:
        prompt = "Summarize this support conversation:\n\n"

        for msg in conversation_history:
            prompt += f"{msg['role']}: {msg['content']}\n"

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        return response.text

    except Exception as e:
        return f"Summary generation error: {str(e)}"
    
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

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
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