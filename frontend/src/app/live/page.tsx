"use client";

import { useCallback, useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { DraggableSheet } from "@/components/DraggableSheet";
import { GlassCard } from "@/components/GlassCard";
import { TransitMap } from "@/components/TransitMap";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { getSimulatedCrowding } from "@/lib/storage";
import type { EtaItem, Stop, Vehicle } from "@/lib/types";

export default function LiveTrackingPage() {
  const { t } = useI18n();
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
    const timer = setInterval(refreshLive, 4000);
    return () => clearInterval(timer);
  }, [refreshLive]);

  useEffect(() => {
    if (selectedStopId === "") return;
    api
      .getStopEta(selectedStopId)
      .then(setEtas)
      .catch(() => setEtas([]));
  }, [selectedStopId]);

  const focusStop =
    stops.find((s) => s.id === Number(selectedStopId)) ?? null;

  return (
    <div className="min-h-screen bg-surface text-on-surface pb-24">
      <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-2xl border-b border-white/10">
        <div className="max-w-2xl mx-auto h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
            </span>
            <h1 className="text-base font-semibold text-on-surface">
              {t("liveFleetRadar")}
            </h1>
          </div>

          <button
            type="button"
            onClick={refreshLive}
            className="min-h-[44px] flex items-center gap-1 px-3 rounded-full bg-surface-container-high text-xs font-semibold text-primary"
          >
            <span className="material-symbols-outlined text-[16px]">
              refresh
            </span>
            <span>{lastUpdated || "Sync"}</span>
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto flex flex-col">
        <div className="px-4 pt-3">
          <TransitMap
            stops={stops}
            vehicles={vehicles}
            focusStop={focusStop}
            heightClass="h-[340px]"
            onSelectStop={(s) => setSelectedStopId(s.id)}
          />
        </div>

        <DraggableSheet title="Simulated Fleet & Stop ETAs">
          <div className="flex flex-col gap-4">
            {error && (
              <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs">
                {error}
              </div>
            )}

            {/* Stop ETA Selector */}
            <GlassCard enableTilt={false} className="p-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                  Live Stop ETA (Simulated)
                </span>
                <select
                  aria-label="Select stop for ETA"
                  value={selectedStopId}
                  onChange={(e) =>
                    setSelectedStopId(
                      e.target.value ? Number(e.target.value) : ""
                    )
                  }
                  className="min-h-[44px] bg-surface-container-lowest text-on-surface text-xs rounded-xl px-3 focus:outline-none"
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
                  {t("noApproaching")}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {etas.map((e) => {
                    const crowding = getSimulatedCrowding(e.trip_id, e.route_id);
                    return (
                      <div
                        key={`${e.trip_id}-${e.route_id}`}
                        className="flex items-center justify-between p-3 rounded-xl bg-surface-container-high/85"
                      >
                        <div>
                          <div className="text-sm font-semibold text-on-surface">
                            {e.route_name}
                          </div>
                          <div className="text-[11px] text-on-surface-variant">
                            Trip #{e.trip_id} • {t("crowding")}:{" "}
                            <span className="text-secondary font-semibold">
                              {crowding}
                            </span>
                          </div>
                        </div>
                        <span className="text-xl font-extrabold text-primary">
                          {Math.round(e.eta_minutes)} min
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>

            {/* Active Vehicles List */}
            <GlassCard enableTilt={false} className="p-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-on-surface">
                  {t("activeVehicles")} ({vehicles.length})
                </h2>
                <span className="text-[11px] text-on-surface-variant">
                  Simulated • 4s sync
                </span>
              </div>
              {vehicles.length === 0 ? (
                <p className="text-xs text-on-surface-variant">
                  No active vehicles right now.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {vehicles.map((v) => {
                    const crowding = getSimulatedCrowding(v.trip_id, v.route_id);
                    return (
                      <div
                        key={v.trip_id}
                        className="flex items-center justify-between p-3 rounded-xl bg-surface-container-high/85"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-primary text-on-primary font-bold text-xs flex items-center justify-center shrink-0">
                            R{v.route_id}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-on-surface truncate">
                              {v.route_name}
                            </div>
                            <div className="text-[11px] text-outline font-mono">
                              #{v.trip_id} • {v.speed_kmh ?? 22} km/h •{" "}
                              {crowding}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-primary font-mono shrink-0">
                          SIM
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          </div>
        </DraggableSheet>
      </main>

      <BottomNav />
    </div>
  );
}
