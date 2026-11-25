export type CrowdingLevel = "Low" | "Medium" | "High";

/**
 * Derive deterministic simulated crowding level for a bus trip based on trip_id and route_id.
 */
export function getSimulatedCrowding(tripId: number, routeId: number): CrowdingLevel {
  const score = (tripId * 7 + routeId * 13) % 10;
  if (score >= 7) return "High";
  if (score >= 3) return "Medium";
  return "Low";
}

export function readIdList(key: string): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((n): n is number => typeof n === "number")
      : [];
  } catch {
    return [];
  }
}

export function toggleStoredId(key: string, id: number): number[] {
  const current = readIdList(key);
  const exists = current.includes(id);
  const next = exists ? current.filter((item) => item !== id) : [...current, id];
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, JSON.stringify(next));
  }
  return next;
}

export const SAVED_STOPS_KEY = "transit_saved_stops";
export const FAVORITE_ROUTES_KEY = "transit_favorite_routes";
