"""Routes router – list, detail, and search endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Route, RouteStop, Stop
from app.schemas import (
    DirectRouteResult,
    RouteDetailOut,
    RouteOut,
    RouteStopOut,
    StopOut,
    TransferRouteResult,
)

router = APIRouter(prefix="/routes", tags=["routes"])


# ------------------------------------------------------------------
# GET /routes
# ------------------------------------------------------------------


@router.get("", response_model=list[RouteOut])
def list_routes(db: Session = Depends(get_db)):
    """Return every route."""
    return db.query(Route).order_by(Route.id).all()


# ------------------------------------------------------------------
# GET /routes/search  (must be before /{route_id} to avoid shadowing)
# ------------------------------------------------------------------


@router.get("/search", response_model=list[DirectRouteResult | TransferRouteResult])
def search_routes(
    from_stop_id: int = Query(..., alias="from", description="Origin stop ID"),
    to_stop_id: int = Query(..., alias="to", description="Destination stop ID"),
    db: Session = Depends(get_db),
):
    """Find routes connecting two stops (direct and one-transfer options).

    A *direct* result means both stops lie on the same route with the origin
    before the destination.  A *transfer* result means the passenger rides
    route A to an intermediate stop, then switches to route B.
    """
    if db.get(Stop, from_stop_id) is None:
        raise HTTPException(status_code=404, detail="Origin stop not found")
    if db.get(Stop, to_stop_id) is None:
        raise HTTPException(status_code=404, detail="Destination stop not found")

    # Build indexes: route_id → seq for each endpoint stop
    from_entries = (
        db.query(RouteStop).filter(RouteStop.stop_id == from_stop_id).all()
    )
    to_entries = (
        db.query(RouteStop).filter(RouteStop.stop_id == to_stop_id).all()
    )
    from_map: dict[int, int] = {rs.route_id: rs.seq for rs in from_entries}
    to_map: dict[int, int] = {rs.route_id: rs.seq for rs in to_entries}

    results: list[DirectRouteResult | TransferRouteResult] = []

    # --- Direct routes (same route, from_seq < to_seq) ---
    for route_id in set(from_map) & set(to_map):
        if from_map[route_id] < to_map[route_id]:
            route = db.get(Route, route_id)
            results.append(
                DirectRouteResult(route=RouteOut.model_validate(route))
            )

    # --- One-transfer routes ---
    seen: set[tuple[int, int, int]] = set()  # (route_a, route_b, transfer_stop)

    for from_route_id, from_seq in from_map.items():
        # Stops reachable after from_seq on route A → potential transfer points
        candidates = (
            db.query(RouteStop)
            .filter(
                RouteStop.route_id == from_route_id,
                RouteStop.seq > from_seq,
            )
            .all()
        )
        for cand in candidates:
            # Routes that also serve this transfer stop
            transfer_entries = (
                db.query(RouteStop)
                .filter(RouteStop.stop_id == cand.stop_id)
                .all()
            )
            for te in transfer_entries:
                if te.route_id == from_route_id:
                    continue  # same route – already handled as direct
                # Does route B reach the destination after the transfer?
                if te.route_id in to_map and to_map[te.route_id] > te.seq:
                    key = (from_route_id, te.route_id, cand.stop_id)
                    if key not in seen:
                        seen.add(key)
                        results.append(
                            TransferRouteResult(
                                first_route=RouteOut.model_validate(
                                    db.get(Route, from_route_id)
                                ),
                                second_route=RouteOut.model_validate(
                                    db.get(Route, te.route_id)
                                ),
                                transfer_stop=StopOut.model_validate(
                                    db.get(Stop, cand.stop_id)
                                ),
                            )
                        )

    return results


# ------------------------------------------------------------------
# GET /routes/{route_id}
# ------------------------------------------------------------------


@router.get("/{route_id}", response_model=RouteDetailOut)
def get_route(route_id: int, db: Session = Depends(get_db)):
    """Return a route with its ordered stops."""
    route = db.get(Route, route_id)
    if route is None:
        raise HTTPException(status_code=404, detail="Route not found")

    route_stops = (
        db.query(RouteStop)
        .filter(RouteStop.route_id == route_id)
        .order_by(RouteStop.seq)
        .all()
    )

    stops_out: list[RouteStopOut] = []
    for rs in route_stops:
        stop = db.get(Stop, rs.stop_id)
        stops_out.append(
            RouteStopOut(seq=rs.seq, stop=StopOut.model_validate(stop))
        )

    return RouteDetailOut(id=route.id, name=route.name, stops=stops_out)
