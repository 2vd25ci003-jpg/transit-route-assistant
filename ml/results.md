# ML Forecast Evaluation Results

- **Model**: `RandomForestRegressor(n_estimators=120, max_depth=12, min_samples_leaf=3, random_state=42)`
- **Features**: `stop_id, hour, day_of_week, is_weekend, lag_7d`
- **Baseline**: Naive previous-week same-hour same-stop boarding count (`lag_7d`)
- **Split**: Time-based chronological split — Train: 8880 rows, Val: 1920 rows, Test: 1920 rows
- **Saved Model**: `ml/models/forecast_rf.joblib`

## Validation Metrics
| Model | MAE | RMSE |
| :--- | ---: | ---: |
| Naive Baseline (Prev Week) | 7.16 | 12.30 |
| Random Forest | 5.87 | 9.55 |

## Test Metrics
| Model | MAE | RMSE |
| :--- | ---: | ---: |
| Naive Baseline (Prev Week) | 7.54 | 11.68 |
| Random Forest | 6.44 | 9.96 |

- **Test MAE improvement over baseline**: +14.6%
- **Test RMSE improvement over baseline**: +14.7%
