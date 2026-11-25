/**
 * Location, Geocoding, and Places Service
 * Provides user device geolocation, reverse/forward geocoding, and transit place searches.
 */

import { loadGoogleMaps } from "./googleMapsService";

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  formattedAddress: string;
  location: LatLngPoint;
  placeId?: string;
}

export interface TransitPlaceItem {
  placeId: string;
  name: string;
  address: string;
  location: LatLngPoint;
  types: string[];
  rating?: number;
  transitType: "bus" | "train" | "transit_station" | "general";
}

/**
 * Gets user's current device coordinates using the Geolocation API.
 */
export function getCurrentUserCoordinates(): Promise<LatLngPoint> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        let msg = "Failed to retrieve location.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg = "Location permission was denied.";
            break;
          case error.POSITION_UNAVAILABLE:
            msg = "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            msg = "The request to get user location timed out.";
            break;
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  });
}

/**
 * Reverse geocodes coordinates into a human-readable street address using Google Geocoding API.
 */
export async function reverseGeocode(
  coords: LatLngPoint
): Promise<GeocodeResult> {
  const google = await loadGoogleMaps();
  const geocoder = new google.maps.Geocoder();

  return new Promise((resolve, reject) => {
    geocoder.geocode({ location: coords }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
        const item = results[0];
        resolve({
          formattedAddress: item.formatted_address,
          location: {
            lat: item.geometry.location.lat(),
            lng: item.geometry.location.lng(),
          },
          placeId: item.place_id,
        });
      } else {
        reject(new Error(`Geocoding failed with status: ${status}`));
      }
    });
  });
}

/**
 * Forward geocodes an address string into coordinates.
 */
export async function forwardGeocode(
  address: string
): Promise<GeocodeResult> {
  const google = await loadGoogleMaps();
  const geocoder = new google.maps.Geocoder();

  return new Promise((resolve, reject) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
        const item = results[0];
        resolve({
          formattedAddress: item.formatted_address,
          location: {
            lat: item.geometry.location.lat(),
            lng: item.geometry.location.lng(),
          },
          placeId: item.place_id,
        });
      } else {
        reject(new Error(`Forward geocoding failed with status: ${status}`));
      }
    });
  });
}

/**
 * Searches nearby transportation-related places (bus stations, railway stations, transit hubs)
 * using Google Places API.
 */
export async function searchNearbyTransitPlaces(
  map: google.maps.Map,
  center: LatLngPoint,
  radiusMeters = 8000,
  keyword?: string
): Promise<TransitPlaceItem[]> {
  const google = await loadGoogleMaps();
  const service = new google.maps.places.PlacesService(map);

  const request: google.maps.places.PlaceSearchRequest = {
    location: new google.maps.LatLng(center.lat, center.lng),
    radius: radiusMeters,
    type: "transit_station",
    keyword: keyword || "bus station OR railway station OR transit",
  };

  return new Promise((resolve) => {
    service.nearbySearch(request, (results, status) => {
      if (
        status === google.maps.places.PlacesServiceStatus.OK &&
        results &&
        results.length > 0
      ) {
        const items: TransitPlaceItem[] = results
          .filter((r) => r.geometry?.location)
          .map((r) => {
            const types = r.types || [];
            let transitType: TransitPlaceItem["transitType"] = "general";
            if (
              types.includes("bus_station") ||
              r.name?.toLowerCase().includes("bus")
            ) {
              transitType = "bus";
            } else if (
              types.includes("train_station") ||
              r.name?.toLowerCase().includes("railway") ||
              r.name?.toLowerCase().includes("station")
            ) {
              transitType = "train";
            } else if (types.includes("transit_station")) {
              transitType = "transit_station";
            }

            return {
              placeId: r.place_id || `${r.geometry!.location!.lat()}-${r.geometry!.location!.lng()}`,
              name: r.name || "Transportation Place",
              address: r.vicinity || "",
              location: {
                lat: r.geometry!.location!.lat(),
                lng: r.geometry!.location!.lng(),
              },
              types,
              rating: r.rating,
              transitType,
            };
          });
        resolve(items);
      } else {
        resolve([]);
      }
    });
  });
}
