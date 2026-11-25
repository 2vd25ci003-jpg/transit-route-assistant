"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LngLatBounds,
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type IControl,
} from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ColumnLayer, PathLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { CONFIG } from "@/lib/config";
import type { Stop, StopDemand, Vehicle } from "@/lib/types";

export interface DispatchOverlayRoute {
  vehicle_id: number;
  stops: Stop[];
}

interface TransitMapProps {
  stops?: Stop[];
  vehicles?: Vehicle[];
  polylineStops?: Stop[];
  stopDemands?: StopDemand[];
  dispatchRoutes?: DispatchOverlayRoute[];
  focusStop?: Stop | null;
  selectedHour?: number;
  heightClass?: string;
  onSelectStop?: (stop: Stop) => void;
}

// Normalized hourly multiplier (hours 6..21) for time-of-day 3D demand slider
const HOURLY_PROFILE: Record<number, number> = {
  6: 0.35,
  7: 0.65,
  8: 1.6,
  9: 1.8,
  10: 1.2,
  11: 0.8,
  12: 0.95,
  13: 0.8,
  14: 0.65,
  15: 0.7,
  16: 0.95,
  17: 1.6,
  18: 1.8,
  19: 1.3,
  20: 0.8,
  21: 0.35,
};

const DISPATCH_COLORS: [number, number, number][] = [
  [255, 255, 255],
  [255, 46, 147],
  [255, 112, 184],
  [203, 213, 225],
  [244, 114, 182],
];

