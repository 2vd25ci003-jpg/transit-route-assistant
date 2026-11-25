"""Train and evaluate the passenger demand forecasting model.

Uses a Random Forest regressor on historical boarding counts from transit.db,
with a strict time-based train / validation / test split (70% / 15% / 15%)
and compares MAE and RMSE against a naive previous-week baseline.

Usage (from project root or ml/):
    backend/venv/Scripts/python.exe ml/train_forecast.py
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, root_mean_squared_error

# Allow importing backend/app models
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
MODELS_DIR = SCRIPT_DIR / "models"
RESULTS_PATH = SCRIPT_DIR / "results.md"

sys.path.insert(0, str(BACKEND_DIR))
os.chdir(BACKEND_DIR)

from app.database import SessionLocal  # noqa: E402
from app.models import Boarding, Stop  # noqa: E402

RANDOM_SEED = 42
FEATURE_COLS = ["stop_id", "hour", "day_of_week", "is_weekend", "lag_7d"]


def load_boardings() -> list[tuple[int, datetime, int]]:
    """Fetch all (stop_id, ts, count) rows ordered by timestamp."""
    db = SessionLocal()
    try:
        rows = (
            db.query(Boarding.stop_id, Boarding.ts, Boarding.count)
            .order_by(Boarding.ts, Boarding.stop_id)
            .all()
        )
        return [(r.stop_id, r.ts, r.count) for r in rows]
    finally:
        db.close()


def build_dataset(
    rows: list[tuple[int, datetime, int]],
) -> tuple[np.ndarray, np.ndarray, np.ndarray, list[datetime]]:
    """Build feature matrix X, target y, naive baseline predictions, and timestamps."""
    lookup: dict[tuple[int, datetime], int] = {
        (stop_id, ts): count for stop_id, ts, count in rows
    }

    # Global fallback per (stop_id, hour) for the first 7 days without a 7-day lag
    stop_hour_totals: dict[tuple[int, int], list[int]] = {}
    for stop_id, ts, count in rows:
        stop_hour_totals.setdefault((stop_id, ts.hour), []).append(count)
    stop_hour_mean = {
        k: float(np.mean(v)) for k, v in stop_hour_totals.items()
    }

    X_list: list[list[float]] = []
    y_list: list[float] = []
    baseline_list: list[float] = []
    ts_list: list[datetime] = []

    for stop_id, ts, count in rows:
        prev_week_ts = ts - timedelta(days=7)
        lag_7d = lookup.get((stop_id, prev_week_ts))
        if lag_7d is None:
            # Skip rows without a 7-day history so baseline comparison is fair
            continue

        X_list.append([
            float(stop_id),
            float(ts.hour),
            float(ts.weekday()),
            1.0 if ts.weekday() >= 5 else 0.0,
            float(lag_7d),
        ])
        y_list.append(float(count))
        baseline_list.append(float(lag_7d))
        ts_list.append(ts)

    return (
        np.array(X_list, dtype=float),
        np.array(y_list, dtype=float),
        np.array(baseline_list, dtype=float),
        ts_list,
    )


def time_split(
    X: np.ndarray,
    y: np.ndarray,
    baseline: np.ndarray,
    timestamps: list[datetime],
) -> dict[str, tuple[np.ndarray, np.ndarray, np.ndarray]]:
    """Split chronologically into train (70%), val (15%), test (15%)."""
    unique_days = sorted({ts.date() for ts in timestamps})
    n_days = len(unique_days)
    train_end_idx = int(n_days * 0.70)
    val_end_idx = int(n_days * 0.85)

    train_cutoff = unique_days[train_end_idx]
    val_cutoff = unique_days[val_end_idx]

    dates = np.array([ts.date() for ts in timestamps])
    train_mask = dates < train_cutoff
    val_mask = (dates >= train_cutoff) & (dates < val_cutoff)
    test_mask = dates >= val_cutoff

    return {
        "train": (X[train_mask], y[train_mask], baseline[train_mask]),
        "val": (X[val_mask], y[val_mask], baseline[val_mask]),
        "test": (X[test_mask], y[test_mask], baseline[test_mask]),
    }


def evaluate(y_true: np.ndarray, y_pred: np.ndarray) -> tuple[float, float]:
    """Return (MAE, RMSE)."""
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(root_mean_squared_error(y_true, y_pred))
    return mae, rmse


def train_and_evaluate() -> dict:
    """Run full training, evaluation, model persistence, and report generation."""
    rows = load_boardings()
    if not rows:
        raise RuntimeError("No rows found in boardings table.")

    X, y, baseline, timestamps = build_dataset(rows)
    splits = time_split(X, y, baseline, timestamps)

    X_train, y_train, _ = splits["train"]
    X_val, y_val, base_val = splits["val"]
    X_test, y_test, base_test = splits["test"]

    model = RandomForestRegressor(
        n_estimators=120,
        max_depth=12,
        min_samples_leaf=3,
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    val_pred = model.predict(X_val)
    test_pred = model.predict(X_test)

    val_mae, val_rmse = evaluate(y_val, val_pred)
    base_val_mae, base_val_rmse = evaluate(y_val, base_val)

    test_mae, test_rmse = evaluate(y_test, test_pred)
    base_test_mae, base_test_rmse = evaluate(y_test, base_test)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODELS_DIR / "forecast_rf.joblib"
    joblib.dump(model, model_path)

    mae_improvement = ((base_test_mae - test_mae) / base_test_mae) * 100.0
    rmse_improvement = ((base_test_rmse - test_rmse) / base_test_rmse) * 100.0

    report = f"""# ML Forecast Evaluation Results

- **Model**: `RandomForestRegressor(n_estimators=120, max_depth=12, min_samples_leaf=3, random_state={RANDOM_SEED})`
- **Features**: `{", ".join(FEATURE_COLS)}`
- **Baseline**: Naive previous-week same-hour same-stop boarding count (`lag_7d`)
- **Split**: Time-based chronological split — Train: {len(X_train)} rows, Val: {len(X_val)} rows, Test: {len(X_test)} rows
- **Saved Model**: `ml/models/forecast_rf.joblib`

## Validation Metrics
| Model | MAE | RMSE |
| :--- | ---: | ---: |
| Naive Baseline (Prev Week) | {base_val_mae:.2f} | {base_val_rmse:.2f} |
| Random Forest | {val_mae:.2f} | {val_rmse:.2f} |

## Test Metrics
| Model | MAE | RMSE |
| :--- | ---: | ---: |
| Naive Baseline (Prev Week) | {base_test_mae:.2f} | {base_test_rmse:.2f} |
| Random Forest | {test_mae:.2f} | {test_rmse:.2f} |

- **Test MAE improvement over baseline**: {mae_improvement:+.1f}%
- **Test RMSE improvement over baseline**: {rmse_improvement:+.1f}%
"""
    RESULTS_PATH.write_text(report, encoding="utf-8")
    print(report)

    return {
        "train_rows": len(X_train),
        "val_rows": len(X_val),
        "test_rows": len(X_test),
        "val_mae": val_mae,
        "val_rmse": val_rmse,
        "base_val_mae": base_val_mae,
        "base_val_rmse": base_val_rmse,
        "test_mae": test_mae,
        "test_rmse": test_rmse,
        "base_test_mae": base_test_mae,
        "base_test_rmse": base_test_rmse,
        "model_path": str(model_path),
    }


if __name__ == "__main__":
    train_and_evaluate()
