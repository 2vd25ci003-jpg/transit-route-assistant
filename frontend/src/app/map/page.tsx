"use client";

import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { TopNav } from "@/components/TopNav";
import { TransitMap } from "@/components/TransitMap";
import { api } from "@/lib/api";
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
    <div className="min-h-screen bg-surface text-on-surface pb-24 md:pb-10">
      <TopNav
        rightSlot={
          <span className="hidden sm:inline text-xs text-secondary font-semibold">
            {vehicles.length} simulated buses
          </span>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 flex flex-col gap-3">
          <div>
            <h1 className="text-xl font-bold text-on-surface">
              3D Transit Explorer
            </h1>
            <p className="text-xs text-on-surface-variant">
              Select any stop to smoothly fly the 3D camera
            </p>
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter stops to fly-to..."
            className="h-11 px-4 rounded-xl bg-surface-container/80 backdrop-blur-md border border-white/10 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 max-h-[500px] overflow-y-auto pr-1">
            {filteredStops.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setFocusStop(s)}
                className={`px-3.5 py-2.5 min-h-[44px] rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors ${
                  focusStop?.id === s.id
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                }`}
              >
                <span>{s.name}</span>
                <span className="font-mono text-[11px] opacity-75">
                  #{s.id}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8">
          <TransitMap
            stops={stops}
            vehicles={vehicles}
            focusStop={focusStop}
            heightClass="h-[420px] lg:h-[620px]"
            onSelectStop={(s) => setFocusStop(s)}
          />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
