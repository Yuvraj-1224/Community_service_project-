"""AgroVision AI – FastAPI application entry point.

Run (from backend/):  uvicorn app.main:app --reload
Swagger docs:         http://localhost:8000/docs
"""
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import admin, auth, dashboard, detection, diseases, users
from app.core.config import settings
from app.core.logging import setup_logging
from app.database.init_db import init_db
from app.utils.errors import register_exception_handlers
from app.utils.responses import ok

setup_logging(logging.DEBUG if settings.DEBUG else logging.INFO)
logger = logging.getLogger("agrovision")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    init_db()
    if settings.SECRET_KEY.startswith("change-me") and settings.ENVIRONMENT == "production":
        raise RuntimeError("SECRET_KEY must be set in production")
    logger.info("%s started (env=%s)", settings.APP_NAME, settings.ENVIRONMENT)
    yield


app = FastAPI(
    title="AgroVision AI API",
    description="Smart Plant Disease Detection & Farmer Assistance System",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept-Language"],
    expose_headers=["Content-Disposition"],
)
register_exception_handlers(app)


@app.middleware("http")
async def access_log(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    # Only method/path/status are logged – never headers (tokens) or bodies (passwords).
    logger.info("%s %s -> %s (%.0f ms)", request.method, request.url.path, response.status_code,
                (time.perf_counter() - start) * 1000)
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


for r in (auth, detection, diseases, dashboard, users, admin):
    app.include_router(r.router, prefix=settings.API_PREFIX)


@app.get(f"{settings.API_PREFIX}/health", tags=["System"])
def health():
    return ok({"status": "ok", "app": settings.APP_NAME})
