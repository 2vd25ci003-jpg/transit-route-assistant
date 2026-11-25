"""Transit Route Assistant – FastAPI application."""

import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import CORS_ORIGINS
from app.database import Base, SessionLocal, engine
from app.services.simulator import realtime_simulator


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Create tables, auto-train missing forecast model, and run real-time simulator."""
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)

    # Auto-train forecast model if missing and boardings exist
    project_root = Path(__file__).resolve().parent.parent.parent
    model_path = project_root / "ml" / "models" / "forecast_rf.joblib"
    if not model_path.exists():
        db = SessionLocal()
        try:
            if db.query(app.models.Boarding).first() is not None:
                if str(project_root) not in sys.path:
                    sys.path.insert(0, str(project_root))
                from ml.train_forecast import train_and_evaluate

                train_and_evaluate()
        finally:
            db.close()

    await realtime_simulator.start_loop(SessionLocal)
    try:
        yield
    finally:
        await realtime_simulator.stop_loop()


app = FastAPI(
    title="Transit Route Assistant API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- Error handlers (consistent {"error": "..."} shape) ----------------


@app.exception_handler(HTTPException)
async def http_exception_handler(
    _request: Request, exc: HTTPException
) -> JSONResponse:
    """Return every HTTP error as ``{"error": "<message>"}``."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Reshape Pydantic validation errors into the standard error envelope."""
    errors = exc.errors()
    msg = "; ".join(
        f"{'.'.join(str(loc) for loc in e.get('loc', []))}: {e.get('msg', '')}"
        for e in errors
    )
    return JSONResponse(status_code=422, content={"error": msg})


# ---- Routers ------------------------------------------------------------

from app.routers import admin, forecast, optimize, routes, stops, vehicles  # noqa: E402

app.include_router(stops.router)
app.include_router(routes.router)
app.include_router(vehicles.router)
app.include_router(forecast.router)
app.include_router(optimize.router)
app.include_router(admin.router)


@app.get("/health")
async def health() -> dict:
    """Liveness check."""
    return {"status": "ok"}
