"""Tests for the real-time physics simulator, holding strategy, and bunching experiment."""

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import pytest

from app.config import ADMIN_API_KEY
from app.database import Base
from app.models import Boarding, Route, RouteStop, Stop
from app.services.simulator import (
    TransitSimulationEngine,
    load_route_geometries,
    run_bunching_experiment,
)
from datetime import datetime


@pytest.fixture()
def sim_db():
    """Isolated in-memory SQLite DB with 1 route, 7 stops, and boardings."""
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
        Stop(name=f"Sim Stop {i}", lat=15.36 + i * 0.015, lng=75.12 + i * 0.015)
        for i in range(1, 8)
    ]
    db.add_all(stops)
    db.flush()

    for s in stops:
        db.add(Boarding(stop_id=s.id, ts=datetime(2026, 11, 24, 8, 0), count=25))

    route = Route(name="Sim Route 1")
    db.add(route)
    db.flush()

    for seq, s in enumerate(stops, start=1):
        db.add(RouteStop(route_id=route.id, stop_id=s.id, seq=seq))
    db.commit()

    yield db
    db.close()


def test_buses_move_by_distance_and_speed(sim_db):
    """Simulated buses advance along route segments and report simulated=True."""
    geometries = load_route_geometries(sim_db)
    engine = TransitSimulationEngine(
        geometries,
        buses_per_route=2,
        headway_minutes=10.0,
        holding=False,
        seed=42,
    )
    for _ in range(60):  # 15 minutes
        engine.step(dt_seconds=15.0)

    vehicles = engine.get_active_vehicles()
    assert len(vehicles) >= 1
    assert all(v["simulated"] is True for v in vehicles)
    assert all(v["speed_kmh"] > 0 for v in vehicles)

    # Check ETA for the final stop is computed from distance, speed, and dwell
    final_stop_id = geometries[0].stops[-1].stop_id
    etas = engine.compute_etas_for_stop(final_stop_id)
    assert len(etas) >= 1
    assert all(e["simulated"] is True and e["eta_minutes"] > 0 for e in etas)


def test_holding_strategy_reduces_headway_variance(sim_db):
    """5-seed experiment shows holding reduces or stabilizes headway variance/bunching."""
    geometries = load_route_geometries(sim_db)
    result = run_bunching_experiment(geometries, seeds=[42, 43, 44, 45, 46], sim_minutes=90)
    assert result["simulated"] is True
    assert result["seeds"] == [42, 43, 44, 45, 46]
    assert len(result["without_holding"]["sample_series"]) > 0
    assert len(result["with_holding"]["sample_series"]) > 0
    assert (
        result["with_holding"]["headway_std_min"]
        <= result["without_holding"]["headway_std_min"]
    )


def test_admin_bunching_experiment_endpoint(client):
    """GET /admin/bunching-experiment returns 5-seed simulated results."""
    resp = client.get(
        "/admin/bunching-experiment",
        headers={"X-Admin-Key": ADMIN_API_KEY},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["simulated"] is True
    assert len(data["seeds"]) == 5
    assert "without_holding" in data
    assert "with_holding" in data
    assert "sample_series" in data["without_holding"]
    assert "sample_series" in data["with_holding"]
