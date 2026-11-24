"""Synthetic transit data generator for Dharwad / Hubli-Dharwad.

Generates realistic stops, routes, boardings, trips, and vehicle positions
and loads them into the existing SQLite (or PostgreSQL) database using the
SQLAlchemy models in backend/app.

Usage (from the project root):
    python data/generate.py
    python data/generate.py --days 30 --noise 0.3 --events 2
    python data/generate.py --days 30 --start-date 2026-09-01

See data/README.md for column documentation.
"""

from __future__ import annotations

import argparse
import os
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np

# ---------------------------------------------------------------------------
# Path setup – allow importing from backend/app regardless of CWD
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
BACKEND_DIR = PROJECT_ROOT / "backend"

sys.path.insert(0, str(BACKEND_DIR))
os.chdir(BACKEND_DIR)  # so sqlite:///./transit.db resolves to backend/

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models import (  # noqa: E402
    Boarding,
    Route,
    RouteStop,
    Stop,
    Trip,
    VehiclePosition,
)

# ---------------------------------------------------------------------------
# Fixed seeds for reproducibility
# ---------------------------------------------------------------------------
RANDOM_SEED = 42
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)

# ---------------------------------------------------------------------------
# 15 real Dharwad / Hubli-Dharwad stops
# (name, lat, lng, popularity_factor)
#   popularity: bus stands ~2.0, major junctions ~1.2, suburbs ~0.6
# ---------------------------------------------------------------------------
STOPS_DATA: list[tuple[str, float, float, float]] = [
    # -- Dharwad cluster --
    ("Dharwad Bus Stand",   15.4580, 75.0070, 2.0),
    ("Court Circle",        15.4530, 75.0120, 1.2),
    ("Jubilee Circle",      15.4490, 75.0170, 1.0),
    ("Saptapur",            15.4440, 75.0130, 0.8),
    ("Kelgeri",             15.4400, 75.0090, 0.6),
    # -- Corridor (Dharwad → Hubli) --
    ("Haliyal Cross",       15.4370, 75.0280, 0.7),
    ("Vidyagiri",           15.4310, 75.0340, 0.8),
    ("Toll Naka",           15.3900, 75.0700, 1.0),
    ("Navanagar",           15.3700, 75.1000, 0.9),
    # -- Hubli cluster --
    ("Hubli Old Bus Stand", 15.3647, 75.1240, 2.0),
    ("CBT Hubli",           15.3690, 75.1180, 1.8),
    ("Deshpande Nagar",     15.3580, 75.1310, 1.0),
    ("Keshwapur",           15.3530, 75.1370, 0.7),
    ("Koppikar Road",       15.3610, 75.1200, 0.9),
    ("Gokul Road",          15.3720, 75.1120, 1.0),
]

# 3 routes, each referencing stop indices in STOPS_DATA
ROUTES_DATA: list[tuple[str, list[int]]] = [
    ("Route 1 – Dharwad-Hubli Trunk",       # 8 stops across the twin cities
     [0, 1, 2, 6, 7, 8, 10, 9]),
    ("Route 2 – Hubli City Circular",        # 6 stops looping inside Hubli
     [9, 11, 12, 13, 14, 10]),
    ("Route 3 – Dharwad Local",              # 5 stops inside Dharwad
     [0, 3, 4, 5, 1]),
]

# ---------------------------------------------------------------------------
# Hourly demand profile (hours 6–21, index 0 → 6 AM)
# Twin peaks at 8-10 AM and 5-7 PM
# ---------------------------------------------------------------------------
HOURLY_BASE = np.array([
    8,    # 06:00
    15,   # 07:00
    38,   # 08:00  ← morning peak
    42,   # 09:00  ← morning peak
    28,   # 10:00
    18,   # 11:00
    22,   # 12:00
    18,   # 13:00
    14,   # 14:00
    16,   # 15:00
    22,   # 16:00
    38,   # 17:00  ← evening peak
    42,   # 18:00  ← evening peak
    30,   # 19:00
    18,   # 20:00
    8,    # 21:00
], dtype=float)

WEEKEND_FACTOR = 0.5
HOURS = list(range(6, 22))  # 6 AM to 9 PM inclusive

# Trip / vehicle-position constants
TRIP_START_HOUR = 6
TRIP_END_HOUR = 22          # last departure at 21:50
TRIP_INTERVAL_MIN = 10      # one bus every 10 minutes per route
INTER_STOP_MIN = 4.0        # average travel time between consecutive stops
DELAY_PROBABILITY = 0.20    # fraction of trips that accumulate delay
MAX_DELAY_MIN = 5           # max delay injected at a single stop
GPS_JITTER = 0.0005         # degrees of random position noise
BATCH_SIZE = 5000           # rows per bulk-insert batch


