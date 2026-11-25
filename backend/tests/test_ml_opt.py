"""Tests for /forecast, /optimize, and /admin/analytics endpoints."""

from datetime import datetime, timedelta

from app.config import ADMIN_API_KEY
from app.models import Boarding
from sqlalchemy.orm import sessionmaker


def test_forecast_returns_predictions(client, test_engine):
    """Seed a few boardings for Stop 1 and verify /forecast response shape."""
    Session = sessionmaker(bind=test_engine)
    db = Session()
    base = datetime(2026, 11, 20, 8, 0, 0)
    for d in range(8):
        db.add(
            Boarding(
                stop_id=1,
                ts=base + timedelta(days=d),
                count=20 + d,
            )
        )
    db.commit()
    db.close()

    resp = client.get("/forecast", params={"stop_id": 1, "horizon": 4})
    assert resp.status_code == 200
    data = resp.json()
    assert data["stop_id"] == 1
    assert data["stop_name"] == "Stop A"
    assert data["horizon_hours"] == 4
    assert len(data["predictions"]) == 4
    timestamps = [p["ts"] for p in data["predictions"]]
    assert len(set(timestamps)) == 4
    assert timestamps == sorted(timestamps)
    for p in data["predictions"]:
        assert {"ts", "predicted_count", "baseline_count"} <= set(p.keys())
        assert p["predicted_count"] >= 0


def test_forecast_wraps_operating_hours_uniquely(client, test_engine):
    """Forecasting past 21:00 advances sequentially to 06:00, 07:00, 08:00..."""
    Session = sessionmaker(bind=test_engine)
    db = Session()
    db.add(Boarding(stop_id=2, ts=datetime(2026, 11, 23, 21, 0, 0), count=12))
    db.commit()
    db.close()

    resp = client.get("/forecast", params={"stop_id": 2, "horizon": 4})
    assert resp.status_code == 200
    preds = resp.json()["predictions"]
    hours = [datetime.fromisoformat(p["ts"]).hour for p in preds]
    assert hours == [6, 7, 8, 9]


def test_forecast_stop_not_found(client):
    resp = client.get("/forecast", params={"stop_id": 999, "horizon": 3})
    assert resp.status_code == 404
    assert resp.json() == {"error": "Stop not found"}


def test_optimize_returns_routes_and_baseline(client):
    resp = client.post(
        "/optimize",
        json={"stop_ids": [1, 2, 3, 4], "fleet_size": 2, "depot_stop_id": 1},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["fleet_size"] == 2
    assert len(data["routes"]) == 2
    assert data["total_distance_km"] >= 0
    assert data["baseline_distance_km"] >= 0
    assert data["solver"] == "ortools"
    visited = {sid for r in data["routes"] for sid in r["stop_ids"]}
    assert visited == {1, 2, 3, 4}


def test_optimize_stop_not_found(client):
    resp = client.post(
        "/optimize",
        json={"stop_ids": [1, 999], "fleet_size": 1},
    )
    assert resp.status_code == 404
    assert "error" in resp.json()


def test_admin_analytics_requires_api_key(client):
    assert client.get("/admin/analytics").status_code == 401
    assert (
        client.get("/admin/analytics", headers={"X-Admin-Key": "wrong"}).status_code
        == 403
    )


def test_admin_analytics_returns_summary(client):
    resp = client.get(
        "/admin/analytics", headers={"X-Admin-Key": ADMIN_API_KEY}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_stops"] == 4
    assert data["total_routes"] == 2
    assert data["active_vehicles"] >= 1
    assert len(data["stop_demands"]) == 4
    assert len(data["route_headways"]) == 2


def test_admin_results_returns_benchmarks(client):
    resp = client.get(
        "/admin/results", headers={"X-Admin-Key": ADMIN_API_KEY}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "forecast" in data
    assert "optimizer" in data
    assert "bunching" in data
    assert "route_search_latency" in data
