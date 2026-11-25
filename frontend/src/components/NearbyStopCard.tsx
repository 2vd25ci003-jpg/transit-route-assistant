"use client";

import { useState } from "react";
import type { EtaItem, NearbyStop } from "@/lib/types";

interface NearbyStopCardProps {
  stop: NearbyStop;
  etas: EtaItem[];
  onSelectStop?: (stopId: number) => void;
}

export function NearbyStopCard({
  stop,
  etas,
  onSelectStop,
}: NearbyStopCardProps) {
  const [saved, setSaved] = useState(false);
  const walkMin = Math.max(1, Math.round(stop.distance_m / 75));

  return (
    <div className="bg-surface-container rounded-xl p-4 shadow-md flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <button
          type="button"
          onClick={() => onSelectStop?.(stop.id)}
          className="flex flex-col text-left hover:text-primary transition-colors"
        >
          <h4 className="text-base font-semibold text-on-surface">
            {stop.name}
          </h4>
          <div className="flex items-center gap-1.5 text-on-surface-variant text-xs mt-0.5">
            <span className="material-symbols-outlined text-[15px] text-primary">
              directions_walk
            </span>
            <span>{Math.round(stop.distance_m)}m away</span>
            <span>•</span>
            <span>~{walkMin} min walk</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSaved((prev) => !prev)}
          aria-label="Save this stop"
          className={`p-1 transition-colors ${
            saved ? "text-tertiary" : "text-outline hover:text-tertiary"
          }`}
        >
          <span
            className="material-symbols-outlined text-[22px]"
            style={
              saved ? { fontVariationSettings: "'FILL' 1" } : undefined
            }
          >
            star
          </span>
        </button>
      </div>

      {/* Live ETAs */}
      {etas.length === 0 ? (
        <div className="p-2.5 rounded-lg bg-surface-container-high text-xs text-on-surface-variant">
          No active buses approaching right now.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {etas.slice(0, 3).map((eta) => (
            <div
              key={`${eta.trip_id}-${eta.route_id}`}
              className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-high"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="px-2.5 py-1 rounded bg-primary text-on-primary text-sm font-bold shrink-0">
                  R{eta.route_id}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-on-surface truncate">
                    {eta.route_name}
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    Trip #{eta.trip_id}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end shrink-0 pl-2">
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-tight">
                    Live
                  </span>
                </div>
                <span className="text-2xl font-extrabold text-primary leading-none mt-1">
                  {Math.round(eta.eta_minutes)}{" "}
                  <span className="text-xs font-semibold uppercase">min</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
