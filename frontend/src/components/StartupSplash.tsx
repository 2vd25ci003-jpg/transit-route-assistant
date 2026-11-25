"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CONFIG } from "@/lib/config";

export function StartupSplash() {
  const prefersReduced = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (prefersReduced) return;
    const seen = window.sessionStorage.getItem("transit_intro_seen");
    if (seen) return;

    setVisible(true);
    const timer = window.setTimeout(() => {
      window.sessionStorage.setItem("transit_intro_seen", "1");
      setVisible(false);
    }, 1650);

    return () => window.clearTimeout(timer);
  }, [prefersReduced]);

  function handleDismiss() {
    window.sessionStorage.setItem("transit_intro_seen", "1");
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="transit-startup-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: -18, scale: 1.02 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          onClick={handleDismiss}
          className="fixed inset-0 z-[100] bg-surface flex flex-col items-center justify-center p-6 select-none cursor-pointer overflow-hidden"
        >
          {/* Subtle Ricotta / Prussian / Lobster ambient glow */}
          <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-secondary/15 blur-3xl pointer-events-none" />

          <div className="relative flex flex-col items-center gap-6 max-w-sm w-full">
            {/* Animated Transit Route SVG */}
            <div className="relative w-56 h-24 flex items-center justify-center">
              <svg
                viewBox="0 0 240 90"
                className="w-full h-full overflow-visible"
                fill="none"
              >
                {/* Base track */}
                <path
                  d="M 20 60 Q 80 15, 120 45 T 220 30"
                  stroke="#ddd0bd"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                {/* Animated Lobster Red route path */}
                <motion.path
                  d="M 20 60 Q 80 15, 120 45 T 220 30"
                  stroke="#d64527"
                  strokeWidth="5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.9, ease: "easeInOut" }}
                />

                {/* Stop Nodes (Prussian Blue & Ricotta Cream) */}
                {[
                  { cx: 20, cy: 60, delay: 0.05 },
                  { cx: 120, cy: 45, delay: 0.4 },
                  { cx: 220, cy: 30, delay: 0.75 },
                ].map((pt, i) => (
                  <motion.g
                    key={i}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: pt.delay, duration: 0.28 }}
                  >
                    <circle
                      cx={pt.cx}
                      cy={pt.cy}
                      r="9"
                      fill="#faf6ef"
                      stroke="#003153"
                      strokeWidth="3.5"
                    />
                    <circle cx={pt.cx} cy={pt.cy} r="3" fill="#d64527" />
                  </motion.g>
                ))}
              </svg>

              {/* Floating Bus Icon */}
              <motion.div
                initial={{ x: -95, y: 14, opacity: 0, scale: 0.7 }}
                animate={{ x: 92, y: -14, opacity: 1, scale: 1 }}
                transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
                className="absolute w-11 h-11 rounded-2xl bg-primary text-on-primary shadow-[0_10px_24px_rgba(0,49,83,0.35)] flex items-center justify-center border-2 border-surface"
              >
                <span className="material-symbols-outlined text-[22px]">
                  directions_bus
                </span>
              </motion.div>
            </div>

            {/* Brand Title */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.45 }}
              className="flex flex-col items-center text-center gap-1.5"
            >
              <div className="flex items-center gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-primary">
                  Transit<span className="text-secondary">AI</span>
                </span>
              </div>
              <span className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                {CONFIG.cityName} Smart Mobility
              </span>
            </motion.div>

            {/* Progress Pill */}
            <div className="w-40 h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.35, ease: "easeInOut" }}
                className="h-full rounded-full bg-gradient-to-r from-primary via-primary-container to-secondary"
              />
            </div>

            <span className="text-[11px] text-outline">
              Tap anywhere to skip
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
