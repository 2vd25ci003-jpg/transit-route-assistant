"use client";

import { useEffect, useRef } from "react";
import type { Stop } from "@/lib/types";

interface BusStopMarkersProps {
  map: google.maps.Map | null;
  stops: Stop[];
  onSelectStop?: (stop: Stop, asRole: "origin" | "destination") => void;
}

export function BusStopMarkers({
  map,
  stops,
  onSelectStop,
}: BusStopMarkersProps) {
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  useEffect(() => {
    if (!map) return;

    // Clean up previous markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }

    const markers: google.maps.Marker[] = stops.map((stop) => {
      const isBusStand =
        stop.name.toLowerCase().includes("bus stand") ||
        stop.name.toLowerCase().includes("cbt");
      const isRailway =
        stop.name.toLowerCase().includes("railway") ||
        stop.name.toLowerCase().includes("station");

      const markerColor = isRailway ? "#7bd0ff" : isBusStand ? "#14b8a6" : "#4fdbc8";

      const marker = new google.maps.Marker({
        position: { lat: stop.lat, lng: stop.lng },
        map,
        title: stop.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isBusStand || isRailway ? 7.5 : 5.5,
          fillColor: markerColor,
          fillOpacity: 1,
          strokeColor: "#060e20",
          strokeWeight: 2,
        },
      });

      marker.addListener("click", () => {
        const content = `
          <div style="color:#0b1326;font-family:Inter,sans-serif;padding:6px;max-width:220px;">
            <div style="font-size:13px;font-weight:700;margin-bottom:3px;">${stop.name}</div>
            <div style="font-size:11px;color:#555;margin-bottom:8px;">Stop ID: #${stop.id} • ${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)}</div>
            <div style="display:flex;gap:6px;">
              <button id="set-origin-btn-${stop.id}" style="background:#005048;color:#fff;border:none;padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer;font-weight:600;">Set Origin</button>
              <button id="set-dest-btn-${stop.id}" style="background:#e49200;color:#fff;border:none;padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer;font-weight:600;">Set Destination</button>
            </div>
          </div>
        `;

        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(content);
          infoWindowRef.current.open(map, marker);

          setTimeout(() => {
            const originBtn = document.getElementById(`set-origin-btn-${stop.id}`);
            const destBtn = document.getElementById(`set-dest-btn-${stop.id}`);

            if (originBtn && onSelectStop) {
              originBtn.onclick = () => {
                onSelectStop(stop, "origin");
                infoWindowRef.current?.close();
              };
            }
            if (destBtn && onSelectStop) {
              destBtn.onclick = () => {
                onSelectStop(stop, "destination");
                infoWindowRef.current?.close();
              };
            }
          }, 50);
        }
      });

      return marker;
    });

    markersRef.current = markers;

    return () => {
      markers.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
  }, [map, stops, onSelectStop]);

  return null;
}
