"""Shared pytest fixtures – in-memory SQLite DB with seed data."""

from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models import Route, RouteStop, Stop, Trip, VehiclePosition


# ---- Engine (session-scoped – one in-memory DB for the whole test run) ---


@pytest.fixture(scope="session")
def test_engine():
    from sqlalchemy import create_engine
    from sqlalchemy.pool import StaticPool

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    @event.listens_for(engine, "connect")
    def _pragma(dbapi_conn, _):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    Base.metadata.create_all(bind=engine)
    return engine


# ---- Seed data -----------------------------------------------------------
#
# 4 stops, 2 routes, 4 trips (3 active + 1 old), 6 vehicle positions.
#
#   Route Alpha : Stop A (seq 1) → Stop B (seq 2) → Stop C (seq 3)
#   Route Beta  : Stop B (seq 1) → Stop C (seq 2) → Stop D (seq 3)
#
#   Trip 1 (Route Alpha, 08:00) – positions at 08:00 and 08:04 (active)
#   Trip 2 (Route Beta,  08:00) – positions at 08:00 and 08:04 (active)
#   Trip 3 (Route Alpha, 07:00) – position  at 07:00 only     (old)
#   Trip 4 (Route Alpha, 08:02) – position  at 08:02 only     (active, 2 stops from C)
#


@pytest.fixture(scope="session")
def _seed(test_engine):
    """Populate the in-memory DB once."""
    Session = sessionmaker(bind=test_engine)
    db = Session()

    # Stops
    s1 = Stop(name="Stop A", lat=15.3647, lng=75.1240)
    s2 = Stop(name="Stop B", lat=15.3580, lng=75.1310)
    s3 = Stop(name="Stop C", lat=15.3530, lng=75.1370)
    s4 = Stop(name="Stop D", lat=15.4580, lng=75.0070)
    db.add_all([s1, s2, s3, s4])
    db.flush()

    # Routes
    r1 = Route(name="Route Alpha")
    r2 = Route(name="Route Beta")
    db.add_all([r1, r2])
    db.flush()

    # Route Alpha: A → B → C
    db.add_all([
        RouteStop(route_id=r1.id, stop_id=s1.id, seq=1),
        RouteStop(route_id=r1.id, stop_id=s2.id, seq=2),
        RouteStop(route_id=r1.id, stop_id=s3.id, seq=3),
    ])
    # Route Beta: B → C → D
    db.add_all([
        RouteStop(route_id=r2.id, stop_id=s2.id, seq=1),
        RouteStop(route_id=r2.id, stop_id=s3.id, seq=2),
        RouteStop(route_id=r2.id, stop_id=s4.id, seq=3),
    ])
    db.flush()

    # Trips
    base = datetime(2026, 11, 23, 8, 0, 0)

    t1 = Trip(route_id=r1.id, start_time=base)
    t2 = Trip(route_id=r2.id, start_time=base)
    t3 = Trip(route_id=r1.id, start_time=base - timedelta(hours=1))  # old
    db.add_all([t1, t2, t3])
    db.flush()

    # Vehicle positions – Trip 1 (active, near Stop B at 08:04)
    db.add(VehiclePosition(
        trip_id=t1.id, lat=s1.lat, lng=s1.lng,
        ts=base,
    ))
    db.add(VehiclePosition(
        trip_id=t1.id, lat=s2.lat + 0.0001, lng=s2.lng + 0.0001,
        ts=base + timedelta(minutes=4),
    ))

    # Vehicle positions – Trip 2 (active, near Stop C at 08:04)
    db.add(VehiclePosition(
        trip_id=t2.id, lat=s2.lat, lng=s2.lng,
        ts=base,
    ))
    db.add(VehiclePosition(
        trip_id=t2.id, lat=s3.lat + 0.0001, lng=s3.lng + 0.0001,
        ts=base + timedelta(minutes=4),
    ))

    # Vehicle positions – Trip 3 (old, only at 07:00)
    db.add(VehiclePosition(
        trip_id=t3.id, lat=s1.lat, lng=s1.lng,
        ts=base - timedelta(hours=1),
    ))

    # Trip 4 (Route Alpha, started 08:02) – only 1 VP at Stop A
    # → bus is at seq 1, 2 stops away from Stop C (seq 3)
    t4 = Trip(route_id=r1.id, start_time=base + timedelta(minutes=2))
    db.add(t4)
    db.flush()
    db.add(VehiclePosition(
        trip_id=t4.id, lat=s1.lat, lng=s1.lng,
        ts=base + timedelta(minutes=2),
    ))

    db.commit()
    db.close()


# ---- TestClient ----------------------------------------------------------


@pytest.fixture()
def client(test_engine, _seed):
    """FastAPI TestClient wired to the in-memory test DB."""
    TestSession = sessionmaker(
        bind=test_engine, autocommit=False, autoflush=False,
    )

    def _override():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
