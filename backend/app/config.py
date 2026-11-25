"""Application configuration loaded from environment / .env file."""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the backend directory (one level above app/)
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)

DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "sqlite:///./transit.db",
)

CORS_ORIGINS: list[str] = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

ADMIN_API_KEY: str = os.getenv("ADMIN_API_KEY", "transit-admin-dev-key")
