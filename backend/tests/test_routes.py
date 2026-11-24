"""Tests for /routes, /routes/{id}, and /routes/search."""


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

    def test_no_route_reverse_direction(self, client):
        # D(4) → A(1): no route in this direction
        resp = client.get("/routes/search", params={"from": 4, "to": 1})
        assert resp.status_code == 200
        assert resp.json() == []

    def test_origin_not_found(self, client):
        resp = client.get("/routes/search", params={"from": 999, "to": 1})
        assert resp.status_code == 404
        assert resp.json() == {"error": "Origin stop not found"}

    def test_destination_not_found(self, client):
        resp = client.get("/routes/search", params={"from": 1, "to": 999})
        assert resp.status_code == 404
        assert resp.json() == {"error": "Destination stop not found"}
