"""Admin analytics router – protected by X-Admin-Key, using grouped SQL queries."""

from __future__ import annotations

import json
import statistics
from datetime import timedelta
from pathlib import Path

import numpy as np
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.config import ADMIN_API_KEY
from app.database import get_db
from app.models import Boarding, Route, Stop, Trip, VehiclePosition
from app.routers.forecast import _get_model
from app.schemas import (
    AdminAnalyticsOut,
    BunchingExperimentOut,
    HourlyDemandPoint,
    RouteHeadwayOut,
    StopDemandOut,
)
from app.services.simulator import (
    load_route_geometries,
    realtime_simulator,
    run_bunching_experiment,
)


def verify_admin_key(
    x_admin_key: str | None = Header(default=None, alias="X-Admin-Key"),
) -> str:
    """Validate the X-Admin-Key header against ADMIN_API_KEY."""
    if not x_admin_key:
        raise HTTPException(status_code=401, detail="Missing X-Admin-Key header")
    if x_admin_key != ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid admin API key")
    return x_admin_key


router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(verify_admin_key)],
)

_TARGET_HEADWAY_MIN = 10.0
_BUNCHING_THRESHOLD_MIN = 4.0


@router.get("/analytics", response_model=AdminAnalyticsOut)
def get_admin_analytics(db: Session = Depends(get_db)) -> AdminAnalyticsOut:
    """Aggregate live fleet, headway variance, stop demand, and hourly series via grouped SQL."""
    total_stops = db.query(func.count(Stop.id)).scalar() or 0
    total_routes = db.query(func.count(Route.id)).scalar() or 0

    # Active vehicles: live simulator if active, otherwise 5-min DB window
    if realtime_simulator.engine is not None:
        active_vehicles = len(realtime_simulator.engine.get_active_vehicles())
    else:
        active_vehicles = 0

    if active_vehicles == 0:
        latest_vp_ts = db.query(func.max(VehiclePosition.ts)).scalar()
        if latest_vp_ts is not None:
            window_start = latest_vp_ts - timedelta(minutes=5)
            active_vehicles = (
                db.query(func.count(func.distinct(VehiclePosition.trip_id)))
                .filter(
                    VehiclePosition.ts >= window_start,
                    VehiclePosition.ts <= latest_vp_ts,
                )
                .scalar()
                or 0
            )

    # Grouped SQL: per-stop average and total boardings (eliminates N+1 per-stop queries)
    stop_totals = {
        row.stop_id: (float(row.avg_cnt), int(row.sum_cnt))
        for row in db.query(
            Boarding.stop_id,
            func.avg(Boarding.count).label("avg_cnt"),
            func.sum(Boarding.count).label("sum_cnt"),
        )
        .group_by(Boarding.stop_id)
        .all()
    }

    # Grouped SQL: per-(stop_id, hour) average boardings for peak hour & hourly series
    hour_expr = extract("hour", Boarding.ts)
    stop_hour_rows = (
        db.query(
            Boarding.stop_id,
            hour_expr.label("hr"),
            func.avg(Boarding.count).label("avg_cnt"),
        )
        .group_by(Boarding.stop_id, hour_expr)
        .all()
    )
    peak_hour_by_stop: dict[int, tuple[int, float]] = {}
    by_hour_all: dict[int, list[float]] = {}
    for row in stop_hour_rows:
        hr = int(row.hr)
        avg_val = float(row.avg_cnt)
        by_hour_all.setdefault(hr, []).append(avg_val)
        prev = peak_hour_by_stop.get(row.stop_id)
        if prev is None or avg_val > prev[1]:
            peak_hour_by_stop[row.stop_id] = (hr, avg_val)

    stops = db.query(Stop).order_by(Stop.id).all()
    stop_demands: list[StopDemandOut] = []
    for s in stops:
        avg_b, total_b = stop_totals.get(s.id, (0.0, 0))
        peak_h = peak_hour_by_stop.get(s.id, (8, 0.0))[0]
        stop_demands.append(
            StopDemandOut(
                stop_id=s.id,
                stop_name=s.name,
                lat=s.lat,
                lng=s.lng,
                avg_hourly_boardings=round(avg_b, 1),
                peak_hour=peak_h,
                total_boardings=total_b,
            )
        )

    # Batched query for recent trips & their VP timestamps
    routes = db.query(Route).order_by(Route.id).all()
    recent_trips_by_route: dict[int, list[Trip]] = {}
    for r in routes:
        trips = (
            db.query(Trip)
            .filter(Trip.route_id == r.id)
            .order_by(Trip.start_time.desc())
            .limit(12)
            .all()
        )
        trips.reverse()
        recent_trips_by_route[r.id] = trips

    all_trip_ids = [
        t.id for trips in recent_trips_by_route.values() for t in trips
    ]
    vps_by_trip: dict[int, list] = {}
    if all_trip_ids:
        vp_rows = (
            db.query(VehiclePosition.trip_id, VehiclePosition.ts)
            .filter(VehiclePosition.trip_id.in_(all_trip_ids))
            .order_by(VehiclePosition.trip_id, VehiclePosition.ts)
            .all()
        )
        for tid, ts in vp_rows:
            vps_by_trip.setdefault(tid, []).append(ts)

    route_headways: list[RouteHeadwayOut] = []
    all_headways: list[float] = []
    total_bunching_alerts = 0

    for r in routes:
        trip_times = [
            vps_by_trip[t.id]
            for t in recent_trips_by_route.get(r.id, [])
            if t.id in vps_by_trip
        ]
        headways: list[float] = []
        bunching_count = 0
        for idx in range(len(trip_times) - 1):
            t_a, t_b = trip_times[idx], trip_times[idx + 1]
            start_gap = (t_b[0] - t_a[0]).total_seconds() / 60.0
            if 0 < start_gap < 60.0:
                for stop_i in range(min(len(t_a), len(t_b))):
                    hw = (t_b[stop_i] - t_a[stop_i]).total_seconds() / 60.0
                    headways.append(hw)
                    if hw < _BUNCHING_THRESHOLD_MIN:
                        bunching_count += 1

        avg_hw = statistics.mean(headways) if headways else _TARGET_HEADWAY_MIN
        std_hw = statistics.stdev(headways) if len(headways) > 1 else 0.0
        all_headways.extend(headways)
        total_bunching_alerts += bunching_count
        status = "bunching" if bunching_count > 0 or std_hw > 2.5 else "nominal"
        route_headways.append(
            RouteHeadwayOut(
                route_id=r.id,
                route_name=r.name,
                target_headway_min=_TARGET_HEADWAY_MIN,
                avg_headway_min=round(avg_hw, 2),
                headway_std_min=round(std_hw, 2),
                bunching_events=bunching_count,
                status=status,
            )
        )

    # Hourly demand series from grouped SQL averages
    hourly_demand_series: list[HourlyDemandPoint] = []
    model = _get_model()
    for h in sorted(by_hour_all.keys()):
        actual_avg = float(np.mean(by_hour_all[h]))
        if model is not None and stops:
            features = np.array(
                [[float(s.id), float(h), 2.0, 0.0, actual_avg] for s in stops],
                dtype=float,
            )
            forecast_avg = float(np.mean(np.maximum(0.0, model.predict(features))))
        else:
            forecast_avg = actual_avg

        hourly_demand_series.append(
            HourlyDemandPoint(
                hour=h,
                label=f"{h:02d}:00",
                actual_avg=round(actual_avg, 1),
                forecast_avg=round(forecast_avg, 1),
            )
        )

    overall_avg_hw = (
        round(statistics.mean(all_headways), 1)
        if all_headways
        else _TARGET_HEADWAY_MIN
    )

    return AdminAnalyticsOut(
        active_vehicles=active_vehicles,
        total_stops=total_stops,
        total_routes=total_routes,
        avg_headway_min=overall_avg_hw,
        bunching_alerts=total_bunching_alerts,
        stop_demands=stop_demands,
        route_headways=route_headways,
        hourly_demand_series=hourly_demand_series,
    )


@router.get("/bunching-experiment", response_model=BunchingExperimentOut)
def get_bunching_experiment(
    db: Session = Depends(get_db),
) -> BunchingExperimentOut:
    """Run simulated 5-seed experiment comparing headway variance with vs without holding."""
    geometries = load_route_geometries(db)
    result = run_bunching_experiment(geometries)
    return BunchingExperimentOut(**result)


_RESULTS_JSON_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent / "ml" / "results.json"
)


@router.get("/results")
def get_benchmark_results() -> dict:
    """Return real benchmark metrics generated by scripts/benchmark.py."""
    if not _RESULTS_JSON_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Benchmark results not generated yet. Run scripts/benchmark.py.",
        )
    return json.loads(_RESULTS_JSON_PATH.read_text(encoding="utf-8"))
