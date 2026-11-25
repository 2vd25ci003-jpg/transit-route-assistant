"""Stops router – list, nearby, and distance/speed/dwell-based ETA endpoints."""

from __future__ import annotations

import math
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Boarding, Route, RouteStop, Stop, Trip, VehiclePosition
from app.schemas import EtaOut, NearbyStopOut, StopOut
from app.services.simulator import (
    BASE_DWELL_SECONDS,
    DEFAULT_BASE_SPEED_KMH,
    DWELL_SECONDS_PER_BOARDING,
    MIN_SPEED_KMH,
    realtime_simulator,
)

router = APIRouter(prefix="/stops", tags=["stops"])

_ACTIVE_WINDOW_MINUTES = 5


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return the great-circle distance in metres between two points."""
    r = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    )
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    return _haversine_m(lat1, lng1, lat2, lng2) / 1000.0


@router.get("", response_model=list[StopOut])
def list_stops(db: Session = Depends(get_db)):
    """Return every stop."""
    return db.query(Stop).order_by(Stop.id).all()


@router.get("/nearby", response_model=list[NearbyStopOut])
def nearby_stops(
    lat: float = Query(..., description="Latitude of the reference point"),
    lng: float = Query(..., description="Longitude of the reference point"),
    radius_m: float = Query(1000, ge=0, description="Search radius in metres"),
    db: Session = Depends(get_db),
) -> list[NearbyStopOut]:
    """Return stops within *radius_m* metres of (lat, lng), sorted by distance."""
    results: list[NearbyStopOut] = []
    for s in db.query(Stop).all():
        d = _haversine_m(lat, lng, s.lat, s.lng)
        if d <= radius_m:
            results.append(
                NearbyStopOut(
                    id=s.id,
                    name=s.name,
                    lat=s.lat,
                    lng=s.lng,
                    distance_m=round(d, 1),
                )
            )
    results.sort(key=lambda r: r.distance_m)
    return results


def _resolve_as_of(db: Session, as_of: datetime | None) -> datetime | None:
    if as_of is not None:
        return as_of
    return db.query(func.max(VehiclePosition.ts)).scalar()


@router.get("/{stop_id}/eta", response_model=list[EtaOut])
def stop_eta(
    stop_id: int,
    request: Request,
    as_of: datetime | None = Query(
        None,
        description=(
            "Reference timestamp (ISO 8601). "
            "If omitted, computes ETA from live simulated vehicles."
        ),
    ),
    db: Session = Depends(get_db),
) -> list[EtaOut]:
    """Next arriving buses at a stop, sorted by ETA (up to 5).

    Computes ETA from remaining route distance, vehicle speed, and expected
    stop dwell time (never from ping counts).
    """
    stop = db.get(Stop, stop_id)
    if stop is None:
        raise HTTPException(status_code=404, detail="Stop not found")

    # Live simulated mode
    if (
        as_of is None
        and realtime_simulator.engine is not None
        and not request.app.dependency_overrides
    ):
        return [
            EtaOut(**e)
            for e in realtime_simulator.engine.compute_etas_for_stop(stop_id)
        ]

    # Historical / DB mode: compute ETA from distance, speed, and dwell
    effective = _resolve_as_of(db, as_of)
    if effective is None:
        return []

    window_start = effective - timedelta(minutes=_ACTIVE_WINDOW_MINUTES)

    target_route_stops = (
        db.query(RouteStop).filter(RouteStop.stop_id == stop_id).all()
    )
    if not target_route_stops:
        return []

    avg_boardings_map: dict[int, float] = {
        sid: float(cnt)
        for sid, cnt in db.query(Boarding.stop_id, func.avg(Boarding.count))
        .group_by(Boarding.stop_id)
        .all()
    }

    results: list[EtaOut] = []

    for trs in target_route_stops:
        route = db.get(Route, trs.route_id)
        ordered_stops = (
            db.query(Stop)
            .join(RouteStop, RouteStop.stop_id == Stop.id)
            .filter(RouteStop.route_id == trs.route_id)
            .order_by(RouteStop.seq)
            .all()
        )
        if not ordered_stops:
            continue

        target_indices = [
            i for i, s in enumerate(ordered_stops) if s.id == stop_id
        ]
        if not target_indices:
            continue
        target_idx = target_indices[0]

        active_trip_rows = (
            db.query(VehiclePosition.trip_id)
            .join(Trip, VehiclePosition.trip_id == Trip.id)
            .filter(
                Trip.route_id == trs.route_id,
                VehiclePosition.ts >= window_start,
                VehiclePosition.ts <= effective,
            )
            .distinct()
            .all()
        )

        for (trip_id,) in active_trip_rows:
            trip_vps = (
                db.query(VehiclePosition)
                .filter(
                    VehiclePosition.trip_id == trip_id,
                    VehiclePosition.ts <= effective,
                )
                .order_by(VehiclePosition.ts)
                .all()
            )
            if not trip_vps:
                continue

            latest_vp = trip_vps[-1]
            # Locate nearest stop along the route to the bus's latest GPS position
            nearest_idx = min(
                range(len(ordered_stops)),
                key=lambda i: _haversine_km(
                    latest_vp.lat,
                    latest_vp.lng,
                    ordered_stops[i].lat,
                    ordered_stops[i].lng,
                ),
            )
            if nearest_idx >= target_idx:
                continue  # already at or past target stop

            # Remaining distance from latest_vp -> next stop -> ... -> target_stop
            rem_km = _haversine_km(
                latest_vp.lat,
                latest_vp.lng,
                ordered_stops[nearest_idx + 1].lat,
                ordered_stops[nearest_idx + 1].lng,
            )
            for idx in range(nearest_idx + 1, target_idx):
                rem_km += _haversine_km(
                    ordered_stops[idx].lat,
                    ordered_stops[idx].lng,
                    ordered_stops[idx + 1].lat,
                    ordered_stops[idx + 1].lng,
                )

            # Estimate speed from trip's own distance/time if >= 2 pings
            speed_kmh = DEFAULT_BASE_SPEED_KMH
            if len(trip_vps) >= 2:
                dt_hours = (
                    trip_vps[-1].ts - trip_vps[0].ts
                ).total_seconds() / 3600.0
                dist_traveled = sum(
                    _haversine_km(
                        trip_vps[k].lat,
                        trip_vps[k].lng,
                        trip_vps[k + 1].lat,
                        trip_vps[k + 1].lng,
                    )
                    for k in range(len(trip_vps) - 1)
                )
                if dt_hours > 0 and dist_traveled > 0.05:
                    speed_kmh = max(
                        MIN_SPEED_KMH, min(40.0, dist_traveled / dt_hours)
                    )

            travel_min = (rem_km / speed_kmh) * 60.0
            dwell_s = sum(
                BASE_DWELL_SECONDS
                + DWELL_SECONDS_PER_BOARDING
                * avg_boardings_map.get(ordered_stops[idx].id, 10.0)
                for idx in range(nearest_idx + 1, target_idx)
            )
            eta_min = round(travel_min + dwell_s / 60.0, 1)

            results.append(
                EtaOut(
                    route_id=route.id,
                    route_name=route.name,
                    trip_id=trip_id,
                    eta_minutes=eta_min,
                    simulated=False,
                )
            )

    results.sort(key=lambda e: e.eta_minutes)
    return results[:5]
