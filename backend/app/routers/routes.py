"""Routes router – list, detail, and bidirectional/circular/multi-transfer search."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Route, RouteStop, Stop
from app.schemas import (
    DirectRouteResult,
    RouteDetailOut,
    RouteLegOut,
    RouteOut,
    RouteStopOut,
    StopOut,
    TransferRouteResult,
)

router = APIRouter(prefix="/routes", tags=["routes"])

_INTER_STOP_MINUTES = 4.0
_TRANSFER_PENALTY_MINUTES = 5.0


@dataclass(frozen=True)
class _RouteGraph:
    """In-memory transit route graph built from routes, route_stops, and stops."""

    stops_by_id: dict[int, StopOut]
    routes_by_id: dict[int, RouteOut]
    route_stops: dict[int, list[int]]  # route_id -> ordered stop_ids
    circular_routes: set[int]
    stop_to_routes: dict[int, list[int]]  # stop_id -> route_ids


def _build_route_graph(db: Session) -> _RouteGraph:
    """Load all stops, routes, and route_stops into an in-memory graph."""
    stops_by_id = {
        s.id: StopOut.model_validate(s) for s in db.query(Stop).all()
    }
    routes = db.query(Route).order_by(Route.id).all()
    routes_by_id = {r.id: RouteOut.model_validate(r) for r in routes}
    circular_routes = {
        r.id for r in routes if "circular" in r.name.lower()
    }

    all_rs = (
        db.query(RouteStop)
        .order_by(RouteStop.route_id, RouteStop.seq)
        .all()
    )

    route_stops: dict[int, list[int]] = {}
    stop_to_routes: dict[int, list[int]] = {}
    for rs in all_rs:
        route_stops.setdefault(rs.route_id, []).append(rs.stop_id)
        routes_for_stop = stop_to_routes.setdefault(rs.stop_id, [])
        if rs.route_id not in routes_for_stop:
            routes_for_stop.append(rs.route_id)

    return _RouteGraph(
        stops_by_id=stops_by_id,
        routes_by_id=routes_by_id,
        route_stops=route_stops,
        circular_routes=circular_routes,
        stop_to_routes=stop_to_routes,
    )


def _shortest_leg_stop_ids(
    seq_stops: list[int],
    from_stop_id: int,
    to_stop_id: int,
    is_circular: bool,
) -> list[int] | None:
    """Return the shortest ordered stop_id path between two stops on a route.

    Supports both forward and reverse travel on every route, plus wrap-around
    for circular routes.
    """
    if from_stop_id == to_stop_id:
        return None

    from_indices = [i for i, sid in enumerate(seq_stops) if sid == from_stop_id]
    to_indices = [i for i, sid in enumerate(seq_stops) if sid == to_stop_id]
    if not from_indices or not to_indices:
        return None

    n = len(seq_stops)
    best_path: list[int] | None = None

    for fi in from_indices:
        for ti in to_indices:
            if fi < ti:
                cand_fwd = seq_stops[fi : ti + 1]
                candidates = [cand_fwd]
                if is_circular:
                    # Wrap backwards: fi -> 0 -> n-1 -> ti
                    cand_wrap = (
                        list(reversed(seq_stops[: fi + 1]))
                        + list(reversed(seq_stops[ti:]))
                    )
                    candidates.append(cand_wrap)
            else:
                # Reverse travel: fi -> ti
                cand_rev = list(reversed(seq_stops[ti : fi + 1]))
                candidates = [cand_rev]
                if is_circular:
                    # Wrap forwards: fi -> n-1 -> 0 -> ti
                    cand_wrap = seq_stops[fi:] + seq_stops[: ti + 1]
                    candidates.append(cand_wrap)

            for path in candidates:
                if best_path is None or len(path) < len(best_path):
                    best_path = path

    return best_path


def _make_leg(
    graph: _RouteGraph,
    route_id: int,
    stop_ids: list[int],
) -> RouteLegOut:
    """Construct a RouteLegOut with ordered StopOut items and estimated minutes."""
    hops = max(1, len(stop_ids) - 1)
    return RouteLegOut(
        route=graph.routes_by_id[route_id],
        stops=[graph.stops_by_id[sid] for sid in stop_ids],
        estimated_minutes=round(hops * _INTER_STOP_MINUTES, 1),
    )


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
) -> list[DirectRouteResult | TransferRouteResult]:
    """Find direct, one-transfer, and two-transfer journeys between two stops.

    Builds the route graph once in memory, supports bidirectional travel on
    all routes, wraps around on circular routes, and ranks results by
    ``(num_transfers, estimated_minutes)``.
    """
    graph = _build_route_graph(db)

    if from_stop_id not in graph.stops_by_id:
        raise HTTPException(status_code=404, detail="Origin stop not found")
    if to_stop_id not in graph.stops_by_id:
        raise HTTPException(status_code=404, detail="Destination stop not found")
    if from_stop_id == to_stop_id:
        return []

    from_routes = graph.stop_to_routes.get(from_stop_id, [])
    to_routes = graph.stop_to_routes.get(to_stop_id, [])
    if not from_routes or not to_routes:
        return []

    results: list[DirectRouteResult | TransferRouteResult] = []

    # --- 0-Transfer (Direct) ---
    direct_route_ids: set[int] = set(from_routes) & set(to_routes)
    for rid in sorted(direct_route_ids):
        path = _shortest_leg_stop_ids(
            graph.route_stops[rid],
            from_stop_id,
            to_stop_id,
            rid in graph.circular_routes,
        )
        if path:
            leg = _make_leg(graph, rid, path)
            results.append(
                DirectRouteResult(
                    num_transfers=0,
                    estimated_minutes=leg.estimated_minutes,
                    route=graph.routes_by_id[rid],
                    legs=[leg],
                    transfer_stops=[],
                )
            )

    # --- 1-Transfer ---
    best_one_transfer: dict[tuple[int, int], TransferRouteResult] = {}
    for r1 in from_routes:
        r1_stops = graph.route_stops[r1]
        for t1 in r1_stops:
            if t1 == from_stop_id or t1 == to_stop_id:
                continue
            for r2 in graph.stop_to_routes.get(t1, []):
                if r2 == r1 or r2 not in to_routes:
                    continue
                p1 = _shortest_leg_stop_ids(
                    r1_stops, from_stop_id, t1, r1 in graph.circular_routes
                )
                p2 = _shortest_leg_stop_ids(
                    graph.route_stops[r2], t1, to_stop_id, r2 in graph.circular_routes
                )
                if not p1 or not p2:
                    continue
                leg1 = _make_leg(graph, r1, p1)
                leg2 = _make_leg(graph, r2, p2)
                total_min = round(
                    leg1.estimated_minutes
                    + leg2.estimated_minutes
                    + _TRANSFER_PENALTY_MINUTES,
                    1,
                )
                key = (r1, r2)
                if (
                    key not in best_one_transfer
                    or total_min < best_one_transfer[key].estimated_minutes
                ):
                    t1_out = graph.stops_by_id[t1]
                    best_one_transfer[key] = TransferRouteResult(
                        num_transfers=1,
                        estimated_minutes=total_min,
                        first_route=graph.routes_by_id[r1],
                        second_route=graph.routes_by_id[r2],
                        transfer_stop=t1_out,
                        legs=[leg1, leg2],
                        transfer_stops=[t1_out],
                    )

    results.extend(best_one_transfer.values())

    # --- 2-Transfer ---
    # Only include 2-transfer options when no direct route exists (or to complement)
    best_two_transfer: dict[tuple[int, int, int], TransferRouteResult] = {}
    if not direct_route_ids:
        for r1 in from_routes:
            r1_stops = graph.route_stops[r1]
            for t1 in r1_stops:
                if t1 == from_stop_id or t1 == to_stop_id:
                    continue
                for r2 in graph.stop_to_routes.get(t1, []):
                    if r2 == r1:
                        continue
                    r2_stops = graph.route_stops[r2]
                    for t2 in r2_stops:
                        if t2 in (from_stop_id, to_stop_id, t1):
                            continue
                        for r3 in graph.stop_to_routes.get(t2, []):
                            if r3 == r2 or r3 == r1 or r3 not in to_routes:
                                continue
                            p1 = _shortest_leg_stop_ids(
                                r1_stops, from_stop_id, t1, r1 in graph.circular_routes
                            )
                            p2 = _shortest_leg_stop_ids(
                                r2_stops, t1, t2, r2 in graph.circular_routes
                            )
                            p3 = _shortest_leg_stop_ids(
                                graph.route_stops[r3],
                                t2,
                                to_stop_id,
                                r3 in graph.circular_routes,
                            )
                            if not p1 or not p2 or not p3:
                                continue
                            leg1 = _make_leg(graph, r1, p1)
                            leg2 = _make_leg(graph, r2, p2)
                            leg3 = _make_leg(graph, r3, p3)
                            total_min = round(
                                leg1.estimated_minutes
                                + leg2.estimated_minutes
                                + leg3.estimated_minutes
                                + 2 * _TRANSFER_PENALTY_MINUTES,
                                1,
                            )
                            key = (r1, r2, r3)
                            if (
                                key not in best_two_transfer
                                or total_min < best_two_transfer[key].estimated_minutes
                            ):
                                t1_out = graph.stops_by_id[t1]
                                t2_out = graph.stops_by_id[t2]
                                best_two_transfer[key] = TransferRouteResult(
                                    num_transfers=2,
                                    estimated_minutes=total_min,
                                    first_route=graph.routes_by_id[r1],
                                    second_route=graph.routes_by_id[r2],
                                    transfer_stop=t1_out,
                                    legs=[leg1, leg2, leg3],
                                    transfer_stops=[t1_out, t2_out],
                                )

        results.extend(best_two_transfer.values())

    results.sort(key=lambda r: (r.num_transfers, r.estimated_minutes))
    return results[:10]


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
