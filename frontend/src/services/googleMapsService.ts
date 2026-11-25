/**
 * Google Maps Platform Loader and Styling Service
 * Uses modern official @googlemaps/js-api-loader with importLibrary() and setOptions().
 */

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { CONFIG, hasGoogleMapsKey } from "@/lib/config";

let optionsConfigured = false;
let loadPromise: Promise<typeof google> | null = null;

/**
 * Loads the Google Maps JavaScript API script safely without duplicate injections.
 */
export async function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window !== "undefined" && window.google?.maps) {
    return window.google;
  }

  if (!hasGoogleMapsKey()) {
    throw new Error(
      "Missing Google Maps API Key. Please configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY or VITE_GOOGLE_MAPS_API_KEY in your environment."
    );
  }

  if (!optionsConfigured) {
    setOptions({
      key: CONFIG.googleMaps.apiKey,
      v: "weekly",
    });
    optionsConfigured = true;
  }

  if (!loadPromise) {
    loadPromise = (async () => {
      // Import core libraries required for transportation route assistance
      await Promise.all([
        importLibrary("maps"),
        importLibrary("places"),
        importLibrary("geometry"),
        importLibrary("routes"),
      ]);
      return window.google;
    })();
  }

  return loadPromise;
}

/**
 * Reset loader promise if needed (e.g. key changed dynamically).
 */
export function resetGoogleMapsLoader(): void {
  optionsConfigured = false;
  loadPromise = null;
}

/**
 * TransitAI Custom Dark Map Style matching project tokens:
 * surface #0b1326, surface-container #171f33, primary #4fdbc8, secondary #7bd0ff
 */
export const TRANSIT_AI_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#0b1326" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#060e20" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#dae2fd" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#4fdbc8" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#859490" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#131b2e" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#171f33" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#222a3d" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#bbcac6" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#222a3d" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#005048" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#7bd0ff" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#14b8a6" }, { weight: 1.5 }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#4fdbc8" }],
  },
  {
    featureType: "transit.line",
    elementType: "geometry",
    stylers: [{ color: "#00a6e0" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#060e20" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#7bd0ff" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#00354a" }],
  },
];
