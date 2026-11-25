"use client";

import { motion } from "framer-motion";
import type { IntroScenePhase } from "@/hooks/useIntroSequence";

interface IntroLogoProps {
  scene: IntroScenePhase;
  isReadyForEntry: boolean;
  onEnterApp: () => void;
}

export function IntroLogo({
  scene,
  isReadyForEntry,
  onEnterApp,
}: IntroLogoProps) {
  // Scene 1: Dark opening subtle logo reveal
  if (scene === 1) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.04 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center text-center gap-3 pointer-events-none"
      >
        <div className="w-14 h-14 rounded-2xl bg-sky-500/15 border border-sky-400/40 backdrop-blur-md flex items-center justify-center shadow-[0_0_32px_rgba(56,189,248,0.35)]">
          <span className="material-symbols-outlined text-sky-300 text-[30px]">
            directions_bus
          </span>
        </div>
        <span className="text-xl sm:text-2xl font-extrabold tracking-[0.3em] text-white/95 transit-intro-title-glow">
          TRANSITAI
        </span>
      </motion.div>
    );
  }

  // Scene 5: Final cinematic branding reveal & ENTER APP CTA
  if (scene >= 5 || isReadyForEntry) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center text-center gap-3 max-w-xl px-4"
      >
        <span className="px-3 py-1 rounded-full bg-sky-500/15 border border-sky-400/35 text-[10px] sm:text-xs font-bold uppercase tracking-[0.26em] text-cyan-300">
          WELCOME ABOARD
        </span>

        <h1 className="text-4xl sm:text-6xl font-black tracking-[0.18em] text-white transit-intro-title-glow">
          TRANSIT<span className="text-sky-400">AI</span>
        </h1>

        <p className="text-sm sm:text-base text-sky-100/85 font-medium tracking-wide">
          &ldquo;Your City. Your Bus. Your Journey.&rdquo;
        </p>

        <motion.button
          type="button"
          onClick={onEnterApp}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="mt-2 min-h-[48px] px-8 py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 hover:from-sky-400 hover:to-cyan-300 text-slate-950 font-extrabold text-sm tracking-wider flex items-center gap-2 shadow-[0_0_30px_rgba(56,189,248,0.45)] cursor-pointer transition-all"
        >
          <span>ENTER APP</span>
          <span className="material-symbols-outlined text-[20px]">
            arrow_forward
          </span>
        </motion.button>
      </motion.div>
    );
  }

  return null;
}
