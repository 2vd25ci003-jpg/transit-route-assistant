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
    }, 2300);

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
          exit={{ opacity: 0, scale: 1.03, y: -16 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          onClick={handleDismiss}
          className="fixed inset-0 z-[100] bg-surface flex flex-col items-center justify-center p-6 select-none cursor-pointer overflow-hidden"
        >
          {/* Ambient Ricotta / Prussian / Lobster Glow */}
          <div className="absolute -top-28 -left-28 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-28 -right-28 w-96 h-96 rounded-full bg-secondary/15 blur-3xl pointer-events-none" />

          <div className="relative flex flex-col items-center gap-5 max-w-md w-full">
            {/* Animated Bus Stage */}
            <div className="relative w-full h-48 sm:h-56 flex items-center justify-center">
              {/* Animated Speed Lines behind the bus */}
              {[0, 1, 2].map((idx) => (
                <motion.div
                  key={idx}
                  initial={{ x: -80, opacity: 0 }}
                  animate={{ x: [40, -140], opacity: [0, 0.55, 0] }}
                  transition={{
                    duration: 1.1,
                    delay: 0.15 + idx * 0.18,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                  style={{ top: `${34 + idx * 18}%` }}
                  className="absolute right-8 h-0.5 w-24 rounded-full bg-gradient-to-l from-secondary/70 to-transparent pointer-events-none"
                />
              ))}

              {/* Animated Ground Shadow */}
              <motion.div
                initial={{ scaleX: 0.4, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 0.25 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className="absolute bottom-3 w-64 sm:w-72 h-4 rounded-full bg-primary blur-md"
              />

              {/* Bus Image driving in with subtle suspension bounce */}
              <motion.div
                initial={{ x: 150, opacity: 0, scale: 0.85 }}
                animate={{
                  x: 0,
                  opacity: 1,
                  scale: 1,
                  y: [0, -3, 0],
                }}
                transition={{
                  x: { duration: 0.95, ease: [0.22, 1, 0.36, 1] },
                  opacity: { duration: 0.45 },
                  scale: { duration: 0.95, ease: [0.22, 1, 0.36, 1] },
                  y: {
                    delay: 0.9,
                    duration: 1.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  },
                }}
                className="relative z-10 w-72 sm:w-80"
              >
                <img
                  src="/images/intro-bus.jpg"
                  alt="TransitAI Coach"
                  className="w-full h-auto object-contain mix-blend-multiply drop-shadow-md"
                />
              </motion.div>

              {/* Road Track Line */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.85, ease: "easeOut" }}
                className="absolute bottom-2 inset-x-4 h-1 rounded-full bg-gradient-to-r from-transparent via-primary/40 to-secondary/60 origin-right"
              />
            </div>

            {/* Brand Title */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.45 }}
              className="flex flex-col items-center text-center gap-1.5"
            >
              <div className="flex items-center gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-primary">
                  Transit<span className="text-secondary">AI</span>
                </span>
              </div>
              <span className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                {CONFIG.cityName} Smart Mobility
              </span>
            </motion.div>

            {/* Progress Bar */}
            <div className="w-48 h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2.0, ease: "easeInOut" }}
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
