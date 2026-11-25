"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Search", icon: "search" },
  { href: "/routes", label: "Routes", icon: "alt_route" },
  { href: "/map", label: "Google Map", icon: "map" },
  { href: "/live", label: "Live", icon: "radar" },
  { href: "/admin", label: "Admin", icon: "monitoring" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-surface/90 backdrop-blur-xl border-t border-outline-variant/30 shadow-[0_-4px_16px_rgba(0,0,0,0.35)]">
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
              className={`flex flex-col items-center justify-center min-w-[50px] min-h-[48px] px-1.5 transition-colors ${
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
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
