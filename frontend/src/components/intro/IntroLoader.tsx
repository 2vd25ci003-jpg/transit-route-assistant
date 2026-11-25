"use client";

import type { IntroScenePhase } from "@/hooks/useIntroSequence";

interface IntroLoaderProps {
  progress: number;
  scene: IntroScenePhase;
}

const SCENE_LABELS: Record<IntroScenePhase, string> = {
  1: "INITIALIZING TRANSIT MATRIX",
  2: "ENGAGING URBAN FLEET",
  3: "MAPPING INDIAN CORRIDOR",
  4: "SYNCING GPS TELEMETRY",
  5: "READY FOR DEPARTURE",
};

export function IntroLoader({ progress, scene }: IntroLoaderProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 w-60 sm:w-76">
      <div className="w-full flex items-center justify-between text-[10px] font-mono font-semibold tracking-[0.16em] text-[#003153] uppercase">
        <span>{SCENE_LABELS[scene]}</span>
        <span className="text-[#d64527]">{Math.min(100, Math.round(progress))}%</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-[#003153]/15 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#003153] via-[#1c4b6e] to-[#d64527] transition-all duration-150"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}
