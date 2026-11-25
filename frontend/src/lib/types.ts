export interface Stop {
  id: number;
  name: string;
  lat: number;
  lng: number;
}

export interface NearbyStop extends Stop {
  distance_m: number;
}

export interface Route {
  id: number;
  name: string;
}

export interface RouteStop {
  seq: number;
  stop: Stop;
}

export interface RouteDetail extends Route {
  stops: RouteStop[];
}

export interface RouteLeg {
  route: Route;
  stops: Stop[];
  estimated_minutes: number;
}

export interface DirectRouteResult {
  type: "direct";
  num_transfers: number;
  estimated_minutes: number;
  route: Route;
  legs: RouteLeg[];
  transfer_stops: Stop[];
}

export interface TransferRouteResult {
  type: "transfer";
  num_transfers: number;
  estimated_minutes: number;
  first_route?: Route | null;
  second_route?: Route | null;
  transfer_stop?: Stop | null;
  legs: RouteLeg[];
  transfer_stops: Stop[];
}

export type RouteSearchResult = DirectRouteResult | TransferRouteResult;

export interface EtaItem {
  route_id: number;
  route_name: string;
  trip_id: number;
  eta_minutes: number;
}

export interface Vehicle {
  trip_id: number;
  route_id: number;
  route_name: string;
  lat: number;
  lng: number;
  ts: string;
}

export interface ForecastPoint {
  ts: string;
  predicted_count: number;
  baseline_count: number;
  actual_count: number | null;
}

export interface ForecastResponse {
  stop_id: number;
  stop_name: string;
  horizon_hours: number;
  model_type: string;
  predictions: ForecastPoint[];
}

export interface OptimizedRoute {
  vehicle_id: number;
  stop_ids: number[];
  stop_names: string[];
  distance_km: number;
}

export interface OptimizeResponse {
  fleet_size: number;
  routes: OptimizedRoute[];
  total_distance_km: number;
  baseline_distance_km: number;
  savings_pct: number;
  solver: string;
}

export interface StopDemand {
  stop_id: number;
  stop_name: string;
  lat: number;
  lng: number;
  avg_hourly_boardings: number;
  peak_hour: number;
  total_boardings: number;
}

export interface RouteHeadway {
  route_id: number;
  route_name: string;
  target_headway_min: number;
  avg_headway_min: number;
  headway_std_min: number;
  bunching_events: number;
  status: string;
}

export interface HourlyDemandPoint {
  hour: number;
  label: string;
  actual_avg: number;
  forecast_avg: number;
}

export interface AdminAnalytics {
  active_vehicles: number;
  total_stops: number;
  total_routes: number;
  avg_headway_min: number;
  bunching_alerts: number;
  stop_demands: StopDemand[];
  route_headways: RouteHeadway[];
  hourly_demand_series: HourlyDemandPoint[];
}

export interface BenchmarkResults {
  generated_at: string;
  synthetic_data_note: string;
  forecast: {
    baseline_mae: number;
    baseline_rmse: number;
    rf_mae: number;
    rf_rmse: number;
    mae_improvement_pct: number;
    rmse_improvement_pct: number;
  };
  optimizer: Array<{
    fleet_size: number;
    num_stops: number;
    ortools_km: number;
    baseline_km: number;
    savings_pct: number;
  }>;
  bunching: {
    simulated: boolean;
    seeds: number[];
    without_holding: {
      headway_mean_min: number;
      headway_std_min: number;
      bunching_count: number;
      sample_series: number[];
    };
    with_holding: {
      headway_mean_min: number;
      headway_std_min: number;
      bunching_count: number;
      sample_series: number[];
    };
    std_reduction_pct: number;
  };
  route_search_latency: {
    samples: number;
    p50_ms: number;
    p95_ms: number;
    max_ms: number;
    under_1s: boolean;
  };
}
