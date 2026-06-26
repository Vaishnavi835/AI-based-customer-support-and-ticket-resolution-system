from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.database.connection import connect_db, disconnect_db
from app.routes.users   import router as users_router
from app.routes.tickets import router as tickets_router
from app.routes.chat    import router as chat_router
from app.routes.auth    import router as auth_router
from app.routes.escalation import router as escalation_router
from app.services.rag_service import initialize_rag
from app.routes.rag import router as rag_router
from app.services.kb_service import seed_knowledge_base 
from app.routes.websocket import router as websocket_router
from app.routes.notifications import router as notifications_router 
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.utils.rate_limiter import limiter

import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI Support System...")
    await connect_db()
    await seed_knowledge_base()
    await initialize_rag()
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

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Fix #6: Register rate limiter with the app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error["loc"])
        errors.append({
            "field": field,
            "message": error["msg"],
            "type": error["type"],
        })
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Validation failed",
            "errors": errors,
        },
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again later."},
    )

app.include_router(auth_router,    prefix="/auth")
app.include_router(users_router,   prefix="/users")
app.include_router(tickets_router, prefix="/tickets")
app.include_router(chat_router,    prefix="/chat")
app.include_router(escalation_router, prefix="/escalation")
app.include_router(rag_router, prefix="/rag")
app.include_router(websocket_router, prefix="/ws")
app.include_router(notifications_router, prefix="/notifications")
@app.get("/")
async def root():
    return {"status": "running", "app": "AI Support System", "version": "1.0.0", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "ok"}