"""Admin analytics router – demand heatmap, headway variance, and forecast vs actual."""

from __future__ import annotations

import json
import statistics
from datetime import timedelta
from pathlib import Path

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

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
    run_bunching_experiment,
)

router = APIRouter(prefix="/admin", tags=["admin"])

_TARGET_HEADWAY_MIN = 10.0
_BUNCHING_THRESHOLD_MIN = 4.0


@router.get("/analytics", response_model=AdminAnalyticsOut)
def get_admin_analytics(db: Session = Depends(get_db)) -> AdminAnalyticsOut:
    """Aggregate live fleet, headway variance, stop demand, and hourly series."""
    total_stops = db.query(func.count(Stop.id)).scalar() or 0
    total_routes = db.query(func.count(Route.id)).scalar() or 0

    # Active vehicles in the 5-min window ending at latest VP timestamp
    latest_vp_ts = db.query(func.max(VehiclePosition.ts)).scalar()
    active_vehicles = 0
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

    # Stop demand heatmap
    stops = db.query(Stop).order_by(Stop.id).all()
    stop_demands: list[StopDemandOut] = []
    for s in stops:
        b_rows = (
            db.query(Boarding.ts, Boarding.count)
            .filter(Boarding.stop_id == s.id)
            .all()
        )
        if not b_rows:
            stop_demands.append(
                StopDemandOut(
                    stop_id=s.id,
                    stop_name=s.name,
                    lat=s.lat,
                    lng=s.lng,
                    avg_hourly_boardings=0.0,
                    peak_hour=8,
                    total_boardings=0,
                )
            )
            continue

        total_b = sum(r.count for r in b_rows)
        avg_b = total_b / len(b_rows)
        by_hour: dict[int, list[int]] = {}
        for r in b_rows:
            by_hour.setdefault(r.ts.hour, []).append(r.count)
        peak_h = max(by_hour.keys(), key=lambda h: sum(by_hour[h]) / len(by_hour[h]))
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

    # Headway variance per route (from recent trips' stop-arrival timestamps)
    routes = db.query(Route).order_by(Route.id).all()
    route_headways: list[RouteHeadwayOut] = []
    all_headways: list[float] = []
    total_bunching_alerts = 0

    for r in routes:
        recent_trips = (
            db.query(Trip)
            .filter(Trip.route_id == r.id)
            .order_by(Trip.start_time.desc())
            .limit(12)
            .all()
        )
        recent_trips.reverse()  # chronological

        trip_times: list[list] = []
        for t in recent_trips:
            vps = (
                db.query(VehiclePosition.ts)
                .filter(VehiclePosition.trip_id == t.id)
                .order_by(VehiclePosition.ts)
                .all()
            )
            if vps:
                trip_times.append([v[0] for v in vps])

        headways: list[float] = []
        bunching_count = 0
        for idx in range(len(trip_times) - 1):
            t_a = trip_times[idx]
            t_b = trip_times[idx + 1]
            # Only compare trips from the same day/session (start gap < 60 min)
            start_gap = (t_b[0] - t_a[0]).total_seconds() / 60.0
            if 0 < start_gap < 60.0:
                n = min(len(t_a), len(t_b))
                for stop_i in range(n):
                    hw = (t_b[stop_i] - t_a[stop_i]).total_seconds() / 60.0
                    headways.append(hw)
                    if hw < _BUNCHING_THRESHOLD_MIN:
                        bunching_count += 1

        if headways:
            avg_hw = statistics.mean(headways)
            std_hw = statistics.stdev(headways) if len(headways) > 1 else 0.0
            all_headways.extend(headways)
        else:
            avg_hw = _TARGET_HEADWAY_MIN
            std_hw = 0.0

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

    # Hourly demand series: actual average vs RF model prediction across stops
    hourly_demand_series: list[HourlyDemandPoint] = []
    all_boardings = db.query(Boarding.stop_id, Boarding.ts, Boarding.count).all()
    by_hour_all: dict[int, list[int]] = {}
    for b in all_boardings:
        by_hour_all.setdefault(b.ts.hour, []).append(b.count)

    model = _get_model()
    for h in sorted(by_hour_all.keys()):
        actual_avg = float(np.mean(by_hour_all[h]))
        if model is not None and stops:
            # Predict for a representative weekday using actual_avg as lag_7d proxy
            preds = [
                max(
                    0.0,
                    float(
                        model.predict(
                            np.array([[float(s.id), float(h), 2.0, 0.0, actual_avg]])
                        )[0]
                    ),
                )
                for s in stops
            ]
            forecast_avg = float(np.mean(preds))
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
