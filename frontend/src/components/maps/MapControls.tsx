"use client";

import { useEffect, useState } from "react";

interface MapControlsProps {
  map: google.maps.Map | null;
  onRecenter?: () => void;
}

export function MapControls({ map, onRecenter }: MapControlsProps) {
  const [transitLayer, setTransitLayer] =
    useState<google.maps.TransitLayer | null>(null);
  const [transitEnabled, setTransitEnabled] = useState(true);
  const [trafficLayer, setTrafficLayer] =
    useState<google.maps.TrafficLayer | null>(null);
  const [trafficEnabled, setTrafficEnabled] = useState(false);
  const [mapTypeId, setMapTypeId] = useState<"roadmap" | "hybrid">("roadmap");

  useEffect(() => {
    if (!map) return;
    const tLayer = new google.maps.TransitLayer();
    tLayer.setMap(map);
    setTransitLayer(tLayer);

    const trafLayer = new google.maps.TrafficLayer();
    setTrafficLayer(trafLayer);

    return () => {
      tLayer.setMap(null);
      trafLayer.setMap(null);
    };
  }, [map]);

  function toggleTransit() {
    if (!transitLayer || !map) return;
    if (transitEnabled) {
      transitLayer.setMap(null);
      setTransitEnabled(false);
    } else {
      transitLayer.setMap(map);
      setTransitEnabled(true);
    }
  }

  function toggleTraffic() {
    if (!trafficLayer || !map) return;
    if (trafficEnabled) {
      trafficLayer.setMap(null);
      setTrafficEnabled(false);
    } else {
      trafficLayer.setMap(map);
      setTrafficEnabled(true);
    }
  }

  function toggleMapType() {
    if (!map) return;
    const nextType = mapTypeId === "roadmap" ? "hybrid" : "roadmap";
    map.setMapTypeId(nextType);
    setMapTypeId(nextType);
  }

  function zoomIn() {
    if (!map) return;
    map.setZoom((map.getZoom() || 13) + 1);
  }

  function zoomOut() {
    if (!map) return;
    map.setZoom((map.getZoom() || 13) - 1);
  }

  return (
    <div className="absolute right-3 top-3 flex flex-col gap-1.5 z-10 pointer-events-auto">
      {/* Zoom In */}
      <button
        type="button"
        onClick={zoomIn}
        aria-label="Zoom In"
        className="w-9 h-9 rounded-xl bg-surface-container/90 backdrop-blur-md text-on-surface hover:text-primary flex items-center justify-center shadow-md border border-outline-variant/30 active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined text-[20px]">add</span>
      </button>

      {/* Zoom Out */}
      <button
        type="button"
        onClick={zoomOut}
        aria-label="Zoom Out"
        className="w-9 h-9 rounded-xl bg-surface-container/90 backdrop-blur-md text-on-surface hover:text-primary flex items-center justify-center shadow-md border border-outline-variant/30 active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined text-[20px]">remove</span>
      </button>

      {/* Recenter */}
      {onRecenter && (
        <button
          type="button"
          onClick={onRecenter}
          aria-label="Recenter map"
          className="w-9 h-9 rounded-xl bg-surface-container/90 backdrop-blur-md text-primary flex items-center justify-center shadow-md border border-outline-variant/30 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">
            my_location
          </span>
        </button>
      )}

      {/* Transit Lines Layer Toggle */}
      <button
        type="button"
        onClick={toggleTransit}
        aria-label="Toggle Public Transit Layer"
        title="Toggle Public Transit Lines"
        className={`w-9 h-9 rounded-xl backdrop-blur-md flex items-center justify-center shadow-md border border-outline-variant/30 active:scale-95 transition-all ${
          transitEnabled
            ? "bg-primary-container text-on-primary-container font-bold"
            : "bg-surface-container/90 text-on-surface-variant hover:text-on-surface"
        }`}
      >
        <span className="material-symbols-outlined text-[19px]">
          directions_bus
        </span>
      </button>

      {/* Live Traffic Layer Toggle */}
      <button
        type="button"
        onClick={toggleTraffic}
        aria-label="Toggle Traffic Layer"
        title="Toggle Real-Time Traffic Layer"
        className={`w-9 h-9 rounded-xl backdrop-blur-md flex items-center justify-center shadow-md border border-outline-variant/30 active:scale-95 transition-all ${
          trafficEnabled
            ? "bg-tertiary-container text-on-tertiary-container font-bold"
            : "bg-surface-container/90 text-on-surface-variant hover:text-on-surface"
        }`}
      >
        <span className="material-symbols-outlined text-[19px]">traffic</span>
      </button>

      {/* Satellite / Roadmap Toggle */}
      <button
        type="button"
        onClick={toggleMapType}
        aria-label="Toggle Satellite / Dark Map"
        title="Toggle Satellite Imagery"
        className="w-9 h-9 rounded-xl bg-surface-container/90 backdrop-blur-md text-secondary hover:text-primary flex items-center justify-center shadow-md border border-outline-variant/30 active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined text-[19px]">layers</span>
      </button>
    </div>
  );
}
