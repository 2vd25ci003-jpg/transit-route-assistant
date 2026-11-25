"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { NearbyStopCard } from "@/components/NearbyStopCard";
import { SearchCard } from "@/components/SearchCard";
import { api } from "@/lib/api";
import { CONFIG } from "@/lib/config";
import type { EtaItem, NearbyStop, Stop, Vehicle } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [stops, setStops] = useState<Stop[]>([]);
  const [nearby, setNearby] = useState<NearbyStop[]>([]);
  const [etasByStop, setEtasByStop] = useState<Record<number, EtaItem[]>>({});
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fromId, setFromId] = useState<number | "">("");
  const [toId, setToId] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const [allStops, nearbyStops, activeVehicles] = await Promise.all([
          api.getStops(),
          api.getNearbyStops(
            CONFIG.mapCenter.lat,
            CONFIG.mapCenter.lng,
            15000
          ),
          api.getVehicles(),
        ]);

        if (!mounted) return;
        setStops(allStops);
        setNearby(nearbyStops.slice(0, 4));
        setVehicles(activeVehicles);

        if (allStops.length >= 2) {
          setFromId(allStops[0].id);
          setToId(allStops[allStops.length - 1].id);
        }

        const etaEntries = await Promise.all(
          nearbyStops.slice(0, 4).map(async (s) => {
            try {
              const list = await api.getStopEta(s.id);
              return [s.id, list] as const;
            } catch {
              return [s.id, [] as EtaItem[]] as const;
            }
          })
        );
        if (!mounted) return;
        setEtasByStop(Object.fromEntries(etaEntries));
        setError(null);
      } catch (err) {
        if (!mounted) return;
        setError(
          err instanceof Error ? err.message : "Failed to load transit data"
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  function handleSwap() {
    setFromId(toId);
    setToId(fromId);
  }

  function handleSearch() {
    if (fromId === "" || toId === "") return;
    router.push(`/routes?from=${fromId}&to=${toId}`);
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface pb-24">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-xl border-b border-outline-variant/20">
        <div className="max-w-lg mx-auto h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-surface-container-high text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">
                directions_bus
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">
                {CONFIG.cityName}
              </span>
              <span className="text-sm font-semibold text-on-surface leading-none">
                Transit Search
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="px-3 py-1.5 rounded-full bg-surface-container-high text-xs font-semibold text-primary hover:bg-primary hover:text-on-primary transition-colors"
          >
            Operator Ops
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 flex flex-col gap-5">
        {/* Greeting */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-primary font-semibold">
              Live Dispatch Active
            </span>
            <h1 className="text-2xl font-bold text-on-surface mt-0.5">
              {CONFIG.cityName} Transit
            </h1>
          </div>
          <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
            <span
              className="material-symbols-outlined text-[22px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              wb_sunny
            </span>
          </div>
        </div>

        {/* Search Card */}
        <SearchCard
          stops={stops}
          fromId={fromId}
          toId={toId}
          onChangeFrom={setFromId}
          onChangeTo={setToId}
          onSwap={handleSwap}
          onSearch={handleSearch}
        />

        {/* Quick Action Shortcuts */}
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            disabled
            title="Coming soon"
            className="flex flex-col items-center justify-center p-2.5 bg-surface-container rounded-xl opacity-60 cursor-not-allowed text-center"
          >
            <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-outline mb-1">
              <span className="material-symbols-outlined text-[20px]">
                contactless
              </span>
            </div>
            <span className="text-[11px] text-on-surface-variant leading-tight">
              Coming soon
            </span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/routes")}
            className="flex flex-col items-center justify-center p-2.5 bg-surface-container rounded-xl hover:bg-surface-container-high transition-colors text-center"
          >
            <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary mb-1">
              <span className="material-symbols-outlined text-[20px]">map</span>
            </div>
            <span className="text-[11px] text-on-surface leading-tight">
              Route Map
            </span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/live")}
            className="flex flex-col items-center justify-center p-2.5 bg-surface-container rounded-xl hover:bg-surface-container-high transition-colors text-center"
          >
            <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary mb-1">
              <span className="material-symbols-outlined text-[20px]">
                radar
              </span>
            </div>
            <span className="text-[11px] text-on-surface leading-tight">
              Live Radar
            </span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="flex flex-col items-center justify-center p-2.5 bg-surface-container rounded-xl hover:bg-surface-container-high transition-colors text-center"
          >
            <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary mb-1">
              <span className="material-symbols-outlined text-[20px]">
                analytics
              </span>
            </div>
            <span className="text-[11px] text-on-surface leading-tight">
              Analytics
            </span>
          </button>
        </div>

        {/* Live Signal Banner */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container-high shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
            </span>
            <span className="text-xs font-semibold text-on-surface">
              {CONFIG.cityName} Signal: Active
            </span>
          </div>
          <span className="text-xs font-semibold text-primary">
            {vehicles.length} Active Vehicles
          </span>
        </div>

        {/* Error state */}
        {error && (
          <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs">
            {error} — Make sure the FastAPI backend is running at{" "}
            <code>{CONFIG.apiUrl}</code>.
          </div>
        )}

        {/* Nearby Stops */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">
              explore
            </span>
            <h2 className="text-lg font-semibold text-on-surface">
              Nearby Stops
            </h2>
          </div>
          <button
            type="button"
            onClick={() => router.push("/live")}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <span>Map radar</span>
            <span className="material-symbols-outlined text-[16px]">
              radar
            </span>
          </button>
        </div>

        {loading ? (
          <div className="p-6 rounded-xl bg-surface-container text-center text-sm text-on-surface-variant">
            Loading stops and live ETAs...
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {nearby.map((stop) => (
              <NearbyStopCard
                key={stop.id}
                stop={stop}
                etas={etasByStop[stop.id] ?? []}
                onSelectStop={(id) => {
                  setFromId(id);
                }}
              />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
