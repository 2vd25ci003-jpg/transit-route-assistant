"use client";

import { useCallback, useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { TransitMap } from "@/components/TransitMap";
import { api } from "@/lib/api";
import type { EtaItem, Stop, Vehicle } from "@/lib/types";

export default function LiveTrackingPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedStopId, setSelectedStopId] = useState<number | "">("");
  const [etas, setEtas] = useState<EtaItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const refreshLive = useCallback(async () => {
    try {
      const [vList, sList] = await Promise.all([
        api.getVehicles(),
        api.getStops(),
      ]);
      setVehicles(vList);
      setStops(sList);
      setLastUpdated(new Date().toLocaleTimeString());
      setError(null);
      if (sList.length > 0 && selectedStopId === "") {
        setSelectedStopId(sList[0].id);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch live vehicles"
      );
    }
  }, [selectedStopId]);

  useEffect(() => {
    refreshLive();
    const timer = setInterval(refreshLive, 10000);
    return () => clearInterval(timer);
  }, [refreshLive]);

  useEffect(() => {
    if (selectedStopId === "") return;
    api
      .getStopEta(selectedStopId)
      .then(setEtas)
      .catch(() => setEtas([]));
  }, [selectedStopId]);

  return (
    <div className="min-h-screen bg-surface text-on-surface pb-24">
      <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-xl border-b border-outline-variant/20">
        <div className="max-w-2xl mx-auto h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
            </span>
            <h1 className="text-base font-semibold text-on-surface">
              Live Fleet Radar
            </h1>
          </div>

          <button
            type="button"
            onClick={refreshLive}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-high text-xs font-semibold text-primary"
          >
            <span className="material-symbols-outlined text-[16px]">
              refresh
            </span>
            <span>{lastUpdated || "Sync"}</span>
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 flex flex-col gap-4">
        <TransitMap
          stops={stops}
          vehicles={vehicles}
          heightClass="h-[360px]"
        />

        {error && (
          <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs">
            {error}
          </div>
        )}

        {/* Stop ETA Selector */}
        <section className="bg-surface-container rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">
              Live Stop ETA
            </span>
            <select
              aria-label="Select stop for ETA"
              value={selectedStopId}
              onChange={(e) =>
                setSelectedStopId(e.target.value ? Number(e.target.value) : "")
              }
              className="bg-surface-container-lowest text-on-surface text-xs rounded-lg px-3 py-1.5 focus:outline-none"
            >
              {stops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {etas.length === 0 ? (
            <p className="text-xs text-on-surface-variant">
              No approaching buses for this stop right now.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {etas.map((e) => (
                <div
                  key={`${e.trip_id}-${e.route_id}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-surface-container-high"
                >
                  <div>
                    <div className="text-sm font-semibold text-on-surface">
                      {e.route_name}
                    </div>
                    <div className="text-[11px] text-on-surface-variant">
                      Trip #{e.trip_id}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-extrabold text-primary">
                      {Math.round(e.eta_minutes)} min
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Active Vehicles List */}
        <section className="bg-surface-container rounded-2xl p-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-on-surface">
              Active Vehicles ({vehicles.length})
            </h2>
            <span className="text-[11px] text-on-surface-variant">
              Auto-refreshes every 10s
            </span>
          </div>
          {vehicles.length === 0 ? (
            <p className="text-xs text-on-surface-variant">
              No active vehicles in the latest 5-minute window.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {vehicles.map((v) => (
                <div
                  key={v.trip_id}
                  className="flex items-center justify-between p-3 rounded-xl bg-surface-container-high"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary text-on-primary font-bold text-xs flex items-center justify-center shrink-0">
                      R{v.route_id}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-on-surface truncate">
                        {v.route_name}
                      </div>
                      <div className="text-[11px] text-outline font-mono">
                        Trip #{v.trip_id}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-primary font-mono shrink-0">
                    {new Date(v.ts).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