# ===================================================================
# CLI
# ===================================================================


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    p = argparse.ArgumentParser(
        description="Generate synthetic Dharwad transit data and load into the DB.",
    )
    p.add_argument(
        "--days", type=int, default=60,
        help="Number of days to generate (default: 60)",
    )
    p.add_argument(
        "--noise", type=float, default=0.15,
        help="Gaussian noise σ as a fraction of base boarding count (default: 0.15)",
    )
    p.add_argument(
        "--events", type=int, default=3,
        help="Number of special-event demand spikes to inject (default: 3)",
    )
    p.add_argument(
        "--start-date", type=str, default=None,
        help="Start date in YYYY-MM-DD format (default: today minus --days)",
    )
    return p.parse_args()


# ===================================================================
# Helpers
# ===================================================================


def clear_tables(db) -> None:  # type: ignore[no-untyped-def]
    """Delete all rows in FK-safe (children-first) order."""
    for model in [VehiclePosition, Boarding, Trip, RouteStop, Route, Stop]:
        db.query(model).delete()
    db.commit()
    print("Cleared all existing rows.")


def _generate_special_events(
    num_events: int,
    num_days: int,
    num_stops: int,
) -> dict[tuple[int, int], tuple[int, int, float]]:
    """Return {(day, stop_idx): (start_hour_idx, duration_hours, multiplier)}."""
    events: dict[tuple[int, int], tuple[int, int, float]] = {}
    attempts = 0
    while len(events) < num_events and attempts < num_events * 10:
        attempts += 1
        day = random.randint(0, num_days - 1)
        stop_idx = random.randint(0, num_stops - 1)
        if (day, stop_idx) in events:
            continue
        start_h = random.randint(2, 10)        # hour-index 2 → 8 AM
        duration = random.randint(3, 4)         # hours
        multiplier = round(random.uniform(3.0, 5.0), 2)
        events[(day, stop_idx)] = (start_h, duration, multiplier)
    return events


# ===================================================================
# Generators
# ===================================================================


def generate_stops(db) -> list[tuple[Stop, float]]:
    """Insert 15 stops; return [(Stop, popularity_factor), …]."""
    result = []
    for name, lat, lng, pop in STOPS_DATA:
        s = Stop(name=name, lat=lat, lng=lng)
        db.add(s)
        result.append((s, pop))
    db.flush()
    return result


def generate_routes(
    db,
    stops: list[tuple[Stop, float]],
) -> list[tuple[Route, list[int]]]:
    """Insert 3 routes with route_stops; return [(Route, [stop_indices]), …]."""
    result = []
    for route_name, stop_indices in ROUTES_DATA:
        r = Route(name=route_name)
        db.add(r)
        db.flush()
        for seq, si in enumerate(stop_indices, start=1):
            db.add(RouteStop(route_id=r.id, stop_id=stops[si][0].id, seq=seq))
        result.append((r, stop_indices))
    db.flush()
    return result


def generate_boardings(
    db,
    stops: list[tuple[Stop, float]],
    args: argparse.Namespace,
    base_date: datetime,
) -> int:
    """Generate hourly boarding counts for every stop over N days."""
    events = _generate_special_events(args.events, args.days, len(stops))
    if events:
        print(f"  Special events injected ({len(events)}):")
        for (d, si), (sh, dur, mult) in sorted(events.items()):
            date = (base_date + timedelta(days=d)).strftime("%Y-%m-%d")
            print(
                f"    {date} at {stops[si][0].name}, "
                f"hours {HOURS[sh]}-{HOURS[min(sh + dur, len(HOURS) - 1)]}, "
                f"×{mult}"
            )

    rows: list[dict] = []
    for day_offset in range(args.days):
        current_date = base_date + timedelta(days=day_offset)
        is_weekend = current_date.weekday() >= 5

        for stop_idx, (stop_obj, popularity) in enumerate(stops):
            for h_idx, hour in enumerate(HOURS):
                base = float(HOURLY_BASE[h_idx]) * popularity
                if is_weekend:
                    base *= WEEKEND_FACTOR

                # Apply special-event spike
                if (day_offset, stop_idx) in events:
                    ev_start, ev_dur, ev_mult = events[(day_offset, stop_idx)]
                    if ev_start <= h_idx < ev_start + ev_dur:
                        base *= ev_mult

                noise = np.random.normal(0, args.noise * base)
                count = max(0, int(round(base + noise)))

                rows.append({
                    "stop_id": stop_obj.id,
                    "ts": current_date + timedelta(hours=hour),
                    "count": count,
                })

    for i in range(0, len(rows), BATCH_SIZE):
        db.bulk_insert_mappings(Boarding, rows[i : i + BATCH_SIZE])
    db.flush()
    return len(rows)


