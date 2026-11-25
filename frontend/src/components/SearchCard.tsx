"use client";

import { GlassCard } from "@/components/GlassCard";
import { useI18n } from "@/lib/i18n";
import type { Stop } from "@/lib/types";

interface SearchCardProps {
  stops: Stop[];
  fromId: number | "";
  toId: number | "";
  onChangeFrom: (id: number | "") => void;
  onChangeTo: (id: number | "") => void;
  onSwap: () => void;
  onSearch: () => void;
}

export function SearchCard({
  stops,
  fromId,
  toId,
  onChangeFrom,
  onChangeTo,
  onSwap,
  onSearch,
}: SearchCardProps) {
  const { t } = useI18n();
  const quickStops = stops.slice(0, 4);

  return (
    <GlassCard className="p-4 flex flex-col gap-3 relative">
      <div className="flex items-center gap-3 relative">
        {/* Route Connector Graphic */}
        <div className="flex flex-col items-center justify-between h-20 py-2.5 shrink-0">
          <div className="w-3 h-3 rounded-full bg-primary ring-4 ring-primary/20" />
          <div className="w-0.5 flex-1 bg-surface-bright my-1.5" />
          <div className="w-3 h-3 rounded-full bg-tertiary" />
        </div>

        {/* Inputs */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="flex items-center bg-surface-container-lowest/90 border border-white/5 rounded-xl px-3 h-12 shadow-inner">
            <span className="material-symbols-outlined text-primary text-[20px] mr-2">
              my_location
            </span>
            <select
              aria-label="Origin stop"
              value={fromId}
              onChange={(e) =>
                onChangeFrom(e.target.value ? Number(e.target.value) : "")
              }
              className="bg-transparent text-on-surface text-sm w-full focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-surface-container text-outline">
                {t("originPlaceholder")}
              </option>
              {stops.map((s) => (
                <option
                  key={s.id}
                  value={s.id}
                  className="bg-surface-container text-on-surface"
                >
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center bg-surface-container-lowest/90 border border-white/5 rounded-xl px-3 h-12 shadow-inner">
            <span className="material-symbols-outlined text-tertiary text-[20px] mr-2">
              search
            </span>
            <select
              aria-label="Destination stop"
              value={toId}
              onChange={(e) =>
                onChangeTo(e.target.value ? Number(e.target.value) : "")
              }
              className="bg-transparent text-on-surface text-sm w-full focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-surface-container text-outline">
                {t("destPlaceholder")}
              </option>
              {stops.map((s) => (
                <option
                  key={s.id}
                  value={s.id}
                  className="bg-surface-container text-on-surface"
                >
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Swap Button (44px min tap target) */}
        <button
          type="button"
          onClick={onSwap}
          aria-label="Swap origin and destination"
          className="w-11 h-11 rounded-full bg-surface-bright text-on-surface hover:text-primary flex items-center justify-center shadow-lg active:scale-90 transition-transform shrink-0"
        >
          <span className="material-symbols-outlined text-[20px]">
            swap_vert
          </span>
        </button>
      </div>

      {/* Quick Stop Chips */}
      {quickStops.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
          {quickStops.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onChangeTo(s.id)}
              className="flex items-center gap-1 px-3 min-h-[44px] rounded-full bg-surface-container-high/90 text-on-surface text-xs font-semibold shrink-0 hover:bg-primary-container hover:text-on-primary-container transition-colors"
            >
              <span className="material-symbols-outlined text-[14px] text-primary">
                directions_bus
              </span>
              <span>{s.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search CTA (44px min height) */}
      <button
        type="button"
        disabled={fromId === "" || toId === "" || fromId === toId}
        onClick={onSearch}
        className="w-full min-h-[44px] rounded-xl bg-primary-container hover:bg-primary disabled:opacity-40 disabled:cursor-not-allowed text-on-primary-container font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition-all"
      >
        <span className="material-symbols-outlined text-[18px]">
          directions
        </span>
        <span>{t("findRoutes")}</span>
      </button>
    </GlassCard>
  );
}
