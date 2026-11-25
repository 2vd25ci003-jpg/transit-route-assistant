"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CONFIG } from "@/lib/config";

export function StartupSplash() {
  const prefersReduced = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = window.sessionStorage.getItem("transit_intro_seen");
    if (!seen) {
      setVisible(true);
    }
  }, []);

  function handleEnterApp() {
    window.sessionStorage.setItem("transit_intro_seen", "1");
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="transit-motion-poster-intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[100] bg-surface text-on-surface flex flex-col items-center justify-between px-4 py-6 sm:py-8 overflow-hidden select-none"
        >
          {/* Cinematic Radial Atmosphere (Ricotta Cream, Prussian Blue & Lobster Red) */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[780px] h-[420px] rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[680px] h-[340px] rounded-full bg-secondary/15 blur-3xl" />
          </div>

          {/* Perspective Highway / Horizon Grid */}
          <div className="absolute inset-x-0 bottom-0 h-[44%] pointer-events-none overflow-hidden">
            <svg
              viewBox="0 0 1200 400"
              preserveAspectRatio="none"
              className="w-full h-full opacity-45"
              fill="none"
            >
              {/* Horizon line */}
              <line x1="0" y1="20" x2="1200" y2="20" stroke="#003153" strokeOpacity="0.2" strokeWidth="1.5" />
              {/* Converging perspective road */}
              <polygon points="520,20 680,20 1120,400 80,400" fill="#e9dfd0" fillOpacity="0.65" />
              <line x1="520" y1="20" x2="80" y2="400" stroke="#003153" strokeOpacity="0.3" strokeWidth="2.5" />
              <line x1="680" y1="20" x2="1120" y2="400" stroke="#003153" strokeOpacity="0.3" strokeWidth="2.5" />
              {/* Center dashed lane */}
              <motion.line
                x1="600"
                y1="20"
                x2="600"
                y2="400"
                stroke="#d64527"
                strokeWidth="4"
                strokeDasharray="18 18"
                animate={
                  prefersReduced ? undefined : { strokeDashoffset: [0, -72] }
                }
                transition={{ duration: 0.7, repeat: 2, ease: "linear" }}
              />
            </svg>
          </div>

          {/* Top Bar: Brand Mark + Skip Intro */}
          <div className="relative z-10 w-full max-w-5xl flex items-center justify-between">
            <motion.div
              initial={prefersReduced ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-2"
            >
              <div className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-[20px]">
                  directions_bus
                </span>
              </div>
              <span className="text-sm font-bold tracking-wide text-primary">
                {CONFIG.cityName}
              </span>
            </motion.div>

            <button
              type="button"
              onClick={handleEnterApp}
              className="min-h-[44px] px-4 rounded-full bg-surface-container/90 hover:bg-surface-container-high border border-primary/15 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors"
            >
              Skip Intro →
            </button>
          </div>

          {/* Center Foreground Stage: Approaching Vector SVG Bus */}
          <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-3xl my-auto">
            {/* Motion Speed Streaks behind approaching bus */}
            {!prefersReduced && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {[-1, 1].map((dir) => (
                  <motion.div
                    key={dir}
                    initial={{ opacity: 0.75, scale: 0.5 }}
                    animate={{ opacity: 0, scale: 1.5 }}
                    transition={{ duration: 1.35, ease: "easeOut" }}
                    className="absolute w-72 sm:w-96 h-40 rounded-full border border-secondary/35"
                    style={{ transform: `translateX(${dir * 12}px)` }}
                  />
                ))}
              </div>
            )}

            {/* Approaching Bus Wrapper (scales from distance to foreground and stops) */}
            <motion.div
              initial={
                prefersReduced
                  ? { scale: 1, y: 0, opacity: 1 }
                  : { scale: 0.22, y: -85, opacity: 0.15 }
              }
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{
                duration: prefersReduced ? 0 : 1.4,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="relative w-full max-w-[340px] sm:max-w-[460px] md:max-w-[520px] flex flex-col items-center"
            >
              {/* Subtle suspension settle bounce after arrival */}
              <motion.div
                animate={
                  prefersReduced
                    ? undefined
                    : { y: [0, -5, 2, -2, 0] }
                }
                transition={{
                  delay: 1.25,
                  duration: 0.7,
                  ease: "easeInOut",
                }}
                className="relative w-full"
              >
                {/* Headlight Volumetric Glow Cones aligned with the coach headlights */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.95, 0.8] }}
                  transition={{ delay: 0.85, duration: 0.8 }}
                  className="absolute bottom-1 right-[4%] w-[44%] h-16 pointer-events-none flex justify-between"
                >
                  <div className="w-20 sm:w-28 h-16 bg-gradient-to-b from-secondary/50 via-secondary/15 to-transparent blur-md -skew-x-12 rounded-full" />
                  <div className="w-20 sm:w-28 h-16 bg-gradient-to-b from-secondary/50 via-secondary/15 to-transparent blur-md skew-x-12 rounded-full" />
                </motion.div>

                {/* Ground Shadow */}
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[84%] h-6 rounded-full bg-primary/30 blur-lg" />

                {/* Uploaded Coach Bus Image blended seamlessly onto Ricotta Cream */}
                <img
                  src="/images/intro-bus.jpg"
                  alt="TransitAI Express Coach"
                  className="relative z-10 w-full h-auto object-contain mix-blend-multiply drop-shadow-[0_18px_28px_rgba(0,49,83,0.22)]"
                />
              </motion.div>
            </motion.div>
          </div>

          {/* Bottom Intro Typography & ENTER APP CTA */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.55 }}
            className="relative z-10 flex flex-col items-center text-center gap-3 max-w-lg w-full"
          >
            <span className="px-3.5 py-1 rounded-full bg-secondary/15 text-secondary text-[11px] font-extrabold uppercase tracking-[0.22em] border border-secondary/25">
              WELCOME ABOARD
            </span>

            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-primary">
              Transit<span className="text-secondary">AI</span>
            </h1>

            <p className="text-xs sm:text-sm text-on-surface-variant max-w-md leading-relaxed">
              Smart local bus routes, live fleet telemetry, and AI demand
              dispatch for {CONFIG.cityName}.
            </p>

            <motion.button
              type="button"
              onClick={handleEnterApp}
              whileHover={prefersReduced ? undefined : { scale: 1.03 }}
              whileTap={prefersReduced ? undefined : { scale: 0.97 }}
              className="mt-2 min-h-[48px] px-8 py-3 rounded-2xl bg-primary hover:bg-primary-container text-on-primary font-bold text-sm tracking-wide flex items-center gap-2.5 shadow-[0_12px_28px_rgba(0,49,83,0.3)] transition-colors cursor-pointer"
            >
              <span>ENTER APP</span>
              <span className="material-symbols-outlined text-[20px] text-secondary">
                arrow_forward
              </span>
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
