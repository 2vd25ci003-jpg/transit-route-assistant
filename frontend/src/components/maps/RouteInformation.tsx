"use client";

import { useState } from "react";
import type {
  RouteOptionDetail,
  RoutePlanResult,
  TravelModeOption,
} from "@/services/routeService";

interface RouteInformationProps {
  routeResult: RoutePlanResult | null;
  selectedRouteIndex: number;
  onSelectRouteIndex: (idx: number) => void;
  onModeChange: (mode: TravelModeOption) => void;
  onClearRoute: () => void;
  loading?: boolean;
}

export function RouteInformation({
  routeResult,
  selectedRouteIndex,
  onSelectRouteIndex,
  onModeChange,
  onClearRoute,
  loading = false,
}: RouteInformationProps) {
  const [showSteps, setShowSteps] = useState(false);

  if (!routeResult) return null;

  const activeRoute: RouteOptionDetail | undefined =
    routeResult.routes[selectedRouteIndex];

  return (
    <div className="bg-surface-container rounded-2xl p-4 shadow-xl border border-outline-variant/30 flex flex-col gap-4">
      {/* Header: Modes & Clear */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-surface-container-high p-1 rounded-xl">
          <button
            type="button"
            onClick={() => onModeChange("TRANSIT")}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              routeResult.travelMode === "TRANSIT"
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              directions_bus
            </span>
            <span>Transit</span>
          </button>

          <button
            type="button"
            onClick={() => onModeChange("DRIVING")}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              routeResult.travelMode === "DRIVING"
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              directions_car
            </span>
            <span>Driving</span>
          </button>

          <button
            type="button"
            onClick={() => onModeChange("WALKING")}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              routeResult.travelMode === "WALKING"
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              directions_walk
            </span>
            <span>Walk</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClearRoute}
          aria-label="Clear calculated route"
          className="text-xs font-semibold text-outline hover:text-error flex items-center gap-1 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
          <span>Clear</span>
        </button>
      </div>

      {loading ? (
        <div className="py-6 flex flex-col items-center justify-center gap-2 text-on-surface-variant text-xs">
          <span className="material-symbols-outlined text-primary text-2xl animate-spin">
            progress_activity
          </span>
          <span>Recalculating route...</span>
        </div>
      ) : activeRoute ? (
        <>
          {/* Main Route Metrics */}
          <div className="grid grid-cols-3 gap-2 bg-surface-container-high rounded-xl p-3">
            <div className="flex flex-col">
              <span className="text-[11px] text-on-surface-variant uppercase font-semibold">
                Travel Time
              </span>
              <span className="text-xl font-extrabold text-primary">
                {activeRoute.durationText}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[11px] text-on-surface-variant uppercase font-semibold">
                Distance
              </span>
              <span className="text-xl font-extrabold text-on-surface">
                {activeRoute.distanceText}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[11px] text-on-surface-variant uppercase font-semibold">
                Arrival Est.
              </span>
              <span className="text-xl font-extrabold text-secondary">
                {activeRoute.arrivalTime || "On Arrival"}
              </span>
            </div>
          </div>

          {/* Alternative Routes Selector */}
          {routeResult.routes.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-on-surface-variant">
                Alternative Routes ({routeResult.routes.length})
              </span>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {routeResult.routes.map((r, idx) => (
                  <button
                    key={`alt-${idx}`}
                    type="button"
                    onClick={() => onSelectRouteIndex(idx)}
                    className={`p-2.5 rounded-xl text-left shrink-0 transition-colors border ${
                      idx === selectedRouteIndex
                        ? "bg-primary-container/20 border-primary text-on-surface"
                        : "bg-surface-container-high border-transparent text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    <div className="text-xs font-bold">
                      Option {idx + 1}: {r.durationText}
                    </div>
                    <div className="text-[11px] text-outline">
                      {r.distanceText} • {r.summary}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Steps Toggle */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowSteps((s) => !s)}
              className="flex items-center justify-between text-xs font-semibold text-primary hover:underline pt-1"
            >
              <span>
                {showSteps ? "Hide Turn-by-Turn Steps" : `View Route Steps (${activeRoute.steps.length})`}
              </span>
              <span className="material-symbols-outlined text-[18px]">
                {showSteps ? "expand_less" : "expand_more"}
              </span>
            </button>

            {showSteps && (
              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                {activeRoute.steps.map((st, i) => (
                  <div
                    key={`step-${i}`}
                    className="flex items-start gap-2.5 text-xs bg-surface-container-high p-2.5 rounded-lg"
                  >
                    <span className="material-symbols-outlined text-primary text-[16px] shrink-0 mt-0.5">
                      {st.travelMode === "WALKING"
                        ? "directions_walk"
                        : st.travelMode === "TRANSIT"
                        ? "directions_bus"
                        : "straight"}
                    </span>
                    <div className="flex-1 leading-relaxed">
                      <div className="text-on-surface">{st.instructions}</div>
                      {st.transitDetails && (
                        <div className="text-[11px] text-secondary font-semibold mt-0.5">
                          {st.transitDetails.lineName && `Line: ${st.transitDetails.lineName}`}
                          {st.transitDetails.numStops && ` • ${st.transitDetails.numStops} stops`}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] text-outline shrink-0 font-mono">
                      {st.distanceText}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
