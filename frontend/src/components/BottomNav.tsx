"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-surface/85 backdrop-blur-2xl border-t border-white/10 shadow-[0_-8px_24px_rgba(0,0,0,0.45)]">
      <div className="max-w-lg mx-auto flex justify-around items-center h-16 px-2">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-w-[48px] min-h-[44px] px-2 rounded-xl transition-colors ${
                active
                  ? "text-primary font-bold"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span
                className="material-symbols-outlined text-[22px]"
                style={
                  active
                    ? { fontVariationSettings: "'FILL' 1" }
                    : undefined
                }
              >
                {item.icon}
              </span>
              <span className="text-[10px] font-medium mt-0.5 whitespace-nowrap">
                {t(item.labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
