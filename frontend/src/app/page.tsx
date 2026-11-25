"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { GlassCard } from "@/components/GlassCard";
import { NearbyStopCard } from "@/components/NearbyStopCard";
import { SearchCard } from "@/components/SearchCard";
import { TopNav } from "@/components/TopNav";
import { TransitMap } from "@/components/TransitMap";
import { api } from "@/lib/api";
import { CONFIG } from "@/lib/config";
import { useI18n } from "@/lib/i18n";
import {
  FAVORITE_ROUTES_KEY,
  readIdList,
  SAVED_STOPS_KEY,
  toggleStoredId,
} from "@/lib/storage";
import type { EtaItem, NearbyStop, Route, Stop, Vehicle } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();

  const [stops, setStops] = useState<Stop[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [nearby, setNearby] = useState<NearbyStop[]>([]);
  const [etasByStop, setEtasByStop] = useState<Record<number, EtaItem[]>>({});
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [savedStopIds, setSavedStopIds] = useState<number[]>([]);
  const [favoriteRouteIds, setFavoriteRouteIds] = useState<number[]>([]);
  const [fromId, setFromId] = useState<number | "">("");
  const [toId, setToId] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSavedStopIds(readIdList(SAVED_STOPS_KEY));
    setFavoriteRouteIds(readIdList(FAVORITE_ROUTES_KEY));

    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const [allStops, allRoutes, nearbyStops, activeVehicles] =
          await Promise.all([
            api.getStops(),
            api.getRoutes(),
            api.getNearbyStops(
              CONFIG.mapCenter.lat,
              CONFIG.mapCenter.lng,
              15000
            ),
            api.getVehicles(),
          ]);

        if (!mounted) return;
        setStops(allStops);
        setRoutes(allRoutes);
        setNearby(nearbyStops.slice(0, 6));
        setVehicles(activeVehicles);

        if (allStops.length >= 2) {
          setFromId(allStops[0].id);
          setToId(allStops[allStops.length - 1].id);
        }

        const etaEntries = await Promise.all(
          nearbyStops.slice(0, 6).map(async (s) => {
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

  const slowVehicles = vehicles.filter(
    (v) => v.speed_kmh !== undefined && v.speed_kmh !== null && v.speed_kmh < 15
  );
  const savedStops = stops.filter((s) => savedStopIds.includes(s.id));
  const favoriteRoutes = routes.filter((r) => favoriteRouteIds.includes(r.id));
  const focusStop = stops.find((s) => s.id === Number(fromId)) ?? null;

  return (
    <div className="min-h-screen bg-surface text-on-surface pb-24 md:pb-10">
      <TopNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Search, Alerts, Shortcuts, Saved */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-secondary font-semibold">
                {t("liveDispatch")}
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-on-surface mt-0.5">
                {CONFIG.cityName} Transit
              </h1>
            </div>
            <div className="w-11 h-11 rounded-full bg-surface-container-high flex items-center justify-center text-secondary">
              <span
                className="material-symbols-outlined text-[22px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                directions_bus
              </span>
            </div>
          </div>

          {/* Service Alerts Banner */}
          <GlassCard
            enableTilt={false}
            className={`p-3.5 flex items-center gap-3 ${
              slowVehicles.length > 0
                ? "border-secondary/50 bg-secondary/10"
                : "border-white/15"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] shrink-0 ${
                slowVehicles.length > 0 ? "text-secondary" : "text-primary"
              }`}
            >
              {slowVehicles.length > 0 ? "warning" : "check_circle"}
            </span>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-on-surface">
                {t("serviceAlerts")}
              </span>
              <span className="text-[11px] text-on-surface-variant">
                {slowVehicles.length > 0
                  ? t("bunchingAdvisory")
                  : t("allNormal")}
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-secondary shrink-0">
              {vehicles.length} {t("activeVehicles")}
            </span>
          </GlassCard>

          <SearchCard
            stops={stops}
            fromId={fromId}
            toId={toId}
            onChangeFrom={setFromId}
            onChangeTo={setToId}
            onSwap={handleSwap}
            onSearch={handleSearch}
          />

          {/* Quick Shortcuts */}
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              disabled
              title="Coming soon"
              className="flex flex-col items-center justify-center min-h-[64px] p-2 bg-surface-container/60 rounded-xl opacity-55 cursor-not-allowed text-center"
            >
              <span className="material-symbols-outlined text-[20px] text-outline mb-1">
                contactless
              </span>
              <span className="text-[11px] text-on-surface-variant leading-tight">
                Coming soon
              </span>
            </button>

            <button
              type="button"
              onClick={() => router.push("/routes")}
              className="flex flex-col items-center justify-center min-h-[64px] p-2 bg-surface-container/80 backdrop-blur-md border border-white/10 rounded-xl hover:bg-surface-container-high transition-colors text-center"
            >
              <span className="material-symbols-outlined text-[20px] text-primary mb-1">
                alt_route
              </span>
              <span className="text-[11px] text-on-surface leading-tight">
                {t("routesNav")}
              </span>
            </button>

            <button
              type="button"
              onClick={() => router.push("/map")}
              className="flex flex-col items-center justify-center min-h-[64px] p-2 bg-surface-container/80 backdrop-blur-md border border-white/10 rounded-xl hover:bg-surface-container-high transition-colors text-center"
            >
              <span className="material-symbols-outlined text-[20px] text-secondary mb-1">
                3d_rotation
              </span>
              <span className="text-[11px] text-on-surface leading-tight">
                {t("mapNav")}
              </span>
            </button>

            <button
              type="button"
              onClick={() => router.push("/live")}
              className="flex flex-col items-center justify-center min-h-[64px] p-2 bg-surface-container/80 backdrop-blur-md border border-white/10 rounded-xl hover:bg-surface-container-high transition-colors text-center"
            >
              <span className="material-symbols-outlined text-[20px] text-secondary mb-1">
                radar
              </span>
              <span className="text-[11px] text-on-surface leading-tight">
                {t("liveNav")}
              </span>
            </button>
          </div>

          {(savedStops.length > 0 || favoriteRoutes.length > 0) && (
            <GlassCard enableTilt={false} className="p-3.5 flex flex-col gap-2.5">
              {savedStops.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
                    {t("savedStops")}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {savedStops.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setFromId(s.id)}
                        className="min-h-[44px] px-3 rounded-xl bg-surface-container-high text-xs font-semibold text-on-surface hover:text-secondary"
                      >
                        ★ {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {favoriteRoutes.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                    {t("favoriteRoutes")}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {favoriteRoutes.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => router.push("/routes")}
                        className="min-h-[44px] px-3 rounded-xl bg-surface-container-high text-xs font-semibold text-on-surface hover:text-secondary"
                      >
                        ♥ {r.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </GlassCard>
          )}
        </div>

        {/* Right Column: Live 3D Map + Nearby Stops Grid */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {error && (
            <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs">
              {error} — Make sure FastAPI is running at{" "}
              <code>{CONFIG.apiUrl}</code>.
            </div>
          )}

          <div className="hidden lg:block">
            <TransitMap
              stops={stops}
              vehicles={vehicles}
              focusStop={focusStop}
              heightClass="h-[340px]"
              onSelectStop={(s) => setFromId(s.id)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[20px]">
                explore
              </span>
              <h2 className="text-lg font-semibold text-on-surface">
                {t("nearbyStops")}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => router.push("/map")}
              className="min-h-[44px] px-2 flex items-center gap-1 text-xs font-semibold text-secondary hover:underline"
            >
              <span>{t("mapNav")}</span>
              <span className="material-symbols-outlined text-[16px]">
                3d_rotation
              </span>
            </button>
          </div>

          {loading ? (
            <div className="p-6 rounded-2xl bg-surface-container/70 text-center text-sm text-on-surface-variant">
              Loading stops and live ETAs...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {nearby.map((stop) => (
                <NearbyStopCard
                  key={stop.id}
                  stop={stop}
                  etas={etasByStop[stop.id] ?? []}
                  saved={savedStopIds.includes(stop.id)}
                  onToggleSave={(id) =>
                    setSavedStopIds(toggleStoredId(SAVED_STOPS_KEY, id))
                  }
                  onSelectStop={(id) => setFromId(id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
