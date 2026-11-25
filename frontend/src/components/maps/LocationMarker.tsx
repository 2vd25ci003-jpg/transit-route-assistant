"use client";

import { useEffect, useRef } from "react";
import type { LatLngPoint } from "@/services/locationService";

interface LocationMarkerProps {
  map: google.maps.Map | null;
  position: LatLngPoint | null;
  title?: string;
  type?: "origin" | "destination" | "user" | "search";
}

export function LocationMarker({
  map,
  position,
  title,
  type = "search",
}: LocationMarkerProps) {
  const markerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    if (!map || !position) {
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      return;
    }

    const icons: Record<string, google.maps.Icon | google.maps.Symbol> = {
      origin: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: "#4fdbc8",
        fillOpacity: 1,
        strokeColor: "#060e20",
        strokeWeight: 3,
      },
      destination: {
        path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
        scale: 6,
        fillColor: "#ffb95f",
        fillOpacity: 1,
        strokeColor: "#060e20",
        strokeWeight: 2,
      },
      user: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#7bd0ff",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2.5,
      },
      search: {
        path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
        scale: 6,
        fillColor: "#14b8a6",
        fillOpacity: 1,
        strokeColor: "#060e20",
        strokeWeight: 2,
      },
    };

    if (!markerRef.current) {
      markerRef.current = new google.maps.Marker({
        position: { lat: position.lat, lng: position.lng },
        map,
        title: title || type.toUpperCase(),
        icon: icons[type] || icons.search,
        animation: google.maps.Animation.DROP,
      });
    } else {
      markerRef.current.setPosition({ lat: position.lat, lng: position.lng });
      markerRef.current.setIcon(icons[type] || icons.search);
      markerRef.current.setTitle(title || type.toUpperCase());
    }

    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
    };
  }, [map, position?.lat, position?.lng, type, title]);

  return null;
}
