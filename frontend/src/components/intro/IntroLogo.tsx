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
  // Scene 1: Opening subtle logo reveal
  if (scene === 1) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.04 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center text-center gap-3 pointer-events-none"
      >
        <div className="w-14 h-14 rounded-2xl bg-[#003153]/12 border border-[#003153]/25 backdrop-blur-md flex items-center justify-center shadow-[0_8px_28px_rgba(0,49,83,0.18)]">
          <span className="material-symbols-outlined text-[#003153] text-[30px]">
            directions_bus
          </span>
        </div>
        <span className="text-xl sm:text-2xl font-extrabold tracking-[0.3em] text-[#003153] transit-intro-title-glow">
          TRANSIT<span className="text-[#d64527]">AI</span>
        </span>
      </motion.div>
    );
  }

  // Scene 5: Final branding reveal & ENTER APP CTA
  if (scene >= 5 || isReadyForEntry) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center text-center gap-3 max-w-xl px-5 py-6 rounded-3xl bg-[#faf6ef]/82 backdrop-blur-md border border-[#d8cebe] shadow-[0_20px_50px_rgba(0,49,83,0.16)] pointer-events-auto"
      >
        <span className="px-3.5 py-1 rounded-full bg-[#d64527]/12 border border-[#d64527]/30 text-[10px] sm:text-xs font-bold uppercase tracking-[0.26em] text-[#d64527]">
          WELCOME ABOARD
        </span>

        <h1 className="text-4xl sm:text-6xl font-black tracking-[0.18em] text-[#003153] transit-intro-title-glow">
          TRANSIT<span className="text-[#d64527]">AI</span>
        </h1>

        <p className="text-sm sm:text-base text-[#1c4b6e] font-medium tracking-wide">
          &ldquo;Your City. Your Bus. Your Journey.&rdquo;
        </p>

        <motion.button
          type="button"
          onClick={onEnterApp}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="mt-2 min-h-[48px] px-8 py-3 rounded-2xl bg-[#003153] hover:bg-[#0a3d62] text-[#faf6ef] font-extrabold text-sm tracking-wider flex items-center gap-2 shadow-[0_10px_28px_rgba(0,49,83,0.3)] border border-[#003153] cursor-pointer transition-all"
        >
          <span>ENTER APP</span>
          <span className="material-symbols-outlined text-[20px] text-[#d64527]">
            arrow_forward
          </span>
        </motion.button>
      </motion.div>
    );
  }

  return null;
}
