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

export interface DirectRouteResult {
  type: "direct";
  route: Route;
}

export interface TransferRouteResult {
  type: "transfer";
  first_route: Route;
  second_route: Route;
  transfer_stop: Stop;
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
