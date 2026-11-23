"""Seed the database with sample Hubli-Dharwad transit data.

Run from the backend/ directory:
    python -m seed
"""

import random
from datetime import datetime, timedelta

from app.database import Base, SessionLocal, engine
from app.models import Boarding, Route, RouteStop, Stop, Trip, VehiclePosition

random.seed(42)

# ---------------------------------------------------------------------------
# Reference data – real Hubli-Dharwad stops (approximate coordinates)
# ---------------------------------------------------------------------------

STOPS = [
    ("Hubli Bus Stand", 15.3647, 75.1240),
    ("Deshpande Nagar", 15.3580, 75.1310),
    ("Keshwapur", 15.3530, 75.1370),
    ("Navanagar", 15.3480, 75.1430),
    ("Toll Naka", 15.3410, 75.1490),
    ("Rayapur", 15.3350, 75.1540),
    ("Sattur Colony", 15.3290, 75.1600),
    ("Dharwad Bus Stand", 15.4580, 75.0070),
    ("Court Circle", 15.4530, 75.0120),
    ("Jubilee Circle", 15.4490, 75.0170),
    ("Lakmanahalli", 15.4430, 75.0230),
    ("Haliyal Road", 15.4370, 75.0280),
    ("Vidyagiri", 15.4310, 75.0340),
    ("Malmaddi", 15.4260, 75.0400),
    ("CBT Hubli", 15.3690, 75.1180),
    ("Gokul Road", 15.3720, 75.1120),
    ("Hosur", 15.3750, 75.1050),
    ("Shirur Park", 15.3570, 75.1270),
    ("Koppikar Road", 15.3610, 75.1200),
    ("Vidyanagar", 15.3660, 75.1150),
]

ROUTES = [
    ("Route 1 – Hubli Bus Stand to Sattur Colony", [0, 1, 2, 3, 4, 5, 6]),
    ("Route 2 – Dharwad Bus Stand to Malmaddi", [7, 8, 9, 10, 11, 12, 13]),
    ("Route 3 – CBT Hubli to Vidyanagar", [14, 15, 16, 19, 18, 17]),
    ("Route 4 – Hubli to Dharwad Express", [0, 1, 4, 10, 8, 7]),
    ("Route 5 – Circular – Hubli City", [0, 17, 1, 2, 3, 18, 19, 15, 0]),
]


def seed() -> None:
    """Drop existing tables, recreate, and populate with sample data."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # --- Stops ---
        stop_objs = []
        for name, lat, lng in STOPS:
            s = Stop(name=name, lat=lat, lng=lng)
            db.add(s)
            stop_objs.append(s)
        db.flush()  # assign IDs

        # --- Routes and RouteStops ---
        route_objs = []
        for route_name, stop_indices in ROUTES:
            r = Route(name=route_name)
            db.add(r)
            db.flush()
            for seq, si in enumerate(stop_indices, start=1):
                db.add(RouteStop(route_id=r.id, stop_id=stop_objs[si].id, seq=seq))
            route_objs.append(r)
        db.flush()

        # --- Trips (3 per route, morning / midday / evening) ---
        base_date = datetime(2026, 11, 23)
        trip_objs = []
        for r in route_objs:
            for hour in (7, 12, 17):
                t = Trip(
                    route_id=r.id,
                    start_time=base_date + timedelta(hours=hour),
                )
                db.add(t)
                trip_objs.append(t)
        db.flush()

        # --- Vehicle positions (2 simulated pings per trip) ---
        for t in trip_objs:
            # Find the route's stops for coords
            rs_list = (
                db.query(RouteStop)
                .filter(RouteStop.route_id == t.route_id)
                .order_by(RouteStop.seq)
                .all()
            )
            if len(rs_list) < 2:
                continue
            first_stop = db.get(Stop, rs_list[0].stop_id)
            mid_stop = db.get(Stop, rs_list[len(rs_list) // 2].stop_id)
            for i, s in enumerate((first_stop, mid_stop)):
                db.add(
                    VehiclePosition(
                        trip_id=t.id,
                        lat=s.lat + random.uniform(-0.001, 0.001),
                        lng=s.lng + random.uniform(-0.001, 0.001),
                        ts=t.start_time + timedelta(minutes=i * 15),
                    )
                )

        # --- Boardings (random counts for each stop, hourly over the day) ---
        for stop in stop_objs:
            for hour in range(6, 22):
                db.add(
                    Boarding(
                        stop_id=stop.id,
                        ts=base_date + timedelta(hours=hour),
                        count=random.randint(2, 45),
                    )
                )

        db.commit()

        # Print summary
        print(f"Seeded: {db.query(Stop).count()} stops")
        print(f"        {db.query(Route).count()} routes")
        print(f"        {db.query(RouteStop).count()} route-stops")
        print(f"        {db.query(Trip).count()} trips")
        print(f"        {db.query(VehiclePosition).count()} vehicle positions")
        print(f"        {db.query(Boarding).count()} boardings")
    finally:
        db.close()


if __name__ == "__main__":
    seed()

