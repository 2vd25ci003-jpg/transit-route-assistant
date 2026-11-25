"""Fleet dispatch / route optimization: Nearest-Neighbor baseline + OR-Tools mTSP/CVRP.

Given a list of stops (with coordinates), a depot stop, and a fleet size K,
computes ordered stop sequences for K vehicles and compares total route distance
between:
  1. Nearest-Neighbor greedy heuristic (baseline)
  2. Google OR-Tools Vehicle Routing solver (with balanced route lengths)
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from ortools.constraint_solver import pywrapcp, routing_enums_pb2


@dataclass(frozen=True)
class StopPoint:
    """Lightweight stop coordinate container."""

    id: int
    name: str
    lat: float
    lng: float


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


def build_distance_matrix_m(stops: list[StopPoint]) -> list[list[int]]:
    """Build integer metre distance matrix for OR-Tools."""
    n = len(stops)
    matrix: list[list[int]] = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            dist_m = int(
                round(
                    haversine_km(
                        stops[i].lat, stops[i].lng, stops[j].lat, stops[j].lng
                    )
                    * 1000
                )
            )
            matrix[i][j] = dist_m
            matrix[j][i] = dist_m
    return matrix


def _route_distance_km(stops: list[StopPoint], order: list[int]) -> float:
    """Total closed-loop distance in km for a list of stop indices."""
    if len(order) <= 1:
        return 0.0
    total = 0.0
    for i in range(len(order) - 1):
        a, b = stops[order[i]], stops[order[i + 1]]
        total += haversine_km(a.lat, a.lng, b.lat, b.lng)
    return total


def solve_nearest_neighbor(
    stops: list[StopPoint],
    fleet_size: int,
    depot_idx: int = 0,
) -> tuple[list[list[int]], float]:
    """Greedy nearest-neighbor baseline split evenly across *fleet_size* vehicles.

    Each vehicle starts and ends at *depot_idx*.
    Returns (list of index-lists per vehicle, total distance in km).
    """
    n = len(stops)
    if n <= 1:
        return ([[depot_idx] for _ in range(fleet_size)], 0.0)

    unvisited = {i for i in range(n) if i != depot_idx}
    routes: list[list[int]] = [[depot_idx] for _ in range(fleet_size)]

    # Round-robin greedy assignment from each vehicle's current tip
    while unvisited:
        for v in range(fleet_size):
            if not unvisited:
                break
            curr = routes[v][-1]
            nxt = min(
                unvisited,
                key=lambda j: haversine_km(
                    stops[curr].lat, stops[curr].lng, stops[j].lat, stops[j].lng
                ),
            )
            routes[v].append(nxt)
            unvisited.remove(nxt)

    total_km = 0.0
    for r in routes:
        if len(r) > 1:
            r.append(depot_idx)
        total_km += _route_distance_km(stops, r)

    return routes, round(total_km, 3)


def solve_ortools(
    stops: list[StopPoint],
    fleet_size: int,
    depot_idx: int = 0,
    time_limit_s: int = 3,
) -> tuple[list[list[int]], float]:
    """Solve mTSP using Google OR-Tools with balanced distance span."""
    n = len(stops)
    if n <= 1:
        return ([[depot_idx] for _ in range(fleet_size)], 0.0)

    dist_matrix = build_distance_matrix_m(stops)
    manager = pywrapcp.RoutingIndexManager(n, fleet_size, depot_idx)
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return dist_matrix[from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # Encourage balanced routes across the fleet
    max_dist_m = sum(max(row) for row in dist_matrix) + 1000
    routing.AddDimension(
        transit_callback_index,
        0,  # no slack
        max_dist_m,
        True,  # start cumul to zero
        "Distance",
    )
    distance_dimension = routing.GetDimensionOrDie("Distance")
    distance_dimension.SetGlobalSpanCostCoefficient(100)

    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_params.time_limit.seconds = time_limit_s

    solution = routing.SolveWithParameters(search_params)
    if solution is None:
        return solve_nearest_neighbor(stops, fleet_size, depot_idx)

    routes: list[list[int]] = []
    total_km = 0.0
    for v in range(fleet_size):
        index = routing.Start(v)
        route: list[int] = []
        while not routing.IsEnd(index):
            route.append(manager.IndexToNode(index))
            index = solution.Value(routing.NextVar(index))
        route.append(manager.IndexToNode(index))
        # Collapse empty [depot, depot] to [depot]
        if len(route) == 2 and route[0] == route[1]:
            route = [route[0]]
        routes.append(route)
        total_km += _route_distance_km(stops, route)

    return routes, round(total_km, 3)


def optimize_dispatch(
    stops: list[StopPoint],
    fleet_size: int,
    depot_stop_id: int | None = None,
) -> dict:
    """Run both nearest-neighbor baseline and OR-Tools solver and return comparison."""
    if not stops:
        return {
            "fleet_size": fleet_size,
            "routes": [],
            "total_distance_km": 0.0,
            "baseline_distance_km": 0.0,
            "savings_pct": 0.0,
            "solver": "ortools",
        }

    depot_idx = 0
    if depot_stop_id is not None:
        for idx, s in enumerate(stops):
            if s.id == depot_stop_id:
                depot_idx = idx
                break

    _, baseline_km = solve_nearest_neighbor(stops, fleet_size, depot_idx)
    or_routes, or_km = solve_ortools(stops, fleet_size, depot_idx)

    # If OR-Tools produced worse or equal distance on tiny instances, still report real numbers
    savings_pct = (
        round(((baseline_km - or_km) / baseline_km) * 100.0, 2)
        if baseline_km > 0
        else 0.0
    )

    formatted_routes = []
    for v_idx, order in enumerate(or_routes, start=1):
        dist = round(_route_distance_km(stops, order), 3)
        formatted_routes.append({
            "vehicle_id": v_idx,
            "stop_ids": [stops[i].id for i in order],
            "stop_names": [stops[i].name for i in order],
            "distance_km": dist,
        })

    return {
        "fleet_size": fleet_size,
        "routes": formatted_routes,
        "total_distance_km": or_km,
        "baseline_distance_km": baseline_km,
        "savings_pct": savings_pct,
        "solver": "ortools",
    }
