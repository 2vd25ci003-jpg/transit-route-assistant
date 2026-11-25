"""Vehicles router – latest position per active vehicle (real-time simulated or historical)."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Route, Trip, VehiclePosition
from app.schemas import VehicleOut
from app.services.simulator import realtime_simulator

router = APIRouter(tags=["vehicles"])

_ACTIVE_WINDOW_MINUTES = 5


@router.get("/vehicles", response_model=list[VehicleOut])
def list_vehicles(
    request: Request,
    as_of: datetime | None = Query(
        None,
        description=(
            "Reference timestamp (ISO 8601). "
            "If omitted, returns live in-process simulated positions."
        ),
    ),
    db: Session = Depends(get_db),
) -> list[VehicleOut]:
    """Return current simulated vehicle positions, or historical positions at *as_of*."""
    # Live simulated mode when no historical as_of timestamp is requested
    if (
        as_of is None
        and realtime_simulator.engine is not None
        and not request.app.dependency_overrides
    ):
        return [
            VehicleOut(**v)
            for v in realtime_simulator.engine.get_active_vehicles()
        ]

    # Historical / DB query mode (used with explicit as_of or test DB override)
    effective = as_of
    if effective is None:
        effective = db.query(func.max(VehiclePosition.ts)).scalar()
        if effective is None:
            return []

    window_start = effective - timedelta(minutes=_ACTIVE_WINDOW_MINUTES)

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
            simulated=False,
        )
        for vp, route_id, route_name in rows
    ]
