# Synthetic Transit Data Generator

Generates realistic synthetic transit data for the Hubli-Dharwad twin-city area
and loads it into the project's database using the SQLAlchemy models in
`backend/app/models.py`.

## Quick Start

```bash
# From the project root
python data/generate.py                              # defaults
python data/generate.py --days 30 --noise 0.3        # fewer days, more noise
python data/generate.py --days 60 --events 5         # more special-event spikes
```

> **Prerequisite:** `pip install -r backend/requirements.txt` (needs `numpy`,
> `sqlalchemy`, `python-dotenv`).

The script **clears all existing rows** before inserting new data. The SQLite
database is created at `backend/transit.db` by default; set `DATABASE_URL` in
`backend/.env` to use a different backend (e.g. PostgreSQL).

## CLI Arguments

| Argument     | Type  | Default | Description |
|------------- |-------|---------|-------------|
| `--days`     | int   | 60      | Number of calendar days to generate, starting 2026-10-01 |
| `--noise`    | float | 0.15    | Gaussian noise σ as a fraction of the base boarding count |
| `--events`   | int   | 3       | Number of special-event demand spikes injected on random days/stops |

## Generated Tables & Columns

### `stops` — 15 rows

| Column | Type    | Description |
|--------|---------|-------------|
| `id`   | Integer | Auto-increment primary key |
| `name` | String  | Real Dharwad / Hubli-Dharwad stop name |
| `lat`  | Float   | Latitude (approximate, WGS-84) |
| `lng`  | Float   | Longitude (approximate, WGS-84) |

### `routes` — 3 rows

| Column | Type    | Description |
|--------|---------|-------------|
| `id`   | Integer | Auto-increment primary key |
| `name` | String  | Human-readable route name (e.g. "Route 1 – Dharwad-Hubli Trunk") |

### `route_stops` — 19 rows (8 + 6 + 5)

| Column     | Type    | Description |
|------------|---------|-------------|
| `id`       | Integer | Auto-increment primary key |
| `route_id` | Integer | FK → `routes.id` |
| `stop_id`  | Integer | FK → `stops.id` |
| `seq`      | Integer | 1-based position of this stop within the route |

### `trips` — `days × 3 routes × 96 departures/day`

Default (60 days): **17,280 rows**

| Column       | Type     | Description |
|--------------|----------|-------------|
| `id`         | Integer  | Auto-increment primary key |
| `route_id`   | Integer  | FK → `routes.id` |
| `start_time` | DateTime | Scheduled departure time (one every 10 min, 06:00–21:50) |

### `vehicle_positions` — one per stop per trip

Default (60 days): **109,440 rows** (trips × stops-on-route)

| Column    | Type     | Description |
|-----------|----------|-------------|
| `id`      | Integer  | Auto-increment primary key |
| `trip_id` | Integer  | FK → `trips.id` |
| `lat`     | Float    | GPS latitude at this point (stop coords ± jitter) |
| `lng`     | Float    | GPS longitude at this point (stop coords ± jitter) |
| `ts`      | DateTime | Actual timestamp (scheduled + any accumulated delay) |

~20 % of trips are "delayed": at random intermediate stops, 1–5 minutes of
extra dwell time accumulates, so that two buses may arrive at a downstream
stop within one minute of each other — realistic bus **bunching**.

### `boardings` — `days × 16 hours × 15 stops`

Default (60 days): **14,400 rows**

| Column    | Type     | Description |
|-----------|----------|-------------|
| `id`      | Integer  | Auto-increment primary key |
| `stop_id` | Integer  | FK → `stops.id` |
| `ts`      | DateTime | Hour-bucket timestamp (06:00–21:00 each day) |
| `count`   | Integer  | Passengers who boarded at this stop during this hour |

Demand shape:
- **Twin peaks** at 08:00–10:00 and 17:00–19:00.
- **Weekends** (Saturday & Sunday) are 50 % of weekday demand.
- **Per-stop popularity factor**: bus stands ×2.0, major junctions ×1.0–1.2,
  suburban stops ×0.6–0.8.
- **Gaussian noise** with σ = `--noise × base_count`.
- **Special events**: `--events` random (day, stop) combinations get a ×3–5
  multiplier for 3–4 consecutive hours (simulates festivals, college events,
  or rallies).

## Reproducibility

Both `random` and `numpy.random` are seeded with `42`. The same CLI arguments
always produce the same dataset.

