import { CONFIG } from "./config";
import type {
  AdminAnalytics,
  BenchmarkResults,
  EtaItem,
  ForecastResponse,
  NearbyStop,
  OptimizeResponse,
  Route,
  RouteDetail,
  RouteSearchResult,
  Stop,
  Vehicle,
} from "./types";

export function getStoredAdminKey(): string {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem("transit_admin_key") ?? "";
}

export function setStoredAdminKey(key: string): void {
  if (typeof window === "undefined") return;
  if (key) {
    window.sessionStorage.setItem("transit_admin_key", key);
  } else {
    window.sessionStorage.removeItem("transit_admin_key");
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CONFIG.apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const errBody = (await res.json()) as { error?: string };
      if (errBody.error) message = errBody.error;
    } catch {
      // ignore non-JSON error
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export const api = {
  getStops: (): Promise<Stop[]> => apiFetch<Stop[]>("/stops"),

  getNearbyStops: (
    lat: number,
    lng: number,
    radiusM = 5000
  ): Promise<NearbyStop[]> =>
    apiFetch<NearbyStop[]>(
      `/stops/nearby?lat=${lat}&lng=${lng}&radius_m=${radiusM}`
    ),

  getStopEta: (stopId: number): Promise<EtaItem[]> =>
    apiFetch<EtaItem[]>(`/stops/${stopId}/eta`),

  getRoutes: (): Promise<Route[]> => apiFetch<Route[]>("/routes"),

  getRouteDetail: (routeId: number): Promise<RouteDetail> =>
    apiFetch<RouteDetail>(`/routes/${routeId}`),

  searchRoutes: (fromId: number, toId: number): Promise<RouteSearchResult[]> =>
    apiFetch<RouteSearchResult[]>(`/routes/search?from=${fromId}&to=${toId}`),

  getVehicles: (): Promise<Vehicle[]> => apiFetch<Vehicle[]>("/vehicles"),

  getForecast: (stopId: number, horizon = 6): Promise<ForecastResponse> =>
    apiFetch<ForecastResponse>(`/forecast?stop_id=${stopId}&horizon=${horizon}`),

  optimizeDispatch: (
    stopIds: number[],
    fleetSize: number,
    depotStopId?: number
  ): Promise<OptimizeResponse> =>
    apiFetch<OptimizeResponse>("/optimize", {
      method: "POST",
      body: JSON.stringify({
        stop_ids: stopIds,
        fleet_size: fleetSize,
        depot_stop_id: depotStopId ?? null,
      }),
    }),

  getAdminAnalytics: (adminKey?: string): Promise<AdminAnalytics> =>
    apiFetch<AdminAnalytics>("/admin/analytics", {
      headers: { "X-Admin-Key": adminKey ?? getStoredAdminKey() },
    }),

  getBenchmarkResults: (adminKey?: string): Promise<BenchmarkResults> =>
    apiFetch<BenchmarkResults>("/admin/results", {
      headers: { "X-Admin-Key": adminKey ?? getStoredAdminKey() },
    }),
};
