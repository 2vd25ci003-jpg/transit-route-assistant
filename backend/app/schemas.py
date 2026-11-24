"""Pydantic response schemas for the Transit API."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


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


class DirectRouteResult(BaseModel):
    """A single route that connects origin to destination directly."""

    type: Literal["direct"] = "direct"
    route: RouteOut


class TransferRouteResult(BaseModel):
    """Two routes connected by a transfer stop."""

    type: Literal["transfer"] = "transfer"
    first_route: RouteOut
    second_route: RouteOut
    transfer_stop: StopOut


# ---------------------------------------------------------------------------
# ETA
# ---------------------------------------------------------------------------


class EtaOut(BaseModel):
    """Estimated arrival of a bus at a stop."""

    route_id: int
    route_name: str
    trip_id: int
    eta_minutes: float


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
