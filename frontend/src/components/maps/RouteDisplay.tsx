"use client";

import { useEffect, useRef } from "react";
import type { RoutePlanResult } from "@/services/routeService";

interface RouteDisplayProps {
  map: google.maps.Map | null;
  routeResult: RoutePlanResult | null;
  selectedRouteIndex?: number;
}

export function RouteDisplay({
  map,
  routeResult,
  selectedRouteIndex = 0,
}: RouteDisplayProps) {
  const directionsRendererRef =
    useRef<google.maps.DirectionsRenderer | null>(null);

  useEffect(() => {
    if (!map) return;

    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: "#4fdbc8",
          strokeWeight: 5.5,
          strokeOpacity: 0.9,
        },
      });
    }

    const renderer = directionsRendererRef.current;

    if (routeResult?.rawResponse) {
      renderer.setMap(map);
      renderer.setDirections(routeResult.rawResponse);
      renderer.setRouteIndex(selectedRouteIndex);
    } else {
      renderer.setMap(null);
    }

    return () => {
      renderer.setMap(null);
    };
  }, [map, routeResult, selectedRouteIndex]);

  return null;
}
