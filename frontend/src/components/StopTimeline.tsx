"use client";

import type { RouteStop } from "@/lib/types";

interface StopTimelineProps {
  stops: RouteStop[];
  highlightStopIds?: number[];
}

export function StopTimeline({
  stops,
  highlightStopIds = [],
}: StopTimelineProps) {
  if (stops.length === 0) return null;

  return (
    <div className="flex flex-col w-full bg-surface-container rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">
          Stop Progression ({stops.length} Stops)
        </span>
        <span className="text-xs text-primary font-semibold">
          ~{(stops.length - 1) * 4} min est.
        </span>
      </div>

      <div className="relative flex flex-col">
        <div className="absolute left-[13px] top-4 bottom-4 w-[2px] bg-surface-container-highest" />

        {stops.map((rs, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === stops.length - 1;
          const isHighlighted = highlightStopIds.includes(rs.stop.id);

          return (
            <div
              key={`${rs.seq}-${rs.stop.id}`}
              className="relative flex items-start gap-3 py-2 z-10"
            >
              <div className="shrink-0 w-7 flex justify-center pt-0.5">
                {isFirst ? (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-surface-container-lowest" />
                  </div>
                ) : isLast ? (
                  <div className="w-5 h-5 rounded-full bg-tertiary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[12px] text-on-tertiary font-bold">
                      pin_drop
                    </span>
                  </div>
                ) : isHighlighted ? (
                  <div className="w-4 h-4 rounded-full bg-secondary border-2 border-surface-container-lowest" />
                ) : (
                  <div className="w-3 h-3 rounded-full bg-surface-container-highest border border-outline mt-1" />
                )}
              </div>

              <div className="flex items-center justify-between flex-1 min-w-0">
                <div className="flex flex-col min-w-0">
                  <span
                    className={`text-sm truncate ${
                      isFirst || isLast || isHighlighted
                        ? "font-semibold text-on-surface"
                        : "text-on-surface-variant"
                    }`}
                  >
                    {rs.stop.name}
                  </span>
                  <span className="text-[11px] text-outline">
                    Stop #{rs.seq} • {rs.stop.lat.toFixed(4)},{" "}
                    {rs.stop.lng.toFixed(4)}
                  </span>
                </div>
                <span className="text-xs font-mono text-on-surface-variant shrink-0 ml-2">
                  +{idx * 4}m
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
