"""Tests for /stops, /stops/nearby, and /stops/{id}/eta."""


class TestListStops:
    def test_returns_all_stops(self, client):
        resp = client.get("/stops")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 4
        assert all(
            {"id", "name", "lat", "lng"} <= set(s.keys()) for s in data
        )

    def test_stops_ordered_by_id(self, client):
        data = client.get("/stops").json()
        ids = [s["id"] for s in data]
        assert ids == sorted(ids)


class TestNearbyStops:
    def test_returns_nearby_only(self, client):
        # Stop A coords; B and C are ~1-2 km, D is ~13 km away
        resp = client.get(
            "/stops/nearby",
            params={"lat": 15.3647, "lng": 75.1240, "radius_m": 3000},
        )
        assert resp.status_code == 200
        data = resp.json()
        names = [s["name"] for s in data]
        assert "Stop A" in names
        assert "Stop B" in names
        assert "Stop C" in names
        assert "Stop D" not in names

    def test_sorted_by_distance(self, client):
        data = client.get(
            "/stops/nearby",
            params={"lat": 15.3647, "lng": 75.1240, "radius_m": 5000},
        ).json()
        distances = [s["distance_m"] for s in data]
        assert distances == sorted(distances)

    def test_includes_distance_field(self, client):
        data = client.get(
            "/stops/nearby",
            params={"lat": 15.3647, "lng": 75.1240, "radius_m": 5000},
        ).json()
        assert all("distance_m" in s for s in data)
        assert data[0]["distance_m"] == 0.0  # exact match for Stop A

    def test_missing_params_returns_422(self, client):
        resp = client.get("/stops/nearby")
        assert resp.status_code == 422
        assert "error" in resp.json()


class TestStopEta:
    def test_eta_for_approaching_bus(self, client):
        # Stop C (id=3): on Alpha seq 3, on Beta seq 2
        # Trip 1 has 2 VPs (at stops A, B) → at seq 2, 1 stop away → 4.0 min
        # Trip 4 has 1 VP  (at stop A)     → at seq 1, 2 stops away → 8.0 min
        # Trip 2 has 2 VPs (at stops B, C) → at seq 2 on Beta = target → skipped
        resp = client.get("/stops/3/eta")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        for e in data:
            assert {"route_id", "route_name", "trip_id", "eta_minutes"} <= set(
                e.keys()
            )
        # Sorted ascending
        etas = [e["eta_minutes"] for e in data]
        assert etas == sorted(etas)

    def test_eta_with_as_of_excludes_old_trip(self, client):
        """Trip 3 (07:00) must NOT appear when as_of=08:04."""
        resp = client.get(
            "/stops/3/eta", params={"as_of": "2026-11-23T08:04:00"}
        )
        assert resp.status_code == 200
        trip_ids = {e["trip_id"] for e in resp.json()}
        assert 3 not in trip_ids  # trip 3 is old
        assert len(resp.json()) >= 1

    def test_eta_as_of_before_all_data_returns_empty(self, client):
        resp = client.get(
            "/stops/3/eta", params={"as_of": "2026-11-23T06:00:00"}
        )
        assert resp.status_code == 200
        assert resp.json() == []

    def test_eta_with_as_of_at_old_trip_time(self, client):
        """as_of=07:00 catches only trip 3 (old trip on Alpha).

        Trip 3 is near Stop A (seq 1 on Alpha).  Stop C is seq 3 on
        Alpha → 2 stops away → 8.0 min.
        """
        resp = client.get(
            "/stops/3/eta", params={"as_of": "2026-11-23T07:00:00"}
        )
        assert resp.status_code == 200
        data = resp.json()
        trip_ids = {e["trip_id"] for e in data}
        assert trip_ids == {3}
        assert data[0]["eta_minutes"] > 0

    def test_eta_bus_two_stops_away(self, client):
        """Trip 4 at Stop A (seq 1), target Stop C (seq 3) → 2 stops, eta > 0."""
        resp = client.get(
            "/stops/3/eta", params={"as_of": "2026-11-23T08:04:00"}
        )
        assert resp.status_code == 200
        data = resp.json()
        t4_results = [e for e in data if e["trip_id"] == 4]
        assert len(t4_results) == 1
        assert t4_results[0]["eta_minutes"] > 0
        assert t4_results[0]["route_name"] == "Route Alpha"

    def test_eta_stop_not_found(self, client):
        resp = client.get("/stops/999/eta")
        assert resp.status_code == 404
        assert resp.json() == {"error": "Stop not found"}
