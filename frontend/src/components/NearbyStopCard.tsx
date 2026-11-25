"use client";

import { GlassCard } from "@/components/GlassCard";
import { useI18n } from "@/lib/i18n";
import { getSimulatedCrowding } from "@/lib/storage";
import type { EtaItem, NearbyStop } from "@/lib/types";

interface NearbyStopCardProps {
  stop: NearbyStop;
  etas: EtaItem[];
  saved?: boolean;
  onToggleSave?: (stopId: number) => void;
  onSelectStop?: (stopId: number) => void;
}

export function NearbyStopCard({
  stop,
  etas,
  saved = false,
  onToggleSave,
  onSelectStop,
}: NearbyStopCardProps) {
  const { t } = useI18n();
  const walkMin = Math.max(1, Math.round(stop.distance_m / 75));

  return (
    <GlassCard className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onSelectStop?.(stop.id)}
          className="flex flex-col text-left min-h-[44px] justify-center hover:text-primary transition-colors"
        >
          <h4 className="text-base font-semibold text-on-surface">
            {stop.name}
          </h4>
          <div className="flex items-center gap-1.5 text-on-surface-variant text-xs mt-0.5">
            <span className="material-symbols-outlined text-[15px] text-primary">
              directions_walk
            </span>
            <span>
              {Math.round(stop.distance_m)}m {t("away")}
            </span>
            <span>•</span>
            <span>
              ~{walkMin} {t("minWalk")}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onToggleSave?.(stop.id)}
          aria-label="Save this stop"
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors ${
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
        <div className="p-3 rounded-xl bg-surface-container-high/80 text-xs text-on-surface-variant">
          {t("noApproaching")}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {etas.slice(0, 3).map((eta) => {
            const crowding = getSimulatedCrowding(eta.trip_id, eta.route_id);
            const crowdColor =
              crowding === "High"
                ? "text-tertiary bg-tertiary/15"
                : crowding === "Medium"
                ? "text-secondary bg-secondary/15"
                : "text-primary bg-primary/15";

            return (
              <div
                key={`${eta.trip_id}-${eta.route_id}`}
                className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-high/85 border border-white/5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="px-2.5 py-1 rounded-lg bg-primary text-on-primary text-sm font-bold shrink-0">
                    R{eta.route_id}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-on-surface truncate">
                      {eta.route_name}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">
                      <span>Trip #{eta.trip_id}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded font-semibold ${crowdColor}`}
                      >
                        {t("crowding")}: {crowding}
                      </span>
                    </div>
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
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
