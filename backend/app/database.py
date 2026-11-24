"""SQLAlchemy engine, session factory, and declarative base."""

from sqlalchemy import event, create_engine
from collections.abc import Generator

from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import DATABASE_URL

# For SQLite: use check_same_thread=False so FastAPI (threaded) can share
# the connection.  When we switch to PostgreSQL this kwarg is ignored.
connect_args: dict = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(DATABASE_URL, connect_args=connect_args, echo=False)

# Enable foreign-key enforcement for SQLite (off by default).
@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, _connection_record):  # type: ignore[no-untyped-def]
    if DATABASE_URL.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency – yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

