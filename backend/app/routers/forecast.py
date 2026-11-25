"""Forecast router – passenger boarding demand predictions."""

from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path

import joblib
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Boarding, Stop
from app.schemas import ForecastOut, ForecastPoint

router = APIRouter(tags=["forecast"])

_MODEL_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "ml"
    / "models"
    / "forecast_rf.joblib"
)
_cached_model = None


def _get_model():
    """Load the trained Random Forest model from disk (cached)."""
    global _cached_model
    if _cached_model is None and _MODEL_PATH.exists():
        _cached_model = joblib.load(_MODEL_PATH)
    return _cached_model


@router.get("/forecast", response_model=ForecastOut)
def get_forecast(
    stop_id: int = Query(..., description="Target stop ID"),
    horizon: int = Query(
        6, ge=1, le=24, description="Number of hours to forecast (1–24)"
    ),
    db: Session = Depends(get_db),
) -> ForecastOut:
    """Predict hourly passenger boardings for a stop over the next *horizon* hours."""
    stop = db.get(Stop, stop_id)
    if stop is None:
        raise HTTPException(status_code=404, detail="Stop not found")

    # Anchor at latest boarding timestamp (or 06:00 today if empty)
    latest_ts: datetime | None = (
        db.query(func.max(Boarding.ts))
        .filter(Boarding.stop_id == stop_id)
        .scalar()
    )
    if latest_ts is None:
        anchor = datetime.now().replace(minute=0, second=0, microsecond=0)
    else:
        # Forecast starting from the next operating hour after the latest day's start,
        # or simply the next *horizon* hours after latest_ts
        anchor = latest_ts

    # Fetch historical boardings for this stop for lag_7d & baseline lookups
    hist_rows = (
        db.query(Boarding.ts, Boarding.count)
        .filter(Boarding.stop_id == stop_id)
        .all()
    )
    lookup: dict[datetime, int] = {r.ts: r.count for r in hist_rows}
    hour_buckets: dict[int, list[int]] = {}
    for r in hist_rows:
        hour_buckets.setdefault(r.ts.hour, []).append(r.count)
    hour_means: dict[int, float] = {
        h: float(np.mean(vals)) for h, vals in hour_buckets.items()
    }
    overall_mean = (
        float(np.mean([r.count for r in hist_rows])) if hist_rows else 15.0
    )

    model = _get_model()
    model_type = "random_forest" if model is not None else "historical_mean_fallback"

    predictions: list[ForecastPoint] = []
    current_ts = anchor
    for _ in range(horizon):
        current_ts = current_ts + timedelta(hours=1)
        # Advance across overnight gap (22:00–05:59) to next operating hour 06:00
        if current_ts.hour >= 22:
            current_ts = (current_ts + timedelta(days=1)).replace(
                hour=6, minute=0, second=0, microsecond=0
            )
        elif current_ts.hour < 6:
            current_ts = current_ts.replace(
                hour=6, minute=0, second=0, microsecond=0
            )
        target_ts = current_ts

        lag_ts = target_ts - timedelta(days=7)
        baseline_val = float(
            lookup.get(lag_ts, hour_means.get(target_ts.hour, overall_mean))
        )

        if model is not None:
            features = np.array(
                [[
                    float(stop_id),
                    float(target_ts.hour),
                    float(target_ts.weekday()),
                    1.0 if target_ts.weekday() >= 5 else 0.0,
                    baseline_val,
                ]],
                dtype=float,
            )
            pred_val = max(0.0, float(model.predict(features)[0]))
        else:
            pred_val = baseline_val

        predictions.append(
            ForecastPoint(
                ts=target_ts,
                predicted_count=round(pred_val, 1),
                baseline_count=round(baseline_val, 1),
                actual_count=lookup.get(target_ts),
            )
        )

    return ForecastOut(
        stop_id=stop.id,
        stop_name=stop.name,
        horizon_hours=horizon,
        model_type=model_type,
        predictions=predictions,
    )
