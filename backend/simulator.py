"""Vehicle simulator – moves buses along routes, optionally creating bunching.

Usage (from the backend/ directory):
    python -m simulator --batch --bunching
    python -m simulator --speed 30 --bunching --buses-per-route 3
    python -m simulator --batch --db-path sim.db --duration-minutes 120

Bus roles:
  - Bus 0 on each route is the *leader*: when --bunching is enabled it
    accumulates random delays at ~30 % of stops (1–5 extra minutes each),
    causing it to fall behind schedule.
  - Bus 1 and above are *followers*: they always travel at the constant
    --inter-stop-minutes rate, so they gradually close the gap to the
    delayed leader, producing realistic bus-bunching.
  - With --bunching off, every bus (including bus 0) travels on-time.
"""

import argparse
import heapq
import random
import statistics
import time as _time
from datetime import datetime, timedelta
from itertools import groupby
from pathlib import Path

from sqlalchemy import create_engine, event as sa_event, func
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base
from app.models import Route, RouteStop, Stop, Trip, VehiclePosition

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
DEFAULT_INTER_STOP_MINUTES = 4.0
DEFAULT_HEADWAY_MINUTES = 10.0
DEFAULT_BUSES_PER_ROUTE = 2
DEFAULT_SPEED = 1.0
DEFAULT_SEED = 42
DEFAULT_DURATION_MINUTES = 60.0
GPS_JITTER = 0.0005
DELAY_PROBABILITY = 0.3
MIN_DELAY_MINUTES = 1.0
MAX_DELAY_MINUTES = 5.0


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    p = argparse.ArgumentParser(
        description="Move buses along routes and write vehicle_positions rows.",
    )
    p.add_argument(
        "--speed", type=float, default=DEFAULT_SPEED,
        help="Real-time speed multiplier (default: 1.0)",
    )
    p.add_argument(
        "--batch", action="store_true",
        help="Write all positions instantly (no sleeping)",
    )
    p.add_argument(
        "--bunching", action="store_true",
        help="Enable bunching: leader bus (bus 0) gets random delays",
    )
    p.add_argument(
        "--seed", type=int, default=DEFAULT_SEED,
        help="Fixed random seed (default: 42)",
    )
    p.add_argument(
        "--buses-per-route", type=int, default=DEFAULT_BUSES_PER_ROUTE,
        help="Buses dispatched per route (default: 2)",
    )
    p.add_argument(
        "--headway-minutes", type=float, default=DEFAULT_HEADWAY_MINUTES,
        help="Departure gap between consecutive buses (default: 10)",
    )
    p.add_argument(
        "--inter-stop-minutes", type=float, default=DEFAULT_INTER_STOP_MINUTES,
        help="Base travel time between adjacent stops (default: 4.0)",
    )
    p.add_argument(
        "--duration-minutes", type=float, default=DEFAULT_DURATION_MINUTES,
        help="Simulation window – only trips departing within this window "
             "are created; started trips always finish (default: 60)",
    )
    p.add_argument(
        "--start-time", type=str, default=None,
        help="Override start time (ISO 8601). Default: 1 min after the "
             "latest existing vehicle_positions timestamp",
    )
    p.add_argument(
        "--db-path", type=str, default=None,
        help="SQLite DB file path (default: ./transit.db)",
    )
    return p.parse_args(argv)


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------


def make_engine(db_path: str | None = None):
    """Create a SQLAlchemy engine for the given (or default) SQLite path."""
    if db_path is None:
        db_path = str(Path(__file__).resolve().parent / "transit.db")
    url = f"sqlite:///{db_path}"
    engine = create_engine(
        url, connect_args={"check_same_thread": False}, echo=False,
    )

    @sa_event.listens_for(engine, "connect")
    def _pragma(dbapi_conn, _connection_record):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    return engine


