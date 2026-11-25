"use client";

import { useUserLocation } from "@/hooks/useUserLocation";
import type { LatLngPoint } from "@/services/locationService";

interface CurrentLocationProps {
  onLocationFound: (coords: LatLngPoint) => void;
  className?: string;
}

export function CurrentLocation({
  onLocationFound,
  className = "",
}: CurrentLocationProps) {
  const { location, loading, error, requestLocation } = useUserLocation();

  async function handleClick() {
    const coords = await requestLocation();
    if (coords) {
      onLocationFound(coords);
    }
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-bright text-xs font-semibold text-on-surface shadow-sm active:scale-95 transition-all disabled:opacity-60"
      >
        <span className="relative flex h-2 w-2">
          {location && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          )}
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
        <span className="material-symbols-outlined text-primary text-[16px]">
          {loading ? "progress_activity" : "near_me"}
        </span>
        <span>{loading ? "Locating..." : "Use My Location"}</span>
      </button>

      {error && (
        <div className="absolute top-full left-0 mt-1.5 px-2.5 py-1 rounded bg-error-container text-on-error-container text-[11px] whitespace-nowrap shadow-md z-30">
          {error}
        </div>
      )}
    </div>
  );
}
