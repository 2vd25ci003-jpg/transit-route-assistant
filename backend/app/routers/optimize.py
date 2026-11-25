"""Optimize router – fleet dispatch optimization using OR-Tools + NN baseline."""

from __future__ import annotations

import sys
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Stop
from app.schemas import OptimizedRouteOut, OptimizeOut, OptimizeRequest

# Allow importing ml/optimizer.py from project root
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from ml.optimizer import StopPoint, optimize_dispatch  # noqa: E402

router = APIRouter(tags=["optimize"])


@router.post("/optimize", response_model=OptimizeOut)
def optimize_routes(
    payload: OptimizeRequest,
    db: Session = Depends(get_db),
) -> OptimizeOut:
    """Compute optimal vehicle dispatch routes for the requested stops and fleet size."""
    unique_ids = list(dict.fromkeys(payload.stop_ids))
    if len(unique_ids) < 2:
        raise HTTPException(
            status_code=422, detail="At least 2 distinct stop IDs are required"
        )

    stops_by_id: dict[int, Stop] = {}
    for sid in unique_ids:
        stop = db.get(Stop, sid)
        if stop is None:
            raise HTTPException(
                status_code=404, detail=f"Stop {sid} not found"
            )
        stops_by_id[sid] = stop

    if (
        payload.depot_stop_id is not None
        and payload.depot_stop_id not in stops_by_id
    ):
        depot = db.get(Stop, payload.depot_stop_id)
        if depot is None:
            raise HTTPException(
                status_code=404,
                detail=f"Depot stop {payload.depot_stop_id} not found",
            )
        stops_by_id[depot.id] = depot
        unique_ids.insert(0, depot.id)

    points = [
        StopPoint(
            id=stops_by_id[sid].id,
            name=stops_by_id[sid].name,
            lat=stops_by_id[sid].lat,
            lng=stops_by_id[sid].lng,
        )
        for sid in unique_ids
    ]

    result = optimize_dispatch(
        points,
        fleet_size=payload.fleet_size,
        depot_stop_id=payload.depot_stop_id,
    )

    return OptimizeOut(
        fleet_size=result["fleet_size"],
        routes=[OptimizedRouteOut(**r) for r in result["routes"]],
        total_distance_km=result["total_distance_km"],
        baseline_distance_km=result["baseline_distance_km"],
        savings_pct=result["savings_pct"],
        solver=result["solver"],
    )
