"use client";

import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { TransitMap } from "@/components/TransitMap";
import { api } from "@/lib/api";
import { CONFIG } from "@/lib/config";
import type { Stop, Vehicle } from "@/lib/types";

export default function MapExplorerPage() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [focusStop, setFocusStop] = useState<Stop | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    Promise.all([api.getStops(), api.getVehicles()])
      .then(([s, v]) => {
        setStops(s);
        setVehicles(v);
      })
      .catch(() => {});
  }, []);

  const filteredStops = stops.filter((s) =>
    s.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div className="min-h-screen bg-surface text-on-surface pb-24">
      <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-xl border-b border-outline-variant/20">
        <div className="max-w-4xl mx-auto h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">
                3d_rotation
              </span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-on-surface leading-none">
                3D Transit Explorer
              </h1>
              <span className="text-[11px] text-primary font-semibold">
                {CONFIG.cityName} • MapLibre + deck.gl
              </span>
            </div>
          </div>
          <span className="text-xs text-on-surface-variant">
            {vehicles.length} simulated buses
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-4 flex flex-col gap-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter stops to fly-to..."
          className="h-11 px-4 rounded-xl bg-surface-container/80 backdrop-blur-md border border-outline-variant/30 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary"
        />

        <TransitMap
          stops={stops}
          vehicles={vehicles}
          focusStop={focusStop}
          heightClass="h-[440px]"
          onSelectStop={(s) => setFocusStop(s)}
        />

        <div className="flex flex-wrap gap-2">
          {filteredStops.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setFocusStop(s)}
              className={`px-3 py-2 min-h-[44px] rounded-xl text-xs font-semibold transition-colors ${
                focusStop?.id === s.id
                  ? "bg-primary-container text-on-primary-container"
                  : "bg-surface-container text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
