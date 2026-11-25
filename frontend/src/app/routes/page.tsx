"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { StopTimeline } from "@/components/StopTimeline";
import { TransitMap } from "@/components/TransitMap";
import { api } from "@/lib/api";
import type {
  Route,
  RouteDetail,
  RouteSearchResult,
  Stop,
} from "@/lib/types";

function RoutesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<RouteDetail | null>(
    null
  );
  const [searchResults, setSearchResults] = useState<RouteSearchResult[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

  return (
    <div className="min-h-screen bg-surface text-on-surface pb-24">
      <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-xl border-b border-outline-variant/20">
        <div className="max-w-2xl mx-auto h-14 px-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-sm font-semibold text-on-surface hover:text-primary"
          >
            <span className="material-symbols-outlined text-[20px]">
              arrow_back
            </span>
            <span>Routes & Results</span>
          </button>
          <span className="text-xs text-primary font-semibold">
            {routes.length} Active Lines
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 flex flex-col gap-4">
        {/* Route Map */}
        <TransitMap
          stops={polylineStops.length > 0 ? polylineStops : stops}
          polylineStops={polylineStops}
          heightClass="h-[320px]"
        />

        {error && (
          <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs">
            {error}
          </div>
        )}

        {/* Search Results Section */}
        {fromParam && toParam && (
          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-on-surface">
              Search Results ({searchResults.length})
            </h2>
            {loading ? (
              <div className="p-4 rounded-xl bg-surface-container text-sm text-on-surface-variant">
                Searching routes...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-4 rounded-xl bg-surface-container text-sm text-on-surface-variant">
                No direct or one-transfer route found between these stops.
              </div>
            ) : (
              searchResults.map((res, idx) => (
                <div
                  key={`journey-${idx}`}
                  className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/20 flex flex-col gap-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                          res.num_transfers === 0
                            ? "bg-primary text-on-primary"
                            : res.num_transfers === 1
                            ? "bg-secondary text-on-secondary"
                            : "bg-tertiary text-on-tertiary"
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

                  {/* Legs breakdown */}
                  <div className="flex flex-col gap-1.5">
                    {res.legs.map((leg, lIdx) => (
                      <button
                        key={`leg-${idx}-${lIdx}-${leg.route.id}`}
                        type="button"
                        onClick={() => selectRoute(leg.route.id)}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-left transition-colors"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-on-surface truncate">
                            Leg {lIdx + 1}: {leg.route.name}
                          </span>
                          <span className="text-[11px] text-on-surface-variant truncate">
                            {leg.stops.map((s) => s.name).join(" → ")}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-primary shrink-0 ml-2">
                          {Math.round(leg.estimated_minutes)}m
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {/* All Routes Selector */}
        <section className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">
            All Corridor Lines
          </span>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {routes.map((r) => {
              const isSelected = selectedDetail?.id === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => selectRoute(r.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
                    isSelected
                      ? "bg-primary-container text-on-primary-container"
                      : "bg-surface-container text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {r.name}
                </button>
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
            <span className="material-symbols-outlined text-primary text-[20px]">
              contactless
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-on-surface">
                Smart Fare & Pass
              </span>
              <span className="text-xs text-on-surface-variant">
                Coming soon
              </span>
            </div>
          </div>
          <span className="text-xs px-2 py-0.5 rounded bg-surface-container-high text-outline">
            Future Scope
          </span>
        </div>
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
