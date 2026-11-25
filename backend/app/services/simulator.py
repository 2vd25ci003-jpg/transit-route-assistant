"""Real-time physics-based vehicle simulator with optional holding strategy.

Buses move along each route by Haversine distance and speed (km/h), with:
- Random speed noise per simulation tick
- Stop dwell time proportional to average stop boardings
- Occasional traffic stalls so realistic bus bunching occurs
- Optional holding strategy: delays a bus at a stop when its headway to the
  bus ahead drops below a threshold, reducing headway variance and bunching.
"""

from __future__ import annotations

import asyncio
import math
import random
import statistics
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Boarding, Route, RouteStop, Stop

# ---------------------------------------------------------------------------
# Simulation Parameters
# ---------------------------------------------------------------------------

DEFAULT_BASE_SPEED_KMH = 22.0
SPEED_NOISE_STD_KMH = 3.5
MIN_SPEED_KMH = 8.0
MAX_SPEED_KMH = 38.0

BASE_DWELL_SECONDS = 15.0
DWELL_SECONDS_PER_BOARDING = 1.2

STALL_PROBABILITY_PER_TICK = 0.04
MIN_STALL_SECONDS = 45.0
MAX_STALL_SECONDS = 150.0

DEFAULT_HEADWAY_MINUTES = 10.0
DEFAULT_BUSES_PER_ROUTE = 3
HOLDING_RATIO_THRESHOLD = 0.75  # Hold if gap < 75% of target headway (7.5 min)
MAX_HOLD_SECONDS = 180.0
BUNCHING_THRESHOLD_MINUTES = 4.0

