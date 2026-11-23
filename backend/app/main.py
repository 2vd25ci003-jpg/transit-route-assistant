"""Transit Route Assistant – FastAPI application."""

from fastapi import FastAPI

app = FastAPI(
    title="Transit Route Assistant API",
    version="0.1.0",
)


@app.get("/health")
async def health() -> dict:
    """Liveness check."""
    return {"status": "ok"}