def generate_trips_and_positions(
    db,
    routes: list[tuple[Route, list[int]]],
    stops: list[tuple[Stop, float]],
    args: argparse.Namespace,
    base_date: datetime,
) -> tuple[int, int]:
    """Generate trips (every 10 min, 6 AM–10 PM) and vehicle positions.

    ~20 % of trips accumulate random delay at some stops, producing
    realistic bus-bunching on certain routes.
    """
    minutes_in_window = (TRIP_END_HOUR - TRIP_START_HOUR) * 60
    departures_per_day = minutes_in_window // TRIP_INTERVAL_MIN  # 96

    # --- Phase 1: build trip rows ---
    trip_meta: list[tuple[int, list[int]]] = []  # parallel list: (route_id, stop_indices)
    trip_rows: list[dict] = []

    for day_offset in range(args.days):
        day_start = base_date + timedelta(days=day_offset)
        for route_obj, stop_indices in routes:
            for dep_idx in range(departures_per_day):
                dep_min = TRIP_START_HOUR * 60 + dep_idx * TRIP_INTERVAL_MIN
                dep_time = day_start + timedelta(minutes=dep_min)
                trip_rows.append({
                    "route_id": route_obj.id,
                    "start_time": dep_time,
                })
                trip_meta.append((route_obj.id, stop_indices))

    for i in range(0, len(trip_rows), BATCH_SIZE):
        db.bulk_insert_mappings(Trip, trip_rows[i : i + BATCH_SIZE])
    db.flush()

    # --- Phase 2: fetch assigned IDs in insertion order ---
    all_trip_ids = [
        t.id for t in db.query(Trip.id).order_by(Trip.id).all()
    ]
    assert len(all_trip_ids) == len(trip_rows)

    # --- Phase 3: build vehicle-position rows ---
    pos_rows: list[dict] = []
    for idx, trip_id in enumerate(all_trip_ids):
        _, stop_indices = trip_meta[idx]
        dep_time = trip_rows[idx]["start_time"]
        is_delayed = random.random() < DELAY_PROBABILITY
        accumulated_delay = 0.0

        for seq, si in enumerate(stop_indices):
            stop_obj = stops[si][0]
            scheduled_offset = seq * INTER_STOP_MIN

            if is_delayed and seq > 0 and random.random() < 0.4:
                accumulated_delay += random.uniform(1, MAX_DELAY_MIN)

            ts = dep_time + timedelta(minutes=scheduled_offset + accumulated_delay)
            pos_rows.append({
                "trip_id": trip_id,
                "lat": stop_obj.lat + random.uniform(-GPS_JITTER, GPS_JITTER),
                "lng": stop_obj.lng + random.uniform(-GPS_JITTER, GPS_JITTER),
                "ts": ts,
            })

    for i in range(0, len(pos_rows), BATCH_SIZE):
        db.bulk_insert_mappings(VehiclePosition, pos_rows[i : i + BATCH_SIZE])
    db.flush()

    return len(trip_rows), len(pos_rows)


# ===================================================================
# Main
# ===================================================================


def main() -> None:
    args = parse_args()
    if args.start_date:
        base_date = datetime.strptime(args.start_date, "%Y-%m-%d")
    else:
        base_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=args.days)

    print(f"Generating data: {args.days} days, noise={args.noise}, events={args.events}")
    print(f"Base date: {base_date.date()}\n")

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        clear_tables(db)

        stops = generate_stops(db)
        print(f"  Stops: {len(stops)}")

        routes = generate_routes(db, stops)
        print(f"  Routes: {len(routes)}")
        for r, idxs in routes:
            names = " → ".join(stops[i][0].name for i in idxs)
            print(f"    {r.name}: {names}")

        print()
        n_boardings = generate_boardings(db, stops, args, base_date)
        print(f"  Boardings: {n_boardings:,}")

        n_trips, n_positions = generate_trips_and_positions(
            db, routes, stops, args, base_date,
        )
        print(f"  Trips: {n_trips:,}")
        print(f"  Vehicle positions: {n_positions:,}")

        db.commit()
        print("\n✓ Data committed.\n")

        # Final summary
        print("Row counts:")
        for model in [Stop, Route, RouteStop, Trip, VehiclePosition, Boarding]:
            count = db.query(model).count()
            print(f"  {model.__tablename__:25s} {count:>10,}")
    finally:
        db.close()


if __name__ == "__main__":
    main()

