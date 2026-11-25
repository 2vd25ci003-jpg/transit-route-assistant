export const CONFIG = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  cityName: process.env.NEXT_PUBLIC_CITY_NAME ?? "Hubli-Dharwad",
  mapCenter: {
    lat: Number(process.env.NEXT_PUBLIC_MAP_CENTER_LAT ?? "15.405"),
    lng: Number(process.env.NEXT_PUBLIC_MAP_CENTER_LNG ?? "75.065"),
  },
  googleMaps: {
    apiKey:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      "",
    libraries: ["places", "geometry", "routes"] as const,
  },
} as const;

export function hasGoogleMapsKey(): boolean {
  const key = CONFIG.googleMaps.apiKey;
  return Boolean(
    key &&
      key.trim().length > 0 &&
      key !== "YOUR_API_KEY" &&
      key !== "YOUR_GOOGLE_MAPS_API_KEY"
  );
}