def resolve_start_time(db: Session, override: str | None) -> datetime:
    """Return the simulation start time.

    If *override* is given, parse it as ISO 8601.  Otherwise start
    1 minute after the latest existing ``vehicle_positions.ts`` so that
    new rows sit cleanly after historical data.  Falls back to *now* if
    the table is empty.
    """
    if override is not None:
        return datetime.fromisoformat(override)
    latest = db.query(func.max(VehiclePosition.ts)).scalar()
    if latest is not None:
        return latest + timedelta(minutes=1)
    return datetime.now().replace(second=0, microsecond=0)


def _get_route_stops(
    db: Session, route_id: int,
) -> list[tuple[int, float, float]]:
    """Return ``[(stop_id, lat, lng), …]`` in seq order for a route."""
    rows = (
        db.query(Stop.id, Stop.lat, Stop.lng)
        .join(RouteStop, RouteStop.stop_id == Stop.id)
        .filter(RouteStop.route_id == route_id)
        .order_by(RouteStop.seq)
        .all()
    )
    return [(sid, lat, lng) for sid, lat, lng in rows]


# ---------------------------------------------------------------------------
# Core simulation
# ---------------------------------------------------------------------------


def simulate(
    db: Session,
    *,
    start_time: datetime,
    bunching: bool = False,
    seed: int = DEFAULT_SEED,
    buses_per_route: int = DEFAULT_BUSES_PER_ROUTE,
    headway_minutes: float = DEFAULT_HEADWAY_MINUTES,
    inter_stop_minutes: float = DEFAULT_INTER_STOP_MINUTES,
    duration_minutes: float = DEFAULT_DURATION_MINUTES,
    speed: float = DEFAULT_SPEED,
    batch: bool = True,
) -> list[Trip]:
    """Run the vehicle simulation and return created Trip objects.

    Bus roles
    ---------
    - **Bus 0** (leader): receives random delays at ~30 % of stops when
      *bunching* is ``True``, causing it to fall behind schedule.
    - **Bus 1 and above** (followers): always travel at the constant
      *inter_stop_minutes* rate, so they gradually close the gap to the
      delayed leader.
    - With *bunching* ``False``, every bus travels on-time at a constant
      rate.

    Exactly **one** ``VehiclePosition`` row is written per stop visit,
    in route-stop order.  This matches the ``/stops/{id}/eta`` endpoint
    which counts rows per trip to determine the bus's current position.
    """
    rng = random.Random(seed)

    routes = db.query(Route).order_by(Route.id).all()
    if not routes:
        return []

    # Pre-load route-stop sequences
    route_stops: dict[int, list[tuple[int, float, float]]] = {}
    for r in routes:
        stops = _get_route_stops(db, r.id)
        if stops:
            route_stops[r.id] = stops

    sim_end = start_time + timedelta(minutes=duration_minutes)

    # --- Create trips and seed the event queue ---
    # Event: (sim_time, tiebreaker, trip_id, stop_index, route_id, bus_index)
    queue: list[tuple[datetime, int, int, int, int, int]] = []
    created: list[Trip] = []
    tie = 0

    for r in routes:
        if r.id not in route_stops:
            continue
        for bus_idx in range(buses_per_route):
            dep = start_time + timedelta(minutes=bus_idx * headway_minutes)
            if dep >= sim_end:
                continue  # outside the simulation window
            trip = Trip(route_id=r.id, start_time=dep)
            db.add(trip)
            db.flush()  # assigns trip.id
            created.append(trip)
            heapq.heappush(
                queue, (dep, tie, trip.id, 0, r.id, bus_idx),
            )
            tie += 1

    # --- Process events in time order ---
    prev_time = start_time

    while queue:
        sim_time, _, trip_id, stop_idx, route_id, bus_idx = (
            heapq.heappop(queue)
        )

        stops = route_stops[route_id]
        if stop_idx >= len(stops):
            continue  # safety guard

        # Real-time pacing (live mode only)
        if not batch and speed > 0:
            gap = (sim_time - prev_time).total_seconds() / speed
            if gap > 0:
                _time.sleep(gap)
        prev_time = sim_time

        # Insert exactly one VP row for this stop visit
        stop_id, lat, lng = stops[stop_idx]
        db.add(VehiclePosition(
            trip_id=trip_id,
            lat=lat + rng.uniform(-GPS_JITTER, GPS_JITTER),
            lng=lng + rng.uniform(-GPS_JITTER, GPS_JITTER),
            ts=sim_time,
        ))

        if not batch:
            db.commit()  # live mode: immediate visibility to the API

        # Schedule the next stop
        next_idx = stop_idx + 1
        if next_idx < len(stops):
            travel = inter_stop_minutes

            # Bunching: only bus 0 (leader) accumulates delays
            if bunching and bus_idx == 0:
                if rng.random() < DELAY_PROBABILITY:
                    travel += rng.uniform(MIN_DELAY_MINUTES, MAX_DELAY_MINUTES)

            next_time = sim_time + timedelta(minutes=travel)
            heapq.heappush(
                queue,
                (next_time, tie, trip_id, next_idx, route_id, bus_idx),
            )
            tie += 1

    if batch:
        db.commit()

    return created


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> None:
    """CLI entry point."""
    args = parse_args(argv)

    engine = make_engine(args.db_path)
    Base.metadata.create_all(bind=engine)

    MakeSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    db = MakeSession()

    try:
        start = resolve_start_time(db, args.start_time)

        print("Simulator config:")
        print(f"  Start time:       {start.isoformat()}")
        print(f"  Duration:         {args.duration_minutes} min")
        print(f"  Buses per route:  {args.buses_per_route}")
        print(f"  Headway:          {args.headway_minutes} min")
        print(f"  Inter-stop time:  {args.inter_stop_minutes} min")
        print(f"  Bunching:         {'ON' if args.bunching else 'OFF'}")
        print(f"  Seed:             {args.seed}")
        mode = "batch" if args.batch else f"live ({args.speed}\u00d7)"
        print(f"  Mode:             {mode}")
        print()

        trips = simulate(
            db,
            start_time=start,
            bunching=args.bunching,
            seed=args.seed,
            buses_per_route=args.buses_per_route,
            headway_minutes=args.headway_minutes,
            inter_stop_minutes=args.inter_stop_minutes,
            duration_minutes=args.duration_minutes,
            speed=args.speed,
            batch=args.batch,
        )

        # ---- Summary ----
        vp_total = sum(
            db.query(func.count(VehiclePosition.id))
            .filter(VehiclePosition.trip_id == t.id)
            .scalar()
            for t in trips
        )
        print(f"Created {len(trips)} trips, {vp_total} vehicle positions.\n")

        # ---- Headway analysis (leader vs first follower per route) ----
        if len(trips) >= 2:
            print("Headway analysis (leader → first follower):")
            trips_sorted = sorted(
                trips, key=lambda t: (t.route_id, t.start_time),
            )
            for rid, grp in groupby(trips_sorted, key=lambda t: t.route_id):
                grp_list = list(grp)
                if len(grp_list) < 2:
                    continue
                route = db.get(Route, rid)
                leader, follower = grp_list[0], grp_list[1]

                def _times(tid: int) -> list[datetime]:
                    return [
                        row[0]
                        for row in db.query(VehiclePosition.ts)
                        .filter(VehiclePosition.trip_id == tid)
                        .order_by(VehiclePosition.ts)
                        .all()
                    ]

                lt, ft = _times(leader.id), _times(follower.id)
                n = min(len(lt), len(ft))
                headways = [
                    (ft[i] - lt[i]).total_seconds() / 60 for i in range(n)
                ]
                std = (
                    statistics.stdev(headways) if len(headways) > 1 else 0.0
                )
                print(f"  {route.name}:")
                print(
                    f"    Headways (min): "
                    f"{[round(h, 1) for h in headways]}"
                )
                print(
                    f"    Mean={statistics.mean(headways):.1f}  "
                    f"StdDev={std:.1f}"
                )
    finally:
        db.close()


if __name__ == "__main__":
    main()
