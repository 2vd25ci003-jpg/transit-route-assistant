"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { DraggableSheet } from "@/components/DraggableSheet";
import { GlassCard } from "@/components/GlassCard";
import { StopTimeline } from "@/components/StopTimeline";
import { TopNav } from "@/components/TopNav";
import { TransitMap } from "@/components/TransitMap";
import { api } from "@/lib/api";
import {
  FAVORITE_ROUTES_KEY,
  readIdList,
  toggleStoredId,
} from "@/lib/storage";
import type {
  Route,
  RouteDetail,
  RouteSearchResult,
  Stop,
} from "@/lib/types";

function RoutesContent() {
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const [routes, setRoutes] = useState<Route[]>([]);
  const [favoriteRouteIds, setFavoriteRouteIds] = useState<number[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<RouteDetail | null>(
    null
  );
  const [searchResults, setSearchResults] = useState<RouteSearchResult[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFavoriteRouteIds(readIdList(FAVORITE_ROUTES_KEY));

    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const [allRoutes, allStops] = await Promise.all([
          api.getRoutes(),
          api.getStops(),
        ]);
        if (!mounted) return;
        setRoutes(allRoutes);
        setStops(allStops);

        if (fromParam && toParam) {
          const found = await api.searchRoutes(
            Number(fromParam),
            Number(toParam)
          );
          if (!mounted) return;
          setSearchResults(found);
          if (found.length > 0) {
            const firstRouteId =
              found[0].legs?.[0]?.route.id ??
              (found[0].type === "direct"
                ? found[0].route.id
                : found[0].first_route?.id ?? allRoutes[0]?.id);
            if (firstRouteId) {
              const detail = await api.getRouteDetail(firstRouteId);
              if (mounted) setSelectedDetail(detail);
            }
          }
        } else if (allRoutes.length > 0) {
          const detail = await api.getRouteDetail(allRoutes[0].id);
          if (mounted) setSelectedDetail(detail);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load routes"
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [fromParam, toParam]);

  async function selectRoute(routeId: number) {
    try {
      const detail = await api.getRouteDetail(routeId);
      setSelectedDetail(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load route");
    }
  }

  const polylineStops = selectedDetail
    ? selectedDetail.stops.map((rs) => rs.stop)
    : [];

  const detailsPanel = (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs">
          {error}
        </div>
      )}

      {/* Search Results Section */}
      {fromParam && toParam && (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-base font-semibold text-on-surface">
            Search Results ({searchResults.length})
          </h2>
          {loading ? (
            <div className="p-4 rounded-xl bg-surface-container text-sm text-on-surface-variant">
              Searching routes...
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-4 rounded-xl bg-surface-container text-sm text-on-surface-variant">
              No route found between these stops.
            </div>
          ) : (
            searchResults.map((res, idx) => (
              <GlassCard
                key={`journey-${idx}`}
                className="p-3.5 flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                        res.num_transfers === 0
                          ? "bg-primary text-on-primary"
                          : "bg-secondary text-on-secondary"
                      }`}
                    >
                      {res.num_transfers === 0
                        ? "Direct"
                        : `${res.num_transfers} Transfer${
                            res.num_transfers > 1 ? "s" : ""
                          }`}
                    </span>
                    {res.transfer_stops.length > 0 && (
                      <span className="text-xs text-tertiary font-semibold">
                        via{" "}
                        {res.transfer_stops.map((ts) => ts.name).join(" → ")}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono font-bold text-primary shrink-0">
                    ~{Math.round(res.estimated_minutes)} min
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  {res.legs.map((leg, lIdx) => (
                    <button
                      key={`leg-${idx}-${lIdx}-${leg.route.id}`}
                      type="button"
                      onClick={() => selectRoute(leg.route.id)}
                      className="min-h-[44px] flex items-center justify-between p-2.5 rounded-xl bg-surface-container-high/85 hover:bg-surface-bright text-left transition-colors"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-on-surface truncate">
                          Leg {lIdx + 1}: {leg.route.name}
                        </span>
                        <span className="text-[11px] text-on-surface-variant truncate">
                          {leg.stops.map((s) => s.name).join(" → ")}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-secondary shrink-0 ml-2">
                        {Math.round(leg.estimated_minutes)}m
                      </span>
                    </button>
                  ))}
                </div>
              </GlassCard>
            ))
          )}
        </section>
      )}

      {/* All Routes Selector */}
      <section className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">
          All Corridor Lines ({routes.length})
        </span>
        <div className="flex flex-wrap gap-2">
          {routes.map((r) => {
            const isSelected = selectedDetail?.id === r.id;
            const isFav = favoriteRouteIds.includes(r.id);
            return (
              <div
                key={r.id}
                className={`flex items-center rounded-xl border ${
                  isSelected
                    ? "bg-primary text-on-primary border-primary"
                    : "bg-surface-container text-on-surface-variant border-white/10"
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectRoute(r.id)}
                  className="min-h-[44px] px-3 text-xs font-semibold"
                >
                  {r.name}
                </button>
                <button
                  type="button"
                  aria-label={`Favorite ${r.name}`}
                  onClick={() =>
                    setFavoriteRouteIds(
                      toggleStoredId(FAVORITE_ROUTES_KEY, r.id)
                    )
                  }
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      isFav ? "text-secondary" : "opacity-60"
                    }`}
                    style={
                      isFav
                        ? { fontVariationSettings: "'FILL' 1" }
                        : undefined
                    }
                  >
                    favorite
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Stop Timeline */}
      {selectedDetail && (
        <StopTimeline
          stops={selectedDetail.stops}
          highlightStopIds={[
            ...(fromParam ? [Number(fromParam)] : []),
            ...(toParam ? [Number(toParam)] : []),
          ]}
        />
      )}

      {/* Out-of-scope Fare badge */}
      <div className="p-3.5 rounded-xl bg-surface-container flex items-center justify-between opacity-70">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-secondary text-[20px]">
            contactless
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-on-surface">
              Smart Fare &amp; Pass
            </span>
            <span className="text-xs text-on-surface-variant">Coming soon</span>
          </div>
        </div>
        <span className="text-xs px-2 py-0.5 rounded bg-surface-container-high text-outline">
          Future Scope
        </span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface text-on-surface pb-24 md:pb-10">
      <TopNav />

      <main className="max-w-7xl mx-auto px-0 md:px-6 md:pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 px-4 md:px-0 pt-3 md:pt-0 lg:sticky lg:top-20">
          <TransitMap
            stops={polylineStops.length > 0 ? polylineStops : stops}
            polylineStops={polylineStops}
            heightClass="h-[320px] lg:h-[600px]"
          />
        </div>

        {/* Mobile draggable sheet */}
        <div className="lg:hidden">
          <DraggableSheet title="Route Journeys & Stop Timeline">
            {detailsPanel}
          </DraggableSheet>
        </div>

        {/* Laptop / Desktop side panel */}
        <div className="hidden lg:block lg:col-span-5">{detailsPanel}</div>
      </main>

      <BottomNav />
    </div>
  );
}

export default function RoutesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface text-on-surface p-8 text-center">
          Loading routes...
        </div>
      }
    >
      <RoutesContent />
    </Suspense>
  );
}
