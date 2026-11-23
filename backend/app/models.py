"""SQLAlchemy models – mirrors SPEC.md Section 6 data model."""

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Stop(Base):
    """Bus stop with geographic coordinates."""

    __tablename__ = "stops"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)

    boardings = relationship("Boarding", back_populates="stop")

    def __repr__(self) -> str:
        return f"<Stop id={self.id} name={self.name!r}>"


class Route(Base):
    """A named bus route."""

    __tablename__ = "routes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)

    route_stops = relationship(
        "RouteStop", back_populates="route", order_by="RouteStop.seq"
    )
    trips = relationship("Trip", back_populates="route")

    def __repr__(self) -> str:
        return f"<Route id={self.id} name={self.name!r}>"


class RouteStop(Base):
    """Association between a route and its ordered stops."""

    __tablename__ = "route_stops"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    stop_id = Column(Integer, ForeignKey("stops.id"), nullable=False)
    seq = Column(Integer, nullable=False)

    route = relationship("Route", back_populates="route_stops")
    stop = relationship("Stop")

    def __repr__(self) -> str:
        return f"<RouteStop route={self.route_id} stop={self.stop_id} seq={self.seq}>"


class Trip(Base):
    """A single scheduled trip on a route."""

    __tablename__ = "trips"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    start_time = Column(DateTime, nullable=False)

    route = relationship("Route", back_populates="trips")
    vehicle_positions = relationship("VehiclePosition", back_populates="trip")

    def __repr__(self) -> str:
        return f"<Trip id={self.id} route={self.route_id}>"


class VehiclePosition(Base):
    """Recorded (or simulated) GPS position of a vehicle on a trip."""

    __tablename__ = "vehicle_positions"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    ts = Column(DateTime, nullable=False, default=datetime.utcnow)

    trip = relationship("Trip", back_populates="vehicle_positions")

    def __repr__(self) -> str:
        return f"<VehiclePosition id={self.id} trip={self.trip_id}>"


class Boarding(Base):
    """Passenger boarding count at a stop at a point in time."""

    __tablename__ = "boardings"

    id = Column(Integer, primary_key=True, index=True)
    stop_id = Column(Integer, ForeignKey("stops.id"), nullable=False)
    ts = Column(DateTime, nullable=False)
    count = Column(Integer, nullable=False)

    stop = relationship("Stop", back_populates="boardings")

    def __repr__(self) -> str:
        return f"<Boarding stop={self.stop_id} count={self.count}>"

