"""Stops router – list, nearby, and ETA endpoints."""

import math
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Route, RouteStop, Stop, Trip, VehiclePosition
from app.schemas import EtaOut, NearbyStopOut, StopOut

router = APIRouter(prefix="/stops", tags=["stops"])

# Average inter-stop travel time (minutes) – matches data/generate.py
_INTER_STOP_MINUTES = 4.0
# Active-vehicle look-back window (minutes)
_ACTIVE_WINDOW_MINUTES = 5


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return the great-circle distance in metres between two points."""
    R = 6_371_000  # Earth's mean radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ------------------------------------------------------------------
# GET /stops
# ------------------------------------------------------------------


@router.get("", response_model=list[StopOut])
def list_stops(db: Session = Depends(get_db)):
    """Return every stop."""
    return db.query(Stop).order_by(Stop.id).all()


# ------------------------------------------------------------------
# GET /stops/nearby
# ------------------------------------------------------------------


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
                    id=s.id, name=s.name, lat=s.lat, lng=s.lng,
                    distance_m=round(d, 1),
                )
            )
    results.sort(key=lambda r: r.distance_m)
    return results


# ------------------------------------------------------------------
# GET /stops/{stop_id}/eta
# ------------------------------------------------------------------


def _resolve_as_of(db: Session, as_of: datetime | None) -> datetime | None:
    """Return *as_of* or fall back to the latest vehicle-position timestamp."""
    if as_of is not None:
        return as_of
    return db.query(func.max(VehiclePosition.ts)).scalar()


@router.get("/{stop_id}/eta", response_model=list[EtaOut])
def stop_eta(
    stop_id: int,
    as_of: datetime | None = Query(
        None,
        description=(
            "Reference timestamp (ISO 8601). "
            "Defaults to the latest vehicle-position timestamp."
        ),
    ),
    db: Session = Depends(get_db),
) -> list[EtaOut]:
    """Estimated arrival times for the next buses at a stop.

    Only trips with a vehicle position within 5 minutes before *as_of* are
    considered active.
    """
    stop = db.get(Stop, stop_id)
    if stop is None:
        raise HTTPException(status_code=404, detail="Stop not found")

    effective = _resolve_as_of(db, as_of)
    if effective is None:
        return []  # no vehicle data at all

    window_start = effective - timedelta(minutes=_ACTIVE_WINDOW_MINUTES)

    # Routes that serve this stop (and their seq position)
    target_route_stops = (
        db.query(RouteStop).filter(RouteStop.stop_id == stop_id).all()
    )
    if not target_route_stops:
        return []

    results: list[EtaOut] = []

    for trs in target_route_stops:
        target_seq = trs.seq
        route = db.get(Route, trs.route_id)

        # Coordinates of every stop on this route (for nearest-stop matching)
        route_stop_coords: list[tuple[int, float, float]] = (
            db.query(RouteStop.seq, Stop.lat, Stop.lng)
            .join(Stop, RouteStop.stop_id == Stop.id)
            .filter(RouteStop.route_id == trs.route_id)
            .order_by(RouteStop.seq)
            .all()
        )

        # Latest position per active trip on this route
        latest_sub = (
            db.query(
                VehiclePosition.trip_id,
                func.max(VehiclePosition.ts).label("max_ts"),
            )
            .join(Trip, VehiclePosition.trip_id == Trip.id)
            .filter(
                Trip.route_id == trs.route_id,
                VehiclePosition.ts >= window_start,
                VehiclePosition.ts <= effective,
            )
            .group_by(VehiclePosition.trip_id)
            .subquery()
        )

        positions = (
            db.query(VehiclePosition)
            .join(
                latest_sub,
                and_(
                    VehiclePosition.trip_id == latest_sub.c.trip_id,
                    VehiclePosition.ts == latest_sub.c.max_ts,
                ),
            )
            .all()
        )

        for vp in positions:
            # Find which route-stop seq the vehicle is closest to
            best_seq = route_stop_coords[0][0]
            best_dist = float("inf")
            for seq, slat, slng in route_stop_coords:
                d = (vp.lat - slat) ** 2 + (vp.lng - slng) ** 2
                if d < best_dist:
                    best_dist = d
                    best_seq = seq

            # Include buses that haven't yet passed the target stop
            if best_seq <= target_seq:
                stops_away = target_seq - best_seq
                results.append(
                    EtaOut(
                        route_id=route.id,
                        route_name=route.name,
                        trip_id=vp.trip_id,
                        eta_minutes=round(stops_away * _INTER_STOP_MINUTES, 1),
                    )
                )

    results.sort(key=lambda e: e.eta_minutes)
    return results
