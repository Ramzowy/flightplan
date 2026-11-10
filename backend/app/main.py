import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api import (
    auth,
    billing,
    clinical,
    clinician,
    integrations,
    journey,
    notes,
    outlook,
    patients,
    preferences,
    questions,
    rounds,
)
from app.config import get_settings
from app.database import SessionLocal

logger = logging.getLogger("flightplan")

app = FastAPI(
    title="FlightPlan API",
    description="Family-facing care journey API. Demo build: all patient data is fictional.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"
for module in (
    auth, patients, journey, clinical, questions, rounds, clinician, notes, outlook, billing,
    preferences, integrations
):
    app.include_router(module.router, prefix=API_PREFIX)


@app.exception_handler(NotImplementedError)
async def not_implemented_handler(_: Request, exc: NotImplementedError) -> JSONResponse:
    return JSONResponse(status_code=503, content={"detail": str(exc) or "Not implemented."})


@app.exception_handler(Exception)
async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
    # Log the type and path only: never request bodies, tokens or patient data.
    logger.error("Unhandled %s on %s %s", type(exc).__name__, request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


@app.get("/health", tags=["health"])
def health() -> JSONResponse:
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(status_code=503, content={"status": "error", "database": "unavailable"})
    return JSONResponse({"status": "ok", "database": "ok"})