EXPERIMENT_SEEDS = [42, 43, 44, 45, 46]


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in kilometres between two coordinates."""
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    )
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@dataclass(frozen=True)
class RouteStopInfo:
    """Stop metadata along a route."""

    stop_id: int
    name: str
    lat: float
    lng: float
    avg_boardings: float


@dataclass
class RouteGeometry:
    """Precomputed route stop sequence and inter-stop distances."""

    route_id: int
    route_name: str
    stops: list[RouteStopInfo]
    segment_km: list[float]
    cum_km: list[float]
    is_circular: bool

    @property
    def total_km(self) -> float:
        return self.cum_km[-1] if self.cum_km else 0.0


@dataclass
class SimBus:
    """Live state of one simulated bus moving along a route."""

    trip_id: int
    route_id: int
    route_name: str
    bus_index: int
    depart_time: datetime
    current_seg: int = 0
    seg_progress_km: float = 0.0
    total_dist_km: float = 0.0
    speed_kmh: float = DEFAULT_BASE_SPEED_KMH
    dwell_remaining_s: float = 0.0
    stall_remaining_s: float = 0.0
    lat: float = 0.0
    lng: float = 0.0
    ts: datetime = field(default_factory=datetime.utcnow)
    started: bool = False
    finished: bool = False
    stop_arrivals: dict[int, datetime] = field(default_factory=dict)


@dataclass
class SimulationRunResult:
    """Headway metrics and sample series from a simulation run."""

    holding: bool
    seed: int
    headway_mean_min: float
    headway_std_min: float
    bunching_count: int
    headways_min: list[float]


def load_route_geometries(db: Session) -> list[RouteGeometry]:
    """Load routes, ordered stops, and average boardings per stop from DB."""
    # Average hourly boardings per stop
    avg_rows = (
        db.query(Boarding.stop_id, func.avg(Boarding.count))
        .group_by(Boarding.stop_id)
        .all()
    )
    avg_boardings_map: dict[int, float] = {
        sid: float(avg_cnt) for sid, avg_cnt in avg_rows
    }

    routes = db.query(Route).order_by(Route.id).all()
    geometries: list[RouteGeometry] = []

    for r in routes:
        rs_rows = (
            db.query(Stop)
            .join(RouteStop, RouteStop.stop_id == Stop.id)
            .filter(RouteStop.route_id == r.id)
            .order_by(RouteStop.seq)
            .all()
        )
        if len(rs_rows) < 2:
            continue

        stops = [
            RouteStopInfo(
                stop_id=s.id,
                name=s.name,
                lat=s.lat,
                lng=s.lng,
                avg_boardings=avg_boardings_map.get(s.id, 15.0),
            )
            for s in rs_rows
        ]
        segment_km: list[float] = []
        cum_km: list[float] = [0.0]
        for i in range(len(stops) - 1):
            d = haversine_km(
                stops[i].lat, stops[i].lng, stops[i + 1].lat, stops[i + 1].lng
            )
            segment_km.append(max(0.05, d))
            cum_km.append(cum_km[-1] + segment_km[-1])

        geometries.append(
            RouteGeometry(
                route_id=r.id,
                route_name=r.name,
                stops=stops,
                segment_km=segment_km,
                cum_km=cum_km,
                is_circular="circular" in r.name.lower(),
            )
        )

    return geometries


class TransitSimulationEngine:
    """Stateful physics-based transit simulation engine."""

    def __init__(
        self,
        geometries: list[RouteGeometry],
        *,
        start_time: datetime | None = None,
        buses_per_route: int = DEFAULT_BUSES_PER_ROUTE,
        headway_minutes: float = DEFAULT_HEADWAY_MINUTES,
        base_speed_kmh: float = DEFAULT_BASE_SPEED_KMH,
        holding: bool = False,
        seed: int = 42,
    ) -> None:
        self.geometries: dict[int, RouteGeometry] = {
            g.route_id: g for g in geometries
        }
        self.start_time = start_time or datetime.utcnow().replace(microsecond=0)
        self.current_time = self.start_time
        self.buses_per_route = buses_per_route
        self.headway_minutes = headway_minutes
        self.base_speed_kmh = base_speed_kmh
        self.holding = holding
        self.rng = random.Random(seed)
        self.buses: list[SimBus] = []
        self._init_buses()

    def _init_buses(self) -> None:
        trip_counter = 90001
        for g in self.geometries.values():
            for bus_idx in range(self.buses_per_route):
                dep = self.start_time + timedelta(
                    minutes=bus_idx * self.headway_minutes
                )
                b = SimBus(
                    trip_id=trip_counter,
                    route_id=g.route_id,
                    route_name=g.route_name,
                    bus_index=bus_idx,
                    depart_time=dep,
                    speed_kmh=self.base_speed_kmh,
                    lat=g.stops[0].lat,
                    lng=g.stops[0].lng,
                    ts=self.start_time,
                )
                self.buses.append(b)
                trip_counter += 1

    def _compute_holding_seconds(
        self, bus: SimBus, stop_idx: int, now: datetime
    ) -> float:
        """Compute holding delay if *bus* is too close to the preceding bus."""
        if not self.holding or bus.bus_index == 0:
            return 0.0

        # Find the preceding bus on the same route that passed this stop
        prev_bus = next(
            (
                other
                for other in self.buses
                if other.route_id == bus.route_id
                and other.bus_index == bus.bus_index - 1
            ),
            None,
        )
        if prev_bus is None or stop_idx not in prev_bus.stop_arrivals:
            return 0.0

        actual_hw_min = (
            now - prev_bus.stop_arrivals[stop_idx]
        ).total_seconds() / 60.0
        threshold_min = self.headway_minutes * HOLDING_RATIO_THRESHOLD
        if actual_hw_min < threshold_min:
            hold_min = threshold_min - actual_hw_min
            return min(MAX_HOLD_SECONDS, max(0.0, hold_min * 60.0))
        return 0.0

    def step(self, dt_seconds: float = 15.0) -> None:
        """Advance all buses by *dt_seconds* of simulated time."""
        self.current_time = self.current_time + timedelta(seconds=dt_seconds)

        for bus in self.buses:
            if bus.finished:
                continue

            if self.current_time < bus.depart_time:
                continue

            g = self.geometries[bus.route_id]
            if not bus.started:
                bus.started = True
                bus.ts = self.current_time
                bus.stop_arrivals[0] = self.current_time
                bus.dwell_remaining_s = (
                    BASE_DWELL_SECONDS
                    + DWELL_SECONDS_PER_BOARDING * g.stops[0].avg_boardings
                )

            bus.ts = self.current_time

            # Handle active stall
            if bus.stall_remaining_s > 0:
                bus.stall_remaining_s = max(0.0, bus.stall_remaining_s - dt_seconds)
                continue

            # Handle stop dwell + holding
            if bus.dwell_remaining_s > 0:
                bus.dwell_remaining_s = max(0.0, bus.dwell_remaining_s - dt_seconds)
                if bus.dwell_remaining_s > 0:
                    continue

            # Occasional stall (more likely for leading buses to trigger bunching)
            stall_prob = (
                STALL_PROBABILITY_PER_TICK * 1.6
                if bus.bus_index == 0
                else STALL_PROBABILITY_PER_TICK * 0.4
            )
            if self.rng.random() < stall_prob:
                bus.stall_remaining_s = self.rng.uniform(
                    MIN_STALL_SECONDS, MAX_STALL_SECONDS
                )
                continue

            # Speed with random noise
            noisy_speed = self.base_speed_kmh + self.rng.gauss(
                0.0, SPEED_NOISE_STD_KMH
            )
            bus.speed_kmh = max(MIN_SPEED_KMH, min(MAX_SPEED_KMH, noisy_speed))

            dist_step_km = bus.speed_kmh * (dt_seconds / 3600.0)
            bus.seg_progress_km += dist_step_km
            bus.total_dist_km += dist_step_km

            # Advance across stop boundaries if needed
            while (
                bus.current_seg < len(g.segment_km)
                and bus.seg_progress_km >= g.segment_km[bus.current_seg]
            ):
                bus.seg_progress_km -= g.segment_km[bus.current_seg]
                bus.current_seg += 1
                stop_idx = bus.current_seg
                if stop_idx not in bus.stop_arrivals:
                    bus.stop_arrivals[stop_idx] = self.current_time

                if stop_idx >= len(g.stops) - 1:
                    if g.is_circular:
                        # Loop back to stop 0
                        bus.current_seg = 0
                        bus.seg_progress_km = 0.0
                    else:
                        bus.finished = True
                        bus.lat = g.stops[-1].lat
                        bus.lng = g.stops[-1].lng
                        bus.total_dist_km = g.total_km
                        break

                dwell_s = (
                    BASE_DWELL_SECONDS
                    + DWELL_SECONDS_PER_BOARDING * g.stops[stop_idx].avg_boardings
                )
                hold_s = self._compute_holding_seconds(
                    bus, stop_idx, self.current_time
                )
                bus.dwell_remaining_s = dwell_s + hold_s
                break  # Stop to dwell at this stop

            if not bus.finished and bus.current_seg < len(g.segment_km):
                seg_len = g.segment_km[bus.current_seg]
                frac = min(1.0, max(0.0, bus.seg_progress_km / seg_len))
                s_a = g.stops[bus.current_seg]
                s_b = g.stops[bus.current_seg + 1]
                bus.lat = s_a.lat + frac * (s_b.lat - s_a.lat)
                bus.lng = s_a.lng + frac * (s_b.lng - s_a.lng)

    def get_active_vehicles(self) -> list[dict]:
        """Return current positions of all active (started, non-finished) buses."""
        return [
            {
                "trip_id": b.trip_id,
                "route_id": b.route_id,
                "route_name": b.route_name,
                "lat": round(b.lat, 6),
                "lng": round(b.lng, 6),
                "ts": b.ts,
                "speed_kmh": round(b.speed_kmh, 1),
                "simulated": True,
            }
            for b in self.buses
            if b.started and not b.finished
        ]

    def compute_etas_for_stop(self, stop_id: int) -> list[dict]:
        """Compute ETA in minutes from remaining distance, speed, and stop dwell."""
        etas: list[dict] = []
        for bus in self.buses:
            if not bus.started or bus.finished:
                continue
            g = self.geometries.get(bus.route_id)
            if g is None:
                continue

            # Find target stop index ahead of bus
            target_indices = [
                i for i, s in enumerate(g.stops) if s.stop_id == stop_id
            ]
            if not target_indices:
                continue

            for target_idx in target_indices:
                if target_idx <= bus.current_seg:
                    continue

                # Remaining distance on current segment + subsequent segments
                rem_km = max(
                    0.0, g.segment_km[bus.current_seg] - bus.seg_progress_km
                )
                for seg_i in range(bus.current_seg + 1, target_idx):
                    rem_km += g.segment_km[seg_i]

                eff_speed = max(MIN_SPEED_KMH, bus.speed_kmh)
                travel_min = (rem_km / eff_speed) * 60.0

                # Intermediate stop dwell + remaining current dwell/stall
                dwell_s = bus.dwell_remaining_s + bus.stall_remaining_s
                for stop_i in range(bus.current_seg + 1, target_idx):
                    dwell_s += (
                        BASE_DWELL_SECONDS
                        + DWELL_SECONDS_PER_BOARDING
                        * g.stops[stop_i].avg_boardings
                    )

                eta_min = round(travel_min + (dwell_s / 60.0), 1)
                etas.append(
                    {
                        "route_id": bus.route_id,
                        "route_name": bus.route_name,
                        "trip_id": bus.trip_id,
                        "eta_minutes": eta_min,
                        "simulated": True,
                    }
                )
                break

        etas.sort(key=lambda e: e["eta_minutes"])
        return etas[:5]

    def compute_headway_metrics(self) -> tuple[float, float, int, list[float]]:
        """Compute (mean_min, std_min, bunching_count, headways_min) across routes."""
        all_hw: list[float] = []
        bunching_count = 0

        for g in self.geometries.values():
            route_buses = sorted(
                [b for b in self.buses if b.route_id == g.route_id],
                key=lambda b: b.bus_index,
            )
            for idx in range(len(route_buses) - 1):
                b_ahead = route_buses[idx]
                b_behind = route_buses[idx + 1]
                common_stops = sorted(
                    set(b_ahead.stop_arrivals.keys())
                    & set(b_behind.stop_arrivals.keys())
                )
                for si in common_stops:
                    if si == 0:
                        continue  # skip initial departure
                    hw_min = (
                        b_behind.stop_arrivals[si] - b_ahead.stop_arrivals[si]
                    ).total_seconds() / 60.0
                    all_hw.append(round(hw_min, 2))
                    if hw_min < BUNCHING_THRESHOLD_MINUTES:
                        bunching_count += 1

        if not all_hw:
            return (self.headway_minutes, 0.0, 0, [])

        mean_hw = statistics.mean(all_hw)
        std_hw = statistics.stdev(all_hw) if len(all_hw) > 1 else 0.0
        return (round(mean_hw, 2), round(std_hw, 2), bunching_count, all_hw)


def run_bunching_experiment(
    geometries: list[RouteGeometry],
    seeds: list[int] | None = None,
    sim_minutes: int = 90,
) -> dict:
    """Run the simulation with and without holding over 5 seeds and aggregate metrics."""
    used_seeds = seeds or EXPERIMENT_SEEDS

    def _run_mode(holding: bool) -> dict:
        means: list[float] = []
        stds: list[float] = []
        total_bunching = 0
        sample_series: list[float] = []

        for idx, s in enumerate(used_seeds):
            engine = TransitSimulationEngine(
                geometries,
                buses_per_route=3,
                headway_minutes=DEFAULT_HEADWAY_MINUTES,
                holding=holding,
                seed=s,
            )
            ticks = int((sim_minutes * 60) / 15)
            for _ in range(ticks):
                engine.step(dt_seconds=15.0)
            m, sd, bc, hw_series = engine.compute_headway_metrics()
            means.append(m)
            stds.append(sd)
            total_bunching += bc
            if idx == 0:
                sample_series = hw_series[:24]

        return {
            "headway_mean_min": round(statistics.mean(means), 2),
            "headway_std_min": round(statistics.mean(stds), 2),
            "bunching_count": total_bunching,
            "sample_series": sample_series,
        }

    without_holding = _run_mode(holding=False)
    with_holding = _run_mode(holding=True)

    std_before = without_holding["headway_std_min"]
    std_after = with_holding["headway_std_min"]
    reduction_pct = (
        round(((std_before - std_after) / std_before) * 100.0, 1)
        if std_before > 0
        else 0.0
    )

    return {
        "simulated": True,
        "seeds": used_seeds,
        "without_holding": without_holding,
        "with_holding": with_holding,
        "std_reduction_pct": reduction_pct,
    }


# ---------------------------------------------------------------------------
# Singleton in-process real-time simulator manager
# ---------------------------------------------------------------------------


class RealtimeSimulatorManager:
    """Manages the background real-time simulation loop inside the API process."""

    def __init__(self) -> None:
        self.engine: TransitSimulationEngine | None = None
        self._task: asyncio.Task | None = None

    def initialize(self, db: Session, holding: bool = False) -> None:
        geometries = load_route_geometries(db)
        if not geometries:
            self.engine = None
            return
        self.engine = TransitSimulationEngine(
            geometries,
            start_time=datetime.utcnow().replace(microsecond=0),
            buses_per_route=DEFAULT_BUSES_PER_ROUTE,
            headway_minutes=DEFAULT_HEADWAY_MINUTES,
            holding=holding,
            seed=42,
        )
        # Warm up 12 minutes (48 ticks of 15s) so multiple buses are active immediately
        for _ in range(48):
            self.engine.step(dt_seconds=15.0)

    async def start_loop(self, db_factory) -> None:
        if self.engine is None:
            db = db_factory()
            try:
                self.initialize(db)
            finally:
                db.close()

        async def _loop() -> None:
            while True:
                await asyncio.sleep(2.0)
                if self.engine is not None:
                    self.engine.step(dt_seconds=15.0)
                    # Restart cycle if all buses finished
                    if all(b.finished for b in self.engine.buses):
                        self.engine._init_buses()
                        for _ in range(48):
                            self.engine.step(dt_seconds=15.0)

        if self._task is None or self._task.done():
            self._task = asyncio.create_task(_loop())

    async def stop_loop(self) -> None:
        if self._task is not None and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None


realtime_simulator = RealtimeSimulatorManager()
