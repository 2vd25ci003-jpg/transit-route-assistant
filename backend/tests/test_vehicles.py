"""Tests for /vehicles."""


class TestListVehicles:
    def test_returns_active_vehicles(self, client):
        resp = client.get("/vehicles")
        assert resp.status_code == 200
        data = resp.json()
        trip_ids = {v["trip_id"] for v in data}
        # Trips 1 & 2 have positions within 5 min of the latest ts (08:04)
        assert 1 in trip_ids
        assert 2 in trip_ids
        # Trip 3 position is at 07:00 – outside the 5-min window
        assert 3 not in trip_ids

    def test_response_shape(self, client):
        data = client.get("/vehicles").json()
        for v in data:
            assert {"trip_id", "route_id", "route_name", "lat", "lng", "ts"} <= set(
                v.keys()
            )

    def test_as_of_filters_to_window(self, client):
        """Explicit as_of=08:04 → same result as default."""
        resp = client.get(
            "/vehicles", params={"as_of": "2026-11-23T08:04:00"}
        )
        assert resp.status_code == 200
        trip_ids = {v["trip_id"] for v in resp.json()}
        assert 1 in trip_ids
        assert 2 in trip_ids
        assert 3 not in trip_ids

    def test_as_of_old_time_returns_old_trip(self, client):
        """as_of=07:00 catches only trip 3."""
        resp = client.get(
            "/vehicles", params={"as_of": "2026-11-23T07:00:00"}
        )
        assert resp.status_code == 200
        trip_ids = {v["trip_id"] for v in resp.json()}
        assert trip_ids == {3}

    def test_as_of_before_all_data_returns_empty(self, client):
        resp = client.get(
            "/vehicles", params={"as_of": "2026-11-23T06:00:00"}
        )
        assert resp.status_code == 200
        assert resp.json() == []
