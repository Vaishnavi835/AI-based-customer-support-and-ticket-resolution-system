import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)

async def generate_ai_response(user_message: str) -> str:
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=(
            "You are a helpful customer support assistant. "
            "Answer clearly, politely, and keep responses useful for support tickets.\n\n"
            f"User: {user_message}"
        ),
    )

    return response.text