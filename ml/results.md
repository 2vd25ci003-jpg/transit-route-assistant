# TransitAI Benchmark Results

> **Note**: All metrics below are measured from real runs on **synthetic Hubli-Dharwad data** (`data/generate.py`) and **simulated** bus operations. Generated: `2026-11-25 11:41 UTC`.

## 1. Demand Forecast (Random Forest vs Previous-Week Baseline)
| Model | Test MAE | Test RMSE |
| :--- | ---: | ---: |
| Naive Baseline (Prev Week) | 7.54 | 11.68 |
| Random Forest | 6.44 | 9.96 |

- **MAE improvement**: `+14.6%`
- **RMSE improvement**: `+14.7%`

## 2. Fleet Dispatch Optimizer (OR-Tools vs Nearest-Neighbor Baseline)
| Instance | Nearest-Neighbor Baseline | OR-Tools Distance | Savings |
| :--- | ---: | ---: | ---: |
| 2 buses (15 stops) | 73.708 km | 69.824 km | +5.27% |
| 3 buses (15 stops) | 105.007 km | 69.824 km | +33.51% |
| 4 buses (15 stops) | 137.219 km | 69.824 km | +49.11% |

## 3. Bus Bunching & Holding Strategy (Simulated, 5 Seeds: [42, 43, 44, 45, 46])
| Mode | Headway Mean (min) | Headway StdDev (min) | Bunching Events (<4m) |
| :--- | ---: | ---: | ---: |
| Without Holding (Simulated) | 6.7 | 5.86 | 35 |
| With Holding (Simulated) | 6.38 | 4.8 | 31 |

- **Headway StdDev reduction**: `18.1%`

## 4. `/routes/search` Latency (60 stop-pair queries)
- **p50 latency**: `2.46 ms`
- **p95 latency**: `2.86 ms` (Target: `< 1000 ms` — **PASS**)
- **Max latency**: `4.72 ms`