export function TransitMap({
  stops = [],
  vehicles = [],
  polylineStops = [],
  stopDemands = [],
  dispatchRoutes = [],
  focusStop = null,
  selectedHour = 9,
  heightClass = "h-[380px]",
  onSelectStop,
}: TransitMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [liteMode, setLiteMode] = useState(false);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    title: string;
    subtitle: string;
  } | null>(null);

  // Detect prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setPrefersReducedMotion(mq.matches);
      if (mq.matches) setLiteMode(true);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Initialize MapLibre GL JS + Deck.gl MapboxOverlay once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Point MapLibre's Web Worker to public/maplibre-gl-worker.js for Next.js Webpack compatibility
    setWorkerUrl("/maplibre-gl-worker.js");

    const map = new MapLibreMap({
      container: containerRef.current,
      style: CONFIG.mapStyleUrl,
      center: [CONFIG.mapCenter.lng, CONFIG.mapCenter.lat],
      zoom: 12.2,
      pitch: liteMode ? 0 : 55,
      bearing: liteMode ? 0 : -15,
      attributionControl: { compact: true },
    });

    // Fallback to OpenStreetMap raster tiles if vector style fails to load
    let fallbackApplied = false;
    map.on("error", (e) => {
      const msg = String((e as { error?: { message?: string } })?.error?.message ?? "");
      if (!fallbackApplied && (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("style"))) {
        fallbackApplied = true;
        map.setStyle({
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [
            {
              id: "osm-tiles",
              type: "raster",
              source: "osm",
              paint: {
                "raster-brightness-max": 0.45,
                "raster-saturation": -0.6,
                "raster-contrast": 0.2,
              },
            },
          ],
        });
      }
    });

    map.addControl(new NavigationControl({ visualizePitch: true }), "bottom-right");

    const overlay = new MapboxOverlay({
      interleaved: false,
      layers: [],
    });
    map.addControl(overlay as unknown as IControl);

    map.on("load", () => {
      try {
        const style = map.getStyle();
        const sources = style?.sources ?? {};
        const vectorSourceKey = Object.keys(sources).find(
          (k) => sources[k]?.type === "vector"
        );
        if (vectorSourceKey && !map.getLayer("transit-3d-buildings")) {
          map.addLayer({
            id: "transit-3d-buildings",
            source: vectorSourceKey,
            "source-layer": "building",
            type: "fill-extrusion",
            minzoom: 12,
            paint: {
              "fill-extrusion-color": "#112144",
              "fill-extrusion-height": [
                "coalesce",
                ["get", "render_height"],
                ["get", "height"],
                14,
              ],
              "fill-extrusion-base": [
                "coalesce",
                ["get", "render_min_height"],
                0,
              ],
              "fill-extrusion-opacity": 0.72,
            },
          });
        }
      } catch {
        // Style may not include a building source-layer in offline/test envs
      }
    });

    mapRef.current = map;
    overlayRef.current = overlay;

    return () => {
      overlay.finalize();
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  // Toggle 3D pitch / buildings when liteMode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const duration = prefersReducedMotion ? 0 : 700;
    map.easeTo({
      pitch: liteMode ? 0 : 55,
      bearing: liteMode ? 0 : -15,
      duration,
    });

    if (map.isStyleLoaded() && map.getLayer("transit-3d-buildings")) {
      map.setLayoutProperty(
        "transit-3d-buildings",
        "visibility",
        liteMode ? "none" : "visible"
      );
    }
  }, [liteMode, prefersReducedMotion]);

  // Smooth flyTo when focusStop or polylineStops changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const duration = prefersReducedMotion ? 0 : 1100;
    if (focusStop) {
      map.flyTo({
        center: [focusStop.lng, focusStop.lat],
        zoom: 14.5,
        pitch: liteMode ? 0 : 55,
        duration,
      });
      return;
    }

    if (polylineStops.length >= 2) {
      const bounds = new LngLatBounds();
      for (const s of polylineStops) bounds.extend([s.lng, s.lat]);
      map.fitBounds(bounds, {
        padding: 48,
        pitch: liteMode ? 0 : 52,
        duration,
        maxZoom: 14,
      });
    }
  }, [focusStop, polylineStops, liteMode, prefersReducedMotion]);

  const hourFactor = HOURLY_PROFILE[selectedHour] ?? 1.0;

  const layers = useMemo(() => {
    const deckLayers = [];

    // 1. Glowing Route Polyline
    if (polylineStops.length >= 2) {
      const pathData = [
        {
          name: "Selected Route",
          path: polylineStops.map((s) => [s.lng, s.lat] as [number, number]),
        },
      ];
      deckLayers.push(
        new PathLayer({
          id: "route-glow",
          data: pathData,
          getPath: (d) => d.path,
          getColor: [255, 46, 147, 115],
          widthMinPixels: 11,
          capRounded: true,
          jointRounded: true,
        }),
        new PathLayer({
          id: "route-core",
          data: pathData,
          getPath: (d) => d.path,
          getColor: [255, 255, 255, 245],
          widthMinPixels: 4,
          capRounded: true,
          jointRounded: true,
        })
      );
    }

    // 2. Dispatch Optimizer Overlay Routes
    if (dispatchRoutes.length > 0) {
      const optPaths = dispatchRoutes
        .filter((r) => r.stops.length >= 2)
        .map((r, i) => ({
          vehicle_id: r.vehicle_id,
          color: DISPATCH_COLORS[i % DISPATCH_COLORS.length],
          path: r.stops.map((s) => [s.lng, s.lat] as [number, number]),
        }));
      if (optPaths.length > 0) {
        deckLayers.push(
          new PathLayer({
            id: "dispatch-routes",
            data: optPaths,
            getPath: (d) => d.path,
            getColor: (d) => [...d.color, 215],
            widthMinPixels: 3,
            capRounded: true,
            jointRounded: true,
          })
        );
      }
    }

    // 3. Admin 3D Demand Columns (or flat circles in Lite mode)
    if (stopDemands.length > 0) {
      if (!liteMode) {
        deckLayers.push(
          new ColumnLayer<StopDemand>({
            id: "demand-columns-3d",
            data: stopDemands,
            diskResolution: 12,
            radius: 175,
            extruded: true,
            pickable: true,
            elevationScale: 18,
            getPosition: (d) => [d.lng, d.lat],
            getElevation: (d) => d.avg_hourly_boardings * hourFactor,
            getFillColor: (d) => {
              const val = d.avg_hourly_boardings * hourFactor;
              return val > 35
                ? [255, 46, 147, 235]
                : val > 18
                ? [255, 112, 184, 215]
                : [255, 255, 255, 210];
            },
            transitions: prefersReducedMotion ? undefined : { getElevation: 350 },
            onHover: (info) => {
              if (info.object) {
                const est = Math.round(
                  info.object.avg_hourly_boardings * hourFactor
                );
                setTooltip({
                  x: info.x,
                  y: info.y,
                  title: info.object.stop_name,
                  subtitle: `${selectedHour}:00 est. demand: ${est} pax/hr (Peak ${info.object.peak_hour}:00)`,
                });
              } else {
                setTooltip(null);
              }
            },
          })
        );
      } else {
        deckLayers.push(
          new ScatterplotLayer<StopDemand>({
            id: "demand-circles-2d",
            data: stopDemands,
            pickable: true,
            radiusMinPixels: 7,
            radiusMaxPixels: 22,
            getPosition: (d) => [d.lng, d.lat],
            getRadius: (d) => 90 + d.avg_hourly_boardings * hourFactor * 5,
            getFillColor: (d) => {
              const val = d.avg_hourly_boardings * hourFactor;
              return val > 35 ? [255, 46, 147, 210] : [255, 255, 255, 190];
            },
            onHover: (info) => {
              if (info.object) {
                const est = Math.round(
                  info.object.avg_hourly_boardings * hourFactor
                );
                setTooltip({
                  x: info.x,
                  y: info.y,
                  title: info.object.stop_name,
                  subtitle: `${selectedHour}:00 est. demand: ${est} pax/hr`,
                });
              } else {
                setTooltip(null);
              }
            },
          })
        );
      }
    }

    // 4. Stop Markers
    if (stops.length > 0) {
      deckLayers.push(
        new ScatterplotLayer<Stop>({
          id: "stops-layer",
          data: stops,
          pickable: true,
          stroked: true,
          radiusMinPixels: 6,
          radiusMaxPixels: 13,
          lineWidthMinPixels: 2,
          getPosition: (d) => [d.lng, d.lat],
          getRadius: 110,
          getFillColor: (d) =>
            focusStop && focusStop.id === d.id
              ? [255, 46, 147, 255]
              : [7, 17, 38, 245],
          getLineColor: [255, 255, 255, 255],
          onClick: (info) => {
            if (info.object && onSelectStop) onSelectStop(info.object);
          },
          onHover: (info) => {
            if (info.object) {
              setTooltip({
                x: info.x,
                y: info.y,
                title: info.object.name,
                subtitle: `Stop #${info.object.id}`,
              });
            } else if (stopDemands.length === 0) {
              setTooltip(null);
            }
          },
        })
      );
    }

    // 5. Live Vehicles
    if (vehicles.length > 0) {
      deckLayers.push(
        new ScatterplotLayer<Vehicle>({
          id: "vehicles-layer",
          data: vehicles,
          pickable: true,
          stroked: true,
          radiusMinPixels: 11,
          radiusMaxPixels: 18,
          lineWidthMinPixels: 2,
          getPosition: (d) => [d.lng, d.lat],
          getRadius: 180,
          getFillColor: [255, 46, 147, 245],
          getLineColor: [255, 255, 255, 255],
          transitions: prefersReducedMotion ? undefined : { getPosition: 600 },
          onHover: (info) => {
            if (info.object) {
              const spd = info.object.speed_kmh
                ? `${info.object.speed_kmh} km/h`
                : "Active";
              setTooltip({
                x: info.x,
                y: info.y,
                title: `${info.object.route_name} (Trip #${info.object.trip_id})`,
                subtitle: `${spd}${info.object.simulated ? " • Simulated" : ""}`,
              });
            } else {
              setTooltip(null);
            }
          },
        }),
        new TextLayer<Vehicle>({
          id: "vehicles-labels",
          data: vehicles,
          getPosition: (d) => [d.lng, d.lat],
          getText: (d) => `R${d.route_id}`,
          getSize: 11,
          getColor: [255, 255, 255, 255],
          getTextAnchor: "middle",
          getAlignmentBaseline: "center",
          fontWeight: "bold",
          transitions: prefersReducedMotion ? undefined : { getPosition: 600 },
        })
      );
    }

    return deckLayers;
  }, [
    polylineStops,
    dispatchRoutes,
    stopDemands,
    stops,
    vehicles,
    liteMode,
    hourFactor,
    selectedHour,
    focusStop,
    prefersReducedMotion,
    onSelectStop,
  ]);

  useEffect(() => {
    if (overlayRef.current) {
      overlayRef.current.setProps({ layers });
    }
  }, [layers]);

  return (
    <div
      className={`relative w-full ${heightClass} rounded-2xl overflow-hidden bg-surface-container-lowest border border-outline-variant/30 shadow-xl`}
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* 3D / 2D Lite Mode Toggle */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1 bg-surface-container/80 backdrop-blur-md rounded-xl p-1 border border-outline-variant/30 shadow-md text-xs">
        <button
          type="button"
          onClick={() => setLiteMode(false)}
          className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
            !liteMode
              ? "bg-primary text-on-primary"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          3D Map
        </button>
        <button
          type="button"
          onClick={() => setLiteMode(true)}
          className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
            liteMode
              ? "bg-primary text-on-primary"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          2D Lite
        </button>
      </div>

      {/* Hover Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-30 px-3 py-2 rounded-xl bg-surface-container/95 backdrop-blur-md border border-primary/30 shadow-xl text-xs max-w-[230px]"
          style={{
            left: Math.min(tooltip.x + 12, 260),
            top: Math.max(tooltip.y - 44, 12),
          }}
        >
          <div className="font-semibold text-on-surface truncate">
            {tooltip.title}
          </div>
          <div className="text-[11px] text-primary mt-0.5">
            {tooltip.subtitle}
          </div>
        </div>
      )}
    </div>
  );
}
