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
    <div className="flex flex-col items-center gap-1.5 w-56 sm:w-72">
      <div className="w-full flex items-center justify-between text-[10px] font-mono tracking-[0.18em] text-sky-300/80 uppercase">
        <span>{SCENE_LABELS[scene]}</span>
        <span>{Math.min(100, Math.round(progress))}%</span>
      </div>
      <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-300 to-white transition-all duration-150"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}
