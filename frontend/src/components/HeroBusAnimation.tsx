"use client";

export function HeroBusAnimation() {
  return (
    <div
      aria-hidden="true"
      className="relative w-full overflow-hidden h-16 sm:h-20 bg-gradient-to-b from-surface to-surface-container-low/70 border-b border-outline-variant/60 select-none"
    >
      {/* Dashed road line underneath */}
      <div className="absolute bottom-2.5 inset-x-0 h-[2px] border-b-2 border-dashed border-primary/35" />
      <div className="absolute bottom-1 inset-x-0 h-1 bg-primary/10" />

      {/* GPU-accelerated horizontal bus track (12s linear infinite) */}
      <div className="hero-bus-track absolute bottom-2.5 left-0 will-change-transform">
        <div className="hero-bus-bounce">
          <svg
            width="128"
            height="48"
            viewBox="0 0 128 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-28 sm:w-32 h-auto drop-shadow-sm"
          >
            {/* Bus shadow */}
            <ellipse cx="64" cy="44" rx="52" ry="3" fill="#003153" fillOpacity="0.16" />

            {/* Bus body (Prussian Blue & Lobster Red stripe, Ricotta windows) */}
            <rect
              x="8"
              y="6"
              width="112"
              height="30"
              rx="7"
              fill="#003153"
            />
            {/* Lobster Red accent stripe */}
            <rect x="8" y="25" width="112" height="5" fill="#d64527" />
            {/* Front windshield */}
            <path
              d="M98 10H114C116.209 10 118 11.7909 118 14V22H98V10Z"
              fill="#faf6ef"
            />
            {/* Passenger windows */}
            <rect x="15" y="10" width="18" height="11" rx="2.5" fill="#faf6ef" />
            <rect x="37" y="10" width="18" height="11" rx="2.5" fill="#faf6ef" />
            <rect x="59" y="10" width="18" height="11" rx="2.5" fill="#faf6ef" />
            <rect x="81" y="10" width="13" height="11" rx="2.5" fill="#faf6ef" />

            {/* Headlight & taillight */}
            <rect x="116" y="27" width="4" height="4" rx="1" fill="#faf6ef" />
            <rect x="8" y="27" width="3" height="4" rx="1" fill="#e05336" />

            {/* Rear wheel (rotating) */}
            <g className="hero-wheel-spin" style={{ transformOrigin: "32px 37px" }}>
              <circle cx="32" cy="37" r="7" fill="#00223b" stroke="#faf6ef" strokeWidth="2" />
              <circle cx="32" cy="37" r="2.5" fill="#d64527" />
              <line x1="32" y1="31" x2="32" y2="43" stroke="#faf6ef" strokeWidth="1.2" />
              <line x1="26" y1="37" x2="38" y2="37" stroke="#faf6ef" strokeWidth="1.2" />
            </g>

            {/* Front wheel (rotating) */}
            <g className="hero-wheel-spin" style={{ transformOrigin: "96px 37px" }}>
              <circle cx="96" cy="37" r="7" fill="#00223b" stroke="#faf6ef" strokeWidth="2" />
              <circle cx="96" cy="37" r="2.5" fill="#d64527" />
              <line x1="96" y1="31" x2="96" y2="43" stroke="#faf6ef" strokeWidth="1.2" />
              <line x1="90" y1="37" x2="102" y2="37" stroke="#faf6ef" strokeWidth="1.2" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
