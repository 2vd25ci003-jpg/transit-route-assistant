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
                {/* Headlight Volumetric Glow Cones */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.9, 0.75] }}
                  transition={{ delay: 0.85, duration: 0.8 }}
                  className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-[92%] h-16 pointer-events-none flex justify-between px-6 sm:px-10"
                >
                  <div className="w-24 sm:w-32 h-16 bg-gradient-to-b from-secondary/45 via-secondary/15 to-transparent blur-md -skew-x-12 rounded-full" />
                  <div className="w-24 sm:w-32 h-16 bg-gradient-to-b from-secondary/45 via-secondary/15 to-transparent blur-md skew-x-12 rounded-full" />
                </motion.div>

                {/* Ground Shadow */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[82%] h-6 rounded-full bg-primary/35 blur-lg" />

                {/* Large Detailed Front-3/4 Perspective Vector SVG Bus */}
                <svg
                  viewBox="0 0 520 300"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="relative z-10 w-full h-auto drop-shadow-[0_20px_30px_rgba(0,49,83,0.28)]"
                >
                  <defs>
                    <linearGradient id="busBodyGrad" x1="60" y1="30" x2="460" y2="260" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#0a3d62" />
                      <stop offset="100%" stopColor="#00223b" />
                    </linearGradient>
                    <linearGradient id="windshieldGrad" x1="220" y1="45" x2="430" y2="180" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#e9dfd0" stopOpacity="0.95" />
                      <stop offset="50%" stopColor="#faf6ef" stopOpacity="0.88" />
                      <stop offset="100%" stopColor="#cfc0a9" stopOpacity="0.92" />
                    </linearGradient>
                    <radialGradient id="headlightGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#fffdf9" />
                      <stop offset="60%" stopColor="#ffd166" />
                      <stop offset="100%" stopColor="#d64527" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* Left Side Body (3/4 perspective depth) */}
                  <path
                    d="M48 92 L205 40 L205 224 L48 205 Z"
                    fill="#00223b"
                    stroke="#003153"
                    strokeWidth="2"
                  />
                  {/* Side Windows */}
                  <polygon points="60,100 105,84 105,134 60,140" fill="#faf6ef" fillOpacity="0.88" />
                  <polygon points="113,81 155,66 155,128 113,133" fill="#faf6ef" fillOpacity="0.88" />
                  <polygon points="163,63 196,52 196,123 163,127" fill="#faf6ef" fillOpacity="0.88" />
                  {/* Side Lobster Red Accent Stripe */}
                  <polygon points="48,154 205,142 205,156 48,166" fill="#d64527" />

                  {/* Main Front Chassis */}
                  <path
                    d="M202 36 C202 24, 218 18, 330 18 C430 18, 448 26, 452 46 L464 218 C465 236, 452 248, 434 248 L220 248 C206 248, 198 238, 198 224 Z"
                    fill="url(#busBodyGrad)"
                    stroke="#faf6ef"
                    strokeOpacity="0.25"
                    strokeWidth="2"
                  />

                  {/* Roof AC Pod */}
                  <path
                    d="M235 18 C242 6, 405 6, 416 18 Z"
                    fill="#d64527"
                  />

                  {/* Destination LED Display */}
                  <rect x="255" y="30" width="146" height="18" rx="5" fill="#040a18" stroke="#d64527" strokeWidth="1.5" />
                  <text
                    x="328"
                    y="43"
                    textAnchor="middle"
                    fill="#faf6ef"
                    fontSize="10"
                    fontWeight="700"
                    fontFamily="Inter, sans-serif"
                    letterSpacing="1.5"
                  >
                    TRANSIT AI • EXPRESS
                  </text>

                  {/* Panoramic Front Windshield */}
                  <path
                    d="M214 58 C214 52, 222 50, 328 50 C426 50, 436 53, 438 62 L446 156 C446 164, 438 168, 330 168 C222 168, 212 164, 212 154 Z"
                    fill="url(#windshieldGrad)"
                    stroke="#00223b"
                    strokeWidth="3"
                  />
                  {/* Windshield reflection */}
                  <path
                    d="M235 58 L285 58 L248 158 L222 158 Z"
                    fill="#ffffff"
                    fillOpacity="0.45"
                  />
                  {/* Wipers */}
                  <line x1="255" y1="164" x2="315" y2="146" stroke="#00223b" strokeWidth="3" strokeLinecap="round" />
                  <line x1="340" y1="164" x2="405" y2="146" stroke="#00223b" strokeWidth="3" strokeLinecap="round" />

                  {/* Side Mirrors */}
                  <path d="M204 68 L174 72 L172 110 L188 112 L192 78 L204 76" fill="#d64527" />
                  <path d="M446 66 L478 70 L482 108 L466 110 L462 76 L446 74" fill="#d64527" />

                  {/* Front Lobster Red Fascia Grille */}
                  <path
                    d="M212 178 L448 178 L452 216 L208 216 Z"
                    fill="#d64527"
                  />
                  <rect x="275" y="188" width="110" height="18" rx="6" fill="#00223b" />
                  <text
                    x="330"
                    y="201"
                    textAnchor="middle"
                    fill="#faf6ef"
                    fontSize="10"
                    fontWeight="800"
                    letterSpacing="2"
                  >
                    HUBLI-DHARWAD
                  </text>

                  {/* Headlights with animated glow */}
                  <g>
                    <motion.circle
                      cx="236"
                      cy="200"
                      r="22"
                      fill="url(#headlightGlow)"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 0.95, 0.8] }}
                      transition={{ delay: 0.75, duration: 0.9 }}
                    />
                    <rect x="220" y="191" width="32" height="16" rx="5" fill="#fffdf9" stroke="#00223b" strokeWidth="2" />

                    <motion.circle
                      cx="424"
                      cy="200"
                      r="22"
                      fill="url(#headlightGlow)"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 0.95, 0.8] }}
                      transition={{ delay: 0.75, duration: 0.9 }}
                    />
                    <rect x="408" y="191" width="32" height="16" rx="5" fill="#fffdf9" stroke="#00223b" strokeWidth="2" />
                  </g>

                  {/* Front Bumper */}
                  <rect x="202" y="220" width="256" height="22" rx="8" fill="#00223b" />

                  {/* Side Rotating Wheels */}
                  <g>
                    {/* Rear Wheel */}
                    <circle cx="88" cy="212" r="22" fill="#00223b" stroke="#faf6ef" strokeWidth="2.5" />
                    <motion.g
                      animate={prefersReduced ? undefined : { rotate: 720 }}
                      transition={{ duration: 1.45, ease: [0.16, 1, 0.3, 1] }}
                      style={{ transformOrigin: "88px 212px" }}
                    >
                      <circle cx="88" cy="212" r="11" fill="#e9dfd0" />
                      <circle cx="88" cy="212" r="4" fill="#d64527" />
                      <line x1="88" y1="201" x2="88" y2="223" stroke="#003153" strokeWidth="2" />
                      <line x1="77" y1="212" x2="99" y2="212" stroke="#003153" strokeWidth="2" />
                    </motion.g>

                    {/* Front-Left Wheel */}
                    <circle cx="166" cy="228" r="26" fill="#00223b" stroke="#faf6ef" strokeWidth="3" />
                    <motion.g
                      animate={prefersReduced ? undefined : { rotate: 720 }}
                      transition={{ duration: 1.45, ease: [0.16, 1, 0.3, 1] }}
                      style={{ transformOrigin: "166px 228px" }}
                    >
                      <circle cx="166" cy="228" r="13" fill="#e9dfd0" />
                      <circle cx="166" cy="228" r="5" fill="#d64527" />
                      <line x1="166" y1="215" x2="166" y2="241" stroke="#003153" strokeWidth="2.5" />
                      <line x1="153" y1="228" x2="179" y2="228" stroke="#003153" strokeWidth="2.5" />
                    </motion.g>
                  </g>
                </svg>
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
