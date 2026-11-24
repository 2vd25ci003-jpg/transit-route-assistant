"""Vehicles router – latest position per active vehicle."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Route, Trip, VehiclePosition
from app.schemas import VehicleOut

router = APIRouter(tags=["vehicles"])

# Active-vehicle look-back window (minutes)
_ACTIVE_WINDOW_MINUTES = 5


@router.get("/vehicles", response_model=list[VehicleOut])
def list_vehicles(
    as_of: datetime | None = Query(
        None,
        description=(
            "Reference timestamp (ISO 8601). "
            "Defaults to the latest vehicle-position timestamp."
        ),
    ),
    db: Session = Depends(get_db),
) -> list[VehicleOut]:
    """Return the latest position for each currently-active vehicle.

    A trip is considered active if it has at least one vehicle position
    within 5 minutes before *as_of*.
    """
    # Resolve as_of
    effective = as_of
    if effective is None:
        effective = db.query(func.max(VehiclePosition.ts)).scalar()
        if effective is None:
            return []

    window_start = effective - timedelta(minutes=_ACTIVE_WINDOW_MINUTES)

    # Subquery: latest ts per trip in the [window_start, as_of] window
    latest_sub = (
        db.query(
            VehiclePosition.trip_id,
            func.max(VehiclePosition.ts).label("max_ts"),
        )
        .filter(
            VehiclePosition.ts >= window_start,
            VehiclePosition.ts <= effective,
        )
        .group_by(VehiclePosition.trip_id)
        .subquery()
    )

    rows = (
        db.query(VehiclePosition, Route.id, Route.name)
        .join(
            latest_sub,
            and_(
                VehiclePosition.trip_id == latest_sub.c.trip_id,
                VehiclePosition.ts == latest_sub.c.max_ts,
            ),
        )
        .join(Trip, VehiclePosition.trip_id == Trip.id)
        .join(Route, Trip.route_id == Route.id)
        .all()
    )

    return [
        VehicleOut(
            trip_id=vp.trip_id,
            route_id=route_id,
            route_name=route_name,
            lat=vp.lat,
            lng=vp.lng,
            ts=vp.ts,
        )
        for vp, route_id, route_name in rows
    ]
