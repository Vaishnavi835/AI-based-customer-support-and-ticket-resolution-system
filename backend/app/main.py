from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.database.connection import connect_db, disconnect_db
from app.routes.users   import router as users_router
from app.routes.tickets import router as tickets_router
from app.routes.chat    import router as chat_router
from app.routes.auth    import router as auth_router
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI Support System...")
    await connect_db()
    logger.info("Application ready")
    yield
    logger.info("Shutting down...")
    await disconnect_db()
    logger.info("Application stopped")


app = FastAPI(
    title="AI Customer Support System",
    description="FastAPI + MongoDB backend for AI customer support",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(auth_router,    prefix="/auth")
app.include_router(users_router,   prefix="/users")
app.include_router(tickets_router, prefix="/tickets")
app.include_router(chat_router,    prefix="/chat")


@app.get("/")
async def root():
    return {"status": "running", "app": "AI Support System", "version": "1.0.0", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "ok"}