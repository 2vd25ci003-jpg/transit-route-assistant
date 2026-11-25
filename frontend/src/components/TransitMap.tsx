"use client";

import { useEffect, useRef, useState } from "react";
import type * as LType from "leaflet";
import { CONFIG, hasGoogleMapsKey } from "@/lib/config";
import type { Stop, StopDemand, Vehicle } from "@/lib/types";
import { GoogleMap } from "./maps/GoogleMap";
import { BusStopMarkers } from "./maps/BusStopMarkers";
import { MapControls } from "./maps/MapControls";
import { LocationMarker } from "./maps/LocationMarker";

interface TransitMapProps {
  stops?: Stop[];
  vehicles?: Vehicle[];
  polylineStops?: Stop[];
  stopDemands?: StopDemand[];
  heightClass?: string;
  enableGoogleMapsToggle?: boolean;
}

export function TransitMap({
  stops = [],
  vehicles = [],
  polylineStops = [],
  stopDemands = [],
  heightClass = "h-[360px]",
  enableGoogleMapsToggle = true,
}: TransitMapProps) {
  const [provider, setProvider] = useState<"google" | "leaflet">(() =>
    hasGoogleMapsKey() ? "google" : "leaflet"
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const layerGroupRef = useRef<LType.LayerGroup | null>(null);

  // Google Map instance references
  const [gMap, setGMap] = useState<google.maps.Map | null>(null);
  const vehicleMarkersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  // Leaflet initialization (used when provider === 'leaflet' or fallback)
  useEffect(() => {
    if (provider !== "leaflet") return;
    let cancelled = false;

    async function init() {
      if (!containerRef.current || mapRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [CONFIG.mapCenter.lat, CONFIG.mapCenter.lng],
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      const group = L.layerGroup().addTo(map);
      mapRef.current = map;
      layerGroupRef.current = group;
    }

    init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, [provider]);

  // Leaflet layers rendering
  useEffect(() => {
    if (provider !== "leaflet") return;
    let active = true;

    async function renderLayers() {
      const map = mapRef.current;
      const group = layerGroupRef.current;
      if (!map || !group) return;
      const L = await import("leaflet");
      if (!active) return;

      group.clearLayers();
      const boundsPts: [number, number][] = [];

      // Demand heatmap circles
      if (stopDemands.length > 0) {
        const maxDemand = Math.max(
          1,
          ...stopDemands.map((d) => d.avg_hourly_boardings)
        );
        for (const d of stopDemands) {
          const ratio = d.avg_hourly_boardings / maxDemand;
          const color =
            ratio > 0.7 ? "#ffb95f" : ratio > 0.4 ? "#4fdbc8" : "#7bd0ff";
          L.circleMarker([d.lat, d.lng], {
            radius: 10 + ratio * 18,
            color,
            fillColor: color,
            fillOpacity: 0.3,
            weight: 1.5,
          })
            .bindPopup(
              `<strong>${d.stop_name}</strong><br/>Avg: ${d.avg_hourly_boardings} pax/hr<br/>Peak: ${d.peak_hour}:00`
            )
            .addTo(group);
          boundsPts.push([d.lat, d.lng]);
        }
      }

      // Stops
      for (const s of stops) {
        L.circleMarker([s.lat, s.lng], {
          radius: 5,
          color: "#4fdbc8",
          fillColor: "#060e20",
          fillOpacity: 1,
          weight: 2,
        })
          .bindPopup(`<strong>${s.name}</strong><br/>Stop #${s.id}`)
          .addTo(group);
        boundsPts.push([s.lat, s.lng]);
      }

      // Route Polyline
      if (polylineStops.length >= 2) {
        const latLngs: [number, number][] = polylineStops.map((s) => [
          s.lat,
          s.lng,
        ]);
        L.polyline(latLngs, {
          color: "#4fdbc8",
          weight: 4,
          opacity: 0.9,
        }).addTo(group);
        for (const pt of latLngs) boundsPts.push(pt);
      }

      // Live Vehicles
      for (const v of vehicles) {
        const icon = L.divIcon({
          className: "custom-bus-marker",
          html: `<div style="background:#14b8a6;color:#00201c;font-weight:800;font-size:10px;padding:2px 6px;border-radius:6px;border:2px solid #060e20;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.6);">R${v.route_id}</div>`,
          iconSize: [32, 20],
          iconAnchor: [16, 10],
        });
        L.marker([v.lat, v.lng], { icon })
          .bindPopup(
            `<strong>${v.route_name}</strong><br/>Trip #${v.trip_id}<br/>${new Date(v.ts).toLocaleTimeString()}`
          )
          .addTo(group);
        boundsPts.push([v.lat, v.lng]);
      }

      if (boundsPts.length >= 2) {
        map.fitBounds(boundsPts, { padding: [24, 24], maxZoom: 14 });
      }
    }

    renderLayers();
    return () => {
      active = false;
    };
  }, [provider, stops, vehicles, polylineStops, stopDemands]);

  // Google Maps custom vehicle markers & polyline update
  useEffect(() => {
    if (provider !== "google" || !gMap) return;

    // Clear old vehicle markers
    vehicleMarkersRef.current.forEach((m) => m.setMap(null));
    vehicleMarkersRef.current = [];

    // Clear old polyline
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    // Add vehicles
    const gVehicles = vehicles.map((v) => {
      const marker = new google.maps.Marker({
        position: { lat: v.lat, lng: v.lng },
        map: gMap,
        title: `${v.route_name} - Trip #${v.trip_id}`,
        label: {
          text: `R${v.route_id}`,
          color: "#00201c",
          fontWeight: "800",
          fontSize: "10px",
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: "#14b8a6",
          fillOpacity: 1,
          strokeColor: "#060e20",
          strokeWeight: 2.5,
        },
      });
      return marker;
    });
    vehicleMarkersRef.current = gVehicles;

    // Add polyline if route stops provided
    if (polylineStops.length >= 2) {
      const path = polylineStops.map((s) => ({ lat: s.lat, lng: s.lng }));
      const poly = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: "#4fdbc8",
        strokeOpacity: 0.9,
        strokeWeight: 4.5,
        map: gMap,
      });
      polylineRef.current = poly;

      const bounds = new google.maps.LatLngBounds();
      path.forEach((pt) => bounds.extend(pt));
      gMap.fitBounds(bounds, 36);
    }

    return () => {
      vehicleMarkersRef.current.forEach((m) => m.setMap(null));
      vehicleMarkersRef.current = [];
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [provider, gMap, vehicles, polylineStops]);

  return (
    <div className="relative w-full">
      {/* Map Provider Selector Pill */}
      {enableGoogleMapsToggle && (
        <div className="absolute top-3 left-3 z-20 flex items-center bg-surface-container/90 backdrop-blur-md rounded-xl p-1 shadow-md border border-outline-variant/30 text-xs">
          <button
            type="button"
            onClick={() => setProvider("google")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-all ${provider === "google"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface"
              }`}
          >
            <span className="material-symbols-outlined text-[15px]">
              map
            </span>
            <span>Google Maps</span>
          </button>
          <button
            type="button"
            onClick={() => setProvider("leaflet")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-all ${provider === "leaflet"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface"
              }`}
          >
            <span className="material-symbols-outlined text-[15px]">
              public
            </span>
            <span>OSM Tiles</span>
          </button>
        </div>
      )}

      {provider === "google" ? (
        <GoogleMap
          center={CONFIG.mapCenter}
          zoom={12}
          heightClass={heightClass}
          onMapLoaded={(m) => setGMap(m)}
          showMissingKeyHelp={true}
        >
          {(map) => (
            <>
              <MapControls
                map={map}
                onRecenter={() =>
                  map?.panTo({
                    lat: CONFIG.mapCenter.lat,
                    lng: CONFIG.mapCenter.lng,
                  })
                }
              />
              <BusStopMarkers map={map} stops={stops} />
            </>
          )}
        </GoogleMap>
      ) : (
        <div
          ref={containerRef}
          className={`w-full ${heightClass} rounded-2xl overflow-hidden bg-surface-container-lowest z-0 shadow-lg border border-outline-variant/20`}
        />
      )}
    </div>
  );
}
