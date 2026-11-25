# Local Public Transportation Information & Route-Assistance System (TransitAI)

KLS VDIT, CSE (AI&ML) community project — a full-stack transit assistant for **Hubli-Dharwad** featuring Google Maps Platform integration, live vehicle tracking, stop ETAs, route search (direct & 1-transfer), ML demand forecasting, OR-Tools fleet dispatch optimization, and an operator analytics dashboard.

## Architecture

```
Frontend (Next.js + Tailwind + Google Maps Platform / Leaflet fallback)
        │
        ▼
Backend (FastAPI + SQLAlchemy + SQLite/PostgreSQL)
  ├── /stops, /stops/nearby, /stops/{id}/eta
  ├── /routes, /routes/{id}, /routes/search
  ├── /vehicles
  ├── /forecast        (scikit-learn Random Forest)
  ├── /optimize        (Google OR-Tools mTSP + Nearest-Neighbor baseline)
  └── /admin/analytics (Demand heatmap, headway variance, bunching alerts)
```

## Google Maps Platform Integration

TransitAI includes official Google Maps Platform integration using `@googlemaps/js-api-loader` and custom dark styling matching the TransitAI design tokens.

### Required Google Cloud APIs
Enable the following 4 APIs in your [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/overview):
1. **Maps JavaScript API** — Interactive vector map, zoom controls, and custom markers.
2. **Places API** — Autocomplete location search for transit hubs, bus stands, and railway stations.
3. **Routes API (or Directions API)** — Routing, travel distances, durations, and alternative paths.
4. **Geocoding API** — Reverse & forward coordinate translation.

### API Key Security & Restrictions
- **Application Restriction**: Restrict key to **Websites (HTTP referrers)**:
  - `http://localhost:3000/*`
  - `https://your-production-domain.com/*`
- **API Restriction**: Restrict the key specifically to the 4 enabled APIs above.
- In `frontend/.env.local`:
  ```env
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
  VITE_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
  ```

*Note: If no API key is configured, TransitAI gracefully falls back to OpenStreetMap dark tiles with full interactive stop/vehicle functionality, ensuring zero downtime.*

## Quick Start

### 1. Backend Setup
```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Generate 60 days of synthetic Hubli-Dharwad transit data (15 stops, 3 routes):
```powershell
python ..\data\generate.py
```

Train the Random Forest demand forecast model:
```powershell
python ..\ml\train_forecast.py
```

Run the vehicle simulator (creates live/recent trips with configurable bunching):
```powershell
python -m simulator --batch --bunching
```

Start the FastAPI server:
```powershell
uvicorn app.main:app --reload --port 8000
```

Run backend tests:
```powershell
python -m pytest tests\ -v
```

### 2. Frontend Setup
```powershell
cd frontend
cp .env.example .env.local
# Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local
npm install
npm run dev
```

Open:
- Passenger Home & Search: `http://localhost:3000/`
- Google Maps Transit Explorer: `http://localhost:3000/map`
- Route Results & Map: `http://localhost:3000/routes`
- Live Fleet Radar: `http://localhost:3000/live`
- Operator Admin Dashboard: `http://localhost:3000/admin`

Run frontend build & tests:
```powershell
npm run build
npm test
```

## ML Forecast Evaluation (`ml/results.md`)

- **Model**: `RandomForestRegressor(n_estimators=120, max_depth=12, min_samples_leaf=3, random_state=42)`
- **Baseline**: Naive previous-week same-hour same-stop boarding count (`lag_7d`)
- **Chronological Split**: Train 8,880 rows / Val 1,920 rows / Test 1,920 rows
- **Test MAE**: `6.44` vs Baseline `7.54` (`+14.6%` improvement)
- **Test RMSE**: `9.96` vs Baseline `11.68` (`+14.7%` improvement)

## Future Scope (Out of MVP)
- Real Cloud-Fog-Edge deployment & V2I/V2V hardware
- Federated learning across transit depots
- Biometric / RFID fare collection & smart passes
- Native mobile apps
