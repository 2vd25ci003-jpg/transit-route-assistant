"use client";

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtitle: string;
  icon: string;
  accent?: "primary" | "tertiary" | "secondary";
}

export function KpiCard({
  label,
  value,
  unit,
  subtitle,
  icon,
  accent = "primary",
}: KpiCardProps) {
  const accentStyles = {
    primary: {
      badgeBg: "bg-surface-container-high text-primary",
      pillBg: "bg-surface-container text-primary",
      labelColor: "text-on-surface-variant",
    },
    tertiary: {
      badgeBg: "bg-tertiary-container/30 text-tertiary",
      pillBg: "bg-tertiary/10 text-tertiary",
      labelColor: "text-tertiary",
    },
    secondary: {
      badgeBg: "bg-surface-container-high text-secondary",
      pillBg: "bg-surface-container text-secondary",
      labelColor: "text-on-surface-variant",
    },
  }[accent];

  return (
    <div className="bg-surface-container-low p-4 rounded-xl shadow-md flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <div>
          <span
            className={`text-[11px] font-medium uppercase tracking-wider block ${accentStyles.labelColor}`}
          >
            {label}
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-4xl font-extrabold tracking-tight text-on-surface">
              {value}
            </span>
            {unit && (
              <span className="text-sm font-semibold text-on-surface-variant">
                {unit}
              </span>
            )}
          </div>
        </div>
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${accentStyles.badgeBg}`}
        >
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </div>
      </div>

      <div className="mt-4">
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${accentStyles.pillBg}`}
        >
          {subtitle}
        </span>
      </div>
    </div>
  );
}
