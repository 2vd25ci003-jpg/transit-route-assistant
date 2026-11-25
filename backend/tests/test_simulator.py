"""Tests for the vehicle simulator (backend/simulator.py)."""

from datetime import datetime
import statistics

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import Route, RouteStop, Stop, Trip, VehiclePosition
from simulator import simulate


@pytest.fixture()
def sim_db():
    """Isolated in-memory SQLite DB with 1 route and 7 stops."""
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
    Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    db = Session()

    stops = [
        Stop(name=f"Sim Stop {i}", lat=15.36 + i * 0.01, lng=75.12 + i * 0.01)
        for i in range(1, 8)
    ]
    db.add_all(stops)
    db.flush()

    route = Route(name="Sim Route 1")
    db.add(route)
    db.flush()

    for seq, s in enumerate(stops, start=1):
        db.add(RouteStop(route_id=route.id, stop_id=s.id, seq=seq))
    db.commit()

    yield db
    db.close()


def _trip_vp_times(db, trip_id: int) -> list[datetime]:
    rows = (
        db.query(VehiclePosition.ts)
        .filter(VehiclePosition.trip_id == trip_id)
        .order_by(VehiclePosition.ts)
        .all()
    )
    return [r[0] for r in rows]


def test_buses_advance_all_stops(sim_db):
    """A single bus visits all 7 stops with strictly ascending timestamps."""
    start = datetime(2026, 11, 24, 9, 0, 0)
    trips = simulate(
        sim_db,
        start_time=start,
        bunching=False,
        buses_per_route=1,
        duration_minutes=60.0,
        batch=True,
    )
    assert len(trips) == 1
    times = _trip_vp_times(sim_db, trips[0].id)
    assert len(times) == 7
    assert times == sorted(times)
    assert len(set(times)) == 7


def test_one_vp_per_stop(sim_db):
    """Each trip produces exactly one VehiclePosition row per route stop."""
    start = datetime(2026, 11, 24, 9, 0, 0)
    trips = simulate(
        sim_db,
        start_time=start,
        bunching=True,
        seed=42,
        buses_per_route=2,
        headway_minutes=10.0,
        duration_minutes=60.0,
        batch=True,
    )
    assert len(trips) == 2
    for trip in trips:
        vps = (
            sim_db.query(VehiclePosition)
            .filter(VehiclePosition.trip_id == trip.id)
            .all()
        )
        assert len(vps) == 7


def test_bunching_on_produces_uneven_headway(sim_db):
    """With bunching=True, leader delays cause uneven headways (stdev > 0)."""
    start = datetime(2026, 11, 24, 9, 0, 0)
    trips = simulate(
        sim_db,
        start_time=start,
        bunching=True,
        seed=42,
        buses_per_route=2,
        headway_minutes=10.0,
        duration_minutes=60.0,
        batch=True,
    )
    assert len(trips) == 2
    t0 = _trip_vp_times(sim_db, trips[0].id)
    t1 = _trip_vp_times(sim_db, trips[1].id)
    headways = [(t1[i] - t0[i]).total_seconds() / 60.0 for i in range(len(t0))]
    assert statistics.stdev(headways) > 0.0
    assert min(headways) < 10.0


def test_bunching_off_produces_even_headway(sim_db):
    """With bunching=False, all buses maintain identical constant headways."""
    start = datetime(2026, 11, 24, 9, 0, 0)
    trips = simulate(
        sim_db,
        start_time=start,
        bunching=False,
        seed=42,
        buses_per_route=2,
        headway_minutes=10.0,
        duration_minutes=60.0,
        batch=True,
    )
    assert len(trips) == 2
    t0 = _trip_vp_times(sim_db, trips[0].id)
    t1 = _trip_vp_times(sim_db, trips[1].id)
    headways = [(t1[i] - t0[i]).total_seconds() / 60.0 for i in range(len(t0))]
    assert all(pytest.approx(10.0) == h for h in headways)
