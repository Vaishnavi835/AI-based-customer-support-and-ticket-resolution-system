from fastapi import FastAPI
from app.routes.users   import router as users_router
from app.routes.tickets import router as tickets_router
from app.routes.chat    import router as chat_router

app = FastAPI(
    title="AI Customer Support System",
    description="FastAPI + MongoDB backend for AI customer support",
    version="1.0.0",
)

app.include_router(users_router,   prefix="/users")
app.include_router(tickets_router, prefix="/tickets")
app.include_router(chat_router,    prefix="/chat")


@app.get("/")
async def root():
    return {
        "status":  "running",
        "app":     "AI Support System",
        "version": "1.0.0",
        "docs":    "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}