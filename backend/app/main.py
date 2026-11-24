"""Transit Route Assistant – FastAPI application."""

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.database import Base, engine


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Create tables on startup (no-op if they already exist)."""
    # Import models so Base.metadata knows about them.
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Transit Route Assistant API",
    version="0.1.0",
    lifespan=lifespan,
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

from app.routers import routes, stops, vehicles  # noqa: E402

app.include_router(stops.router)
app.include_router(routes.router)
app.include_router(vehicles.router)


@app.get("/health")
async def health() -> dict:
    """Liveness check."""
    return {"status": "ok"}
