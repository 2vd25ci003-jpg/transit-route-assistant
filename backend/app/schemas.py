"""Pydantic response schemas for the Transit API."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Stops
# ---------------------------------------------------------------------------


class StopOut(BaseModel):
    """Public representation of a bus stop."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    lat: float
    lng: float


class NearbyStopOut(StopOut):
    """Stop with computed distance from a reference point."""

    distance_m: float


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


class RouteOut(BaseModel):
    """Minimal route info (id + name)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class RouteStopOut(BaseModel):
    """A stop within a route, including its sequence position."""

    model_config = ConfigDict(from_attributes=True)

    seq: int
    stop: StopOut


class RouteDetailOut(RouteOut):
    """Route with its ordered list of stops."""

    stops: list[RouteStopOut]


# ---------------------------------------------------------------------------
# Route search
# ---------------------------------------------------------------------------


class RouteLegOut(BaseModel):
    """A single route leg within a journey."""

    route: RouteOut
    stops: list[StopOut]
    estimated_minutes: float


class DirectRouteResult(BaseModel):
    """A single route that connects origin to destination directly."""

    type: Literal["direct"] = "direct"
    num_transfers: int = 0
    estimated_minutes: float = 0.0
    route: RouteOut
    legs: list[RouteLegOut] = []
    transfer_stops: list[StopOut] = []


class TransferRouteResult(BaseModel):
    """Multi-leg journey with one or two transfers."""

    type: Literal["transfer"] = "transfer"
    num_transfers: int = 1
    estimated_minutes: float = 0.0
    first_route: RouteOut | None = None
    second_route: RouteOut | None = None
    transfer_stop: StopOut | None = None
    legs: list[RouteLegOut] = []
    transfer_stops: list[StopOut] = []


# ---------------------------------------------------------------------------
# ETA
# ---------------------------------------------------------------------------


class EtaOut(BaseModel):
    """Estimated arrival of a bus at a stop."""

    route_id: int
    route_name: str
    trip_id: int
    eta_minutes: float
    simulated: bool = False


# ---------------------------------------------------------------------------
# Vehicles
# ---------------------------------------------------------------------------


class VehicleOut(BaseModel):
    """Latest known position of a vehicle (one per active trip)."""

    trip_id: int
    route_id: int
    route_name: str
    lat: float
    lng: float
    ts: datetime
    speed_kmh: float | None = None
    simulated: bool = False


# ---------------------------------------------------------------------------
# Forecast
# ---------------------------------------------------------------------------


class ForecastPoint(BaseModel):
    """Single hourly boarding demand prediction."""

    ts: datetime
    predicted_count: float
    baseline_count: float
    actual_count: int | None = None


class ForecastOut(BaseModel):
    """Demand forecast response for a stop."""

    stop_id: int
    stop_name: str
    horizon_hours: int
    model_type: str
    predictions: list[ForecastPoint]


# ---------------------------------------------------------------------------
# Optimizer
# ---------------------------------------------------------------------------


class OptimizeRequest(BaseModel):
    """Request payload for fleet dispatch optimization."""

    stop_ids: list[int] = Field(..., min_length=2)
    fleet_size: int = Field(2, ge=1, le=20)
    depot_stop_id: int | None = None


class OptimizedRouteOut(BaseModel):
    """Ordered stop sequence for one vehicle."""

    vehicle_id: int
    stop_ids: list[int]
    stop_names: list[str]
    distance_km: float


class OptimizeOut(BaseModel):
    """Fleet dispatch optimization result with baseline comparison."""

    fleet_size: int
    routes: list[OptimizedRouteOut]
    total_distance_km: float
    baseline_distance_km: float
    savings_pct: float
    solver: str


# ---------------------------------------------------------------------------
# Admin Analytics
# ---------------------------------------------------------------------------


class StopDemandOut(BaseModel):
    """Aggregated demand stats for a stop (for heatmap)."""

    stop_id: int
    stop_name: str
    lat: float
    lng: float
    avg_hourly_boardings: float
    peak_hour: int
    total_boardings: int


class RouteHeadwayOut(BaseModel):
    """Headway variance and bunching stats for a route."""

    route_id: int
    route_name: str
    target_headway_min: float
    avg_headway_min: float
    headway_std_min: float
    bunching_events: int
    status: str


class HourlyDemandPoint(BaseModel):
    """Hourly actual vs forecast demand point."""

    hour: int
    label: str
    actual_avg: float
    forecast_avg: float


class AdminAnalyticsOut(BaseModel):
    """Operator dashboard summary metrics."""

    active_vehicles: int
    total_stops: int
    total_routes: int
    avg_headway_min: float
    bunching_alerts: int
    stop_demands: list[StopDemandOut]
    route_headways: list[RouteHeadwayOut]
    hourly_demand_series: list[HourlyDemandPoint]


class BunchingExperimentArmOut(BaseModel):
    """Aggregated headway metrics for one simulator configuration."""

    headway_mean_min: float
    headway_std_min: float
    bunching_count: int
    sample_series: list[float]


class BunchingExperimentOut(BaseModel):
    """Simulated comparison of headway variance without vs with holding strategy."""

    simulated: bool = True
    seeds: list[int]
    without_holding: BunchingExperimentArmOut
    with_holding: BunchingExperimentArmOut
    std_reduction_pct: float

