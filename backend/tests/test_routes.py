"""Tests for /routes, /routes/{id}, and /routes/search."""

import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Route, RouteStop, Stop

# Exact 15-stop, 3-route Hubli-Dharwad network from data/generate.py
_HUBLI_DHARWAD_STOPS = [
    ("Dharwad Bus Stand", 15.4580, 75.0070),
    ("Court Circle", 15.4530, 75.0120),
    ("Jubilee Circle", 15.4490, 75.0170),
    ("Saptapur", 15.4440, 75.0130),
    ("Kelgeri", 15.4400, 75.0090),
    ("Haliyal Cross", 15.4370, 75.0280),
    ("Vidyagiri", 15.4310, 75.0340),
    ("Toll Naka", 15.3900, 75.0700),
    ("Navanagar", 15.3700, 75.1000),
    ("Hubli Old Bus Stand", 15.3647, 75.1240),
    ("CBT Hubli", 15.3690, 75.1180),
    ("Deshpande Nagar", 15.3580, 75.1310),
    ("Keshwapur", 15.3530, 75.1370),
    ("Koppikar Road", 15.3610, 75.1200),
    ("Gokul Road", 15.3720, 75.1120),
]

_HUBLI_DHARWAD_ROUTES = [
    ("Route 1 – Dharwad-Hubli Trunk", [0, 1, 2, 6, 7, 8, 10, 9]),
    ("Route 2 – Hubli City Circular", [9, 11, 12, 13, 14, 10]),
    ("Route 3 – Dharwad Local", [0, 3, 4, 5, 1]),
]


@pytest.fixture(scope="module")
def full_network_client():
    """Isolated 15-stop, 3-route TestClient matching the Hubli-Dharwad network."""
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

    stop_objs = [Stop(name=n, lat=lat, lng=lng) for n, lat, lng in _HUBLI_DHARWAD_STOPS]
    db.add_all(stop_objs)
    db.flush()

    for rname, idxs in _HUBLI_DHARWAD_ROUTES:
        r = Route(name=rname)
        db.add(r)
        db.flush()
        for seq, si in enumerate(idxs, start=1):
            db.add(RouteStop(route_id=r.id, stop_id=stop_objs[si].id, seq=seq))
    db.commit()
    db.close()

    def _override():
        s = Session()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


class TestListRoutes:
    def test_returns_all_routes(self, client):
        resp = client.get("/routes")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        names = {r["name"] for r in data}
        assert names == {"Route Alpha", "Route Beta"}


class TestRouteDetail:
    def test_returns_route_with_stops(self, client):
        resp = client.get("/routes/1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Route Alpha"
        assert len(data["stops"]) == 3
        seqs = [s["seq"] for s in data["stops"]]
        assert seqs == [1, 2, 3]
        stop_names = [s["stop"]["name"] for s in data["stops"]]
        assert stop_names == ["Stop A", "Stop B", "Stop C"]

    def test_route_not_found(self, client):
        resp = client.get("/routes/999")
        assert resp.status_code == 404
        assert resp.json() == {"error": "Route not found"}


class TestRouteSearch:
    def test_direct_route(self, client):
        # A(1) → C(3) : direct on Alpha
        resp = client.get("/routes/search", params={"from": 1, "to": 3})
        assert resp.status_code == 200
        data = resp.json()
        direct = [r for r in data if r["type"] == "direct"]
        assert len(direct) >= 1
        assert direct[0]["route"]["name"] == "Route Alpha"
        assert direct[0]["num_transfers"] == 0
        assert direct[0]["estimated_minutes"] > 0
        assert len(direct[0]["legs"]) == 1

    def test_transfer_route(self, client):
        # A(1) → D(4): no direct; transfer Alpha → Beta at B or C
        resp = client.get("/routes/search", params={"from": 1, "to": 4})
        assert resp.status_code == 200
        data = resp.json()
        direct = [r for r in data if r["type"] == "direct"]
        transfer = [r for r in data if r["type"] == "transfer"]
        assert len(direct) == 0
        assert len(transfer) >= 1
        t = transfer[0]
        assert t["first_route"]["name"] == "Route Alpha"
        assert t["second_route"]["name"] == "Route Beta"
        assert t["transfer_stop"]["name"] in ("Stop B", "Stop C")
        assert t["num_transfers"] == 1
        assert len(t["legs"]) == 2

    def test_reverse_direction_works(self, client):
        # D(4) → A(1): reverse direction Beta → Alpha
        resp = client.get("/routes/search", params={"from": 4, "to": 1})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["num_transfers"] == 1

    def test_origin_not_found(self, client):
        resp = client.get("/routes/search", params={"from": 999, "to": 1})
        assert resp.status_code == 404
        assert resp.json() == {"error": "Origin stop not found"}

    def test_destination_not_found(self, client):
        resp = client.get("/routes/search", params={"from": 1, "to": 999})
        assert resp.status_code == 404
        assert resp.json() == {"error": "Destination stop not found"}


class TestFullNetworkRouteSearch:
    def test_stop_3_to_5_returns_result(self, full_network_client):
        """Jubilee Circle (3) -> Kelgeri (5) must return at least one journey."""
        resp = full_network_client.get(
            "/routes/search", params={"from": 3, "to": 5}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["legs"][0]["stops"][0]["id"] == 3
        assert data[0]["legs"][-1]["stops"][-1]["id"] == 5

    def test_circular_route_wraps_around(self, full_network_client):
        """Route 2 (Hubli City Circular) wraps between CBT Hubli (11) and Hubli Old Bus Stand (10)."""
        resp = full_network_client.get(
            "/routes/search", params={"from": 11, "to": 10}
        )
        assert resp.status_code == 200
        data = resp.json()
        direct_r2 = [
            r
            for r in data
            if r["type"] == "direct"
            and "Circular" in r["route"]["name"]
        ]
        assert len(direct_r2) == 1
        assert len(direct_r2[0]["legs"][0]["stops"]) == 2

    @pytest.mark.parametrize(
        "from_id,to_id",
        [(i, j) for i in range(1, 16) for j in range(1, 16) if i != j],
    )
    def test_all_15_stop_pairs_return_result(
        self, full_network_client, from_id, to_id
    ):
        resp = full_network_client.get(
            "/routes/search", params={"from": from_id, "to": to_id}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        # Ranked by (num_transfers, estimated_minutes)
        keys = [(r["num_transfers"], r["estimated_minutes"]) for r in data]
        assert keys == sorted(keys)

    def test_search_answers_under_one_second(self, full_network_client):
        t0 = time.perf_counter()
        resp = full_network_client.get(
            "/routes/search", params={"from": 5, "to": 13}
        )
        elapsed = time.perf_counter() - t0
        assert resp.status_code == 200
        assert len(resp.json()) >= 1
        assert elapsed < 1.0
