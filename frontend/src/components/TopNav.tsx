"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CONFIG } from "@/lib/config";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const NAV_ITEMS: ReadonlyArray<{
  href: string;
  labelKey: TranslationKey;
  icon: string;
}> = [
  { href: "/", labelKey: "searchNav", icon: "search" },
  { href: "/routes", labelKey: "routesNav", icon: "alt_route" },
  { href: "/map", labelKey: "mapNav", icon: "3d_rotation" },
  { href: "/live", labelKey: "liveNav", icon: "radar" },
  { href: "/admin", labelKey: "adminNav", icon: "monitoring" },
];

export function TopNav({ rightSlot }: { rightSlot?: React.ReactNode }) {
  const pathname = usePathname();
  const { locale, setLocale, t } = useI18n();

  return (
    <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-2xl border-b border-white/10">
      <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-secondary text-on-secondary flex items-center justify-center shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[20px]">
              directions_bus
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] text-on-surface-variant uppercase tracking-wider truncate">
              {CONFIG.cityName}
            </span>
            <span className="text-sm font-bold text-on-surface leading-none truncate">
              TransitAI
            </span>
          </div>
        </Link>

        {/* Desktop / Laptop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-surface-container/80 p-1 rounded-xl border border-white/10">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold transition-colors ${
                  active
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">
                  {item.icon}
                </span>
                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {rightSlot}
          <button
            type="button"
            onClick={() => setLocale(locale === "en" ? "kn" : "en")}
            aria-label="Switch language between English and Kannada"
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-surface-container-high text-xs font-bold text-secondary hover:bg-surface-bright transition-colors"
          >
            {locale === "en" ? "ಕನ್ನಡ" : "EN"}
          </button>
        </div>
      </div>
    </header>
  );
}
