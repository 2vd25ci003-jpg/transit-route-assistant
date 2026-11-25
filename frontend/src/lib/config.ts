export const CONFIG = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  cityName: process.env.NEXT_PUBLIC_CITY_NAME ?? "Hubli-Dharwad",
  mapCenter: {
    lat: Number(process.env.NEXT_PUBLIC_MAP_CENTER_LAT ?? "15.405"),
    lng: Number(process.env.NEXT_PUBLIC_MAP_CENTER_LNG ?? "75.065"),
  },
  mapStyleUrl:
    process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
    "https://tiles.openfreemap.org/styles/liberty",
} as const;
