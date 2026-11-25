"use client";

import React, { useEffect, useRef, useState } from "react";
import { CONFIG, hasGoogleMapsKey } from "@/lib/config";
import {
  loadGoogleMaps,
  TRANSIT_AI_MAP_STYLE,
} from "@/services/googleMapsService";
import type { LatLngPoint } from "@/services/locationService";

interface GoogleMapProps {
  center?: LatLngPoint;
  zoom?: number;
  heightClass?: string;
  onMapClick?: (coords: LatLngPoint) => void;
  onMapLoaded?: (map: google.maps.Map) => void;
  children?: (map: google.maps.Map | null) => React.ReactNode;
  showMissingKeyHelp?: boolean;
}

export function GoogleMap({
  center = CONFIG.mapCenter,
  zoom = 13,
  heightClass = "h-[400px]",
  onMapClick,
  onMapLoaded,
  children,
  showMissingKeyHelp = true,
}: GoogleMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    if (!hasGoogleMapsKey()) {
      setHasKey(false);
      setLoading(false);
      return;
    }

    setHasKey(true);
    setLoading(true);
    setError(null);

    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !containerRef.current) return;

        const mapInstance = new google.maps.Map(containerRef.current, {
          center: { lat: center.lat, lng: center.lng },
          zoom,
          styles: TRANSIT_AI_MAP_STYLE,
          backgroundColor: "#060e20",
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: "greedy",
        });

        if (onMapClick) {
          mapInstance.addListener("click", (e: google.maps.MapMouseEvent) => {
            if (e.latLng) {
              onMapClick({
                lat: e.latLng.lat(),
                lng: e.latLng.lng(),
              });
            }
          });
        }

        setMap(mapInstance);
        setLoading(false);
        if (onMapLoaded) {
          onMapLoaded(mapInstance);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setLoading(false);
        setError(
          err instanceof Error
            ? err.message
            : "Google Maps Platform encountered an error loading."
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Update center when prop changes
  useEffect(() => {
    if (map && center) {
      map.panTo({ lat: center.lat, lng: center.lng });
    }
  }, [map, center.lat, center.lng]);

  // Missing API Key Notification Card
  if (!hasKey) {
    if (!showMissingKeyHelp) {
      return (
        <div
          className={`w-full ${heightClass} rounded-2xl bg-surface-container-low flex flex-col items-center justify-center p-6 text-center`}
        >
          <span className="material-symbols-outlined text-tertiary text-4xl mb-2">
            key_off
          </span>
          <p className="text-sm font-semibold text-on-surface">
            Google Maps API Key Not Detected
          </p>
          <p className="text-xs text-on-surface-variant max-w-sm mt-1">
            Configure <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in your{" "}
            <code>.env.local</code> to activate Google Maps.
          </p>
        </div>
      );
    }

    return (
      <div
        className={`w-full ${heightClass} rounded-2xl bg-surface-container-low border border-tertiary/20 flex flex-col justify-between p-6 overflow-y-auto`}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-tertiary/20 text-tertiary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">
              map
            </span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-on-surface">
                Google Maps Platform Integration
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-tertiary/20 text-tertiary text-[11px] font-bold">
                API Setup Required
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
              Google Maps Platform requires an API Key with the following 4 APIs
              enabled in your Google Cloud Console:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-4">
          <div className="bg-surface-container p-3 rounded-xl border border-outline-variant/30">
            <div className="text-primary font-semibold text-xs flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[16px]">
                layers
              </span>
              Maps JS API
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Vector dark map, interactive controls, markers
            </p>
          </div>

          <div className="bg-surface-container p-3 rounded-xl border border-outline-variant/30">
            <div className="text-secondary font-semibold text-xs flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[16px]">
                search
              </span>
              Places API
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Transit station autocomplete & place searches
            </p>
          </div>

          <div className="bg-surface-container p-3 rounded-xl border border-outline-variant/30">
            <div className="text-tertiary font-semibold text-xs flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[16px]">
                alt_route
              </span>
              Routes API
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Directions, distances, travel time & alternatives
            </p>
          </div>

          <div className="bg-surface-container p-3 rounded-xl border border-outline-variant/30">
            <div className="text-primary font-semibold text-xs flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[16px]">
                pin_drop
              </span>
              Geocoding API
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Reverse & forward coordinates translation
            </p>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-3.5 border border-outline-variant/20 flex flex-col gap-1.5 text-xs font-mono">
          <span className="text-[11px] text-outline uppercase font-sans font-semibold">
            Add to <code>frontend/.env.local</code>:
          </span>
          <code className="text-primary">
            NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...
          </code>
          <code className="text-on-surface-variant text-[11px]">
            VITE_GOOGLE_MAPS_API_KEY=AIzaSy...
          </code>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full ${heightClass} rounded-2xl overflow-hidden shadow-lg border border-outline-variant/20`}>
      {loading && (
        <div className="absolute inset-0 bg-surface-container-lowest flex flex-col items-center justify-center gap-2 z-20">
          <span className="material-symbols-outlined text-primary text-3xl animate-spin">
            progress_activity
          </span>
          <span className="text-xs text-on-surface-variant">
            Loading Google Maps Platform...
          </span>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 bg-surface-container-lowest/95 flex flex-col items-center justify-center p-6 text-center z-20">
          <span className="material-symbols-outlined text-error text-3xl mb-1">
            error
          </span>
          <p className="text-sm font-semibold text-on-surface">
            Google Maps Load Error
          </p>
          <p className="text-xs text-on-surface-variant max-w-sm mt-1">
            {error}
          </p>
          <p className="text-[11px] text-outline mt-2">
            Verify that your API key is valid and has Maps JavaScript API enabled.
          </p>
        </div>
      )}

      <div ref={containerRef} className="w-full h-full" />

      {/* Child components with access to map instance */}
      {map && children && children(map)}
    </div>
  );
}
