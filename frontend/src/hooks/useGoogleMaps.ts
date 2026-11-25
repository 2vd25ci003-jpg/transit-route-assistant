/**
 * useGoogleMaps Hook
 * Manages Google Maps JavaScript API lifecycle, error states, and map instance attachment.
 */

import { useEffect, useRef, useState } from "react";
import { CONFIG, hasGoogleMapsKey } from "@/lib/config";
import {
  loadGoogleMaps,
  TRANSIT_AI_MAP_STYLE,
} from "@/services/googleMapsService";

export interface UseGoogleMapsOptions {
  center?: { lat: number; lng: number };
  zoom?: number;
  disableDefaultUI?: boolean;
  zoomControl?: boolean;
}

export function useGoogleMaps(options: UseGoogleMapsOptions = {}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!hasGoogleMapsKey()) {
      setIsLoading(false);
      setApiKeyMissing(true);
      return;
    }

    setApiKeyMissing(false);
    setIsLoading(true);

    loadGoogleMaps()
      .then((google) => {
        if (cancelled) return;
        setIsLoaded(true);
        setIsLoading(false);
        setLoadError(null);

        // If container element is ready and map not initialized yet, initialize it
        if (containerRef.current && !mapInstanceRef.current) {
          const mapCenter = options.center || CONFIG.mapCenter;
          const map = new google.maps.Map(containerRef.current, {
            center: mapCenter,
            zoom: options.zoom ?? 12,
            styles: TRANSIT_AI_MAP_STYLE,
            disableDefaultUI: options.disableDefaultUI ?? false,
            zoomControl: options.zoomControl ?? true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            backgroundColor: "#060e20",
          });
          mapInstanceRef.current = map;
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setIsLoading(false);
        setLoadError(
          err instanceof Error
            ? err.message
            : "Failed to load Google Maps Platform."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [options.center?.lat, options.center?.lng, options.zoom]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      mapInstanceRef.current = null;
    };
  }, []);

  return {
    isLoaded,
    isLoading,
    loadError,
    apiKeyMissing,
    map: mapInstanceRef.current,
    containerRef,
  };
}
