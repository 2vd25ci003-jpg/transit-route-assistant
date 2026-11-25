/**
 * Route & Directions Planning Service
 * Calculates routes, alternative paths, travel durations, and transit steps using Google Routes/Directions API.
 */

import { loadGoogleMaps } from "./googleMapsService";
import type { LatLngPoint } from "./locationService";

export type TravelModeOption = "TRANSIT" | "DRIVING" | "WALKING" | "BICYCLING";

export interface RoutePlanStep {
  instructions: string;
  distanceText: string;
  durationText: string;
  travelMode: string;
  transitDetails?: {
    lineName?: string;
    vehicleType?: string;
    departureStop?: string;
    arrivalStop?: string;
    numStops?: number;
  };
}

export interface RouteOptionDetail {
  summary: string;
  distanceKm: number;
  distanceText: string;
  durationMinutes: number;
  durationText: string;
  departureTime?: string;
  arrivalTime?: string;
  steps: RoutePlanStep[];
  overviewPolyline: string;
  bounds?: google.maps.LatLngBounds;
  googleDirectionsRoute: google.maps.DirectionsRoute;
}

export interface RoutePlanResult {
  origin: LatLngPoint | string;
  destination: LatLngPoint | string;
  travelMode: TravelModeOption;
  routes: RouteOptionDetail[];
  selectedRouteIndex: number;
  rawResponse: google.maps.DirectionsResult;
}

export interface CalculateRouteParams {
  origin: LatLngPoint | string;
  destination: LatLngPoint | string;
  travelMode?: TravelModeOption;
  provideAlternatives?: boolean;
}

/**
 * Calculates a route between origin and destination with alternative options.
 * If TRANSIT is requested but not available in the region, automatically offers a driving/walking alternative.
 */
export async function calculateRoute(
  params: CalculateRouteParams
): Promise<RoutePlanResult> {
  const google = await loadGoogleMaps();
  const directionsService = new google.maps.DirectionsService();

  const mode = params.travelMode || "TRANSIT";
  const originLocation =
    typeof params.origin === "string"
      ? params.origin
      : new google.maps.LatLng(params.origin.lat, params.origin.lng);

  const destinationLocation =
    typeof params.destination === "string"
      ? params.destination
      : new google.maps.LatLng(params.destination.lat, params.destination.lng);

  const request: google.maps.DirectionsRequest = {
    origin: originLocation,
    destination: destinationLocation,
    travelMode: google.maps.TravelMode[mode],
    provideRouteAlternatives: params.provideAlternatives ?? true,
  };

  return new Promise((resolve, reject) => {
    directionsService.route(request, (result, status) => {
      if (status === google.maps.DirectionsStatus.OK && result && result.routes.length > 0) {
        resolve(parseDirectionsResult(params.origin, params.destination, mode, result));
      } else if (
        status === google.maps.DirectionsStatus.ZERO_RESULTS &&
        mode === "TRANSIT"
      ) {
        // Fallback to DRIVING if transit data is unavailable for this specific rural corridor
        const fallbackRequest: google.maps.DirectionsRequest = {
          ...request,
          travelMode: google.maps.TravelMode.DRIVING,
        };
        directionsService.route(fallbackRequest, (fallbackResult, fallbackStatus) => {
          if (
            fallbackStatus === google.maps.DirectionsStatus.OK &&
            fallbackResult &&
            fallbackResult.routes.length > 0
          ) {
            resolve(
              parseDirectionsResult(
                params.origin,
                params.destination,
                "DRIVING",
                fallbackResult
              )
            );
          } else {
            reject(
              new Error(
                "No routes found between the selected origin and destination."
              )
            );
          }
        });
      } else {
        let msg = "Failed to calculate route.";
        if (status === google.maps.DirectionsStatus.NOT_FOUND) {
          msg = "One of the locations could not be geocoded.";
        } else if (status === google.maps.DirectionsStatus.ZERO_RESULTS) {
          msg = "No route could be found between origin and destination.";
        } else if (status === google.maps.DirectionsStatus.OVER_QUERY_LIMIT) {
          msg = "Google Maps route query limit exceeded.";
        }
        reject(new Error(msg));
      }
    });
  });
}

function parseDirectionsResult(
  origin: LatLngPoint | string,
  destination: LatLngPoint | string,
  mode: TravelModeOption,
  result: google.maps.DirectionsResult
): RoutePlanResult {
  const routes: RouteOptionDetail[] = result.routes.map((r) => {
    const leg = r.legs[0];
    const distanceMeters = leg?.distance?.value || 0;
    const durationSeconds = leg?.duration?.value || 0;

    const steps: RoutePlanStep[] = (leg?.steps || []).map((step) => {
      const transit = step.transit;
      return {
        instructions: step.instructions ? stripHtmlTags(step.instructions) : "",
        distanceText: step.distance?.text || "",
        durationText: step.duration?.text || "",
        travelMode: step.travel_mode,
        transitDetails: transit
          ? {
              lineName: transit.line?.short_name || transit.line?.name,
              vehicleType: transit.line?.vehicle?.name,
              departureStop: transit.departure_stop?.name,
              arrivalStop: transit.arrival_stop?.name,
              numStops: transit.num_stops,
            }
          : undefined,
      };
    });

    return {
      summary: r.summary || (leg?.steps?.[0]?.instructions ? stripHtmlTags(leg.steps[0].instructions) : "Route option"),
      distanceKm: Math.round((distanceMeters / 1000) * 10) / 10,
      distanceText: leg?.distance?.text || `${Math.round(distanceMeters / 1000)} km`,
      durationMinutes: Math.round(durationSeconds / 60),
      durationText: leg?.duration?.text || `${Math.round(durationSeconds / 60)} min`,
      departureTime: leg?.departure_time?.text,
      arrivalTime: leg?.arrival_time?.text,
      steps,
      overviewPolyline: r.overview_polyline,
      bounds: r.bounds,
      googleDirectionsRoute: r,
    };
  });

  return {
    origin,
    destination,
    travelMode: mode,
    routes,
    selectedRouteIndex: 0,
    rawResponse: result,
  };
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>?/gm, "").trim();
}
