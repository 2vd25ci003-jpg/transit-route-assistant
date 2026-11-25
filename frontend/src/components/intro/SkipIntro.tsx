"use client";

interface SkipIntroProps {
  soundEnabled: boolean;
  lowQuality: boolean;
  onToggleSound: () => void;
  onToggleQuality: () => void;
  onSkip: () => void;
}

export function SkipIntro({
  soundEnabled,
  lowQuality,
  onToggleSound,
  onToggleQuality,
  onSkip,
}: SkipIntroProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Sound Toggle (muted by default) */}
      <button
        type="button"
        onClick={onToggleSound}
        aria-label={soundEnabled ? "Mute intro sound" : "Enable intro sound"}
        title={soundEnabled ? "Sound ON" : "Sound Muted"}
        className="min-h-[44px] min-w-[44px] px-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 text-white/90 flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer"
      >
        <span className="material-symbols-outlined text-[18px] text-sky-300">
          {soundEnabled ? "volume_up" : "volume_off"}
        </span>
        <span className="hidden sm:inline">
          {soundEnabled ? "Audio On" : "Muted"}
        </span>
      </button>

      {/* Quality Mode Toggle (HD vs Lite) */}
      <button
        type="button"
        onClick={onToggleQuality}
        aria-label="Toggle 3D rendering quality"
        className="min-h-[44px] px-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 text-white/85 text-xs font-mono font-semibold transition-colors cursor-pointer"
      >
        {lowQuality ? "3D Lite" : "3D HD"}
      </button>

      {/* Skip Intro */}
      <button
        type="button"
        onClick={onSkip}
        className="min-h-[44px] px-4 rounded-full bg-white/15 hover:bg-sky-500 hover:text-slate-950 backdrop-blur-md border border-white/25 text-white text-xs font-bold tracking-wider uppercase transition-all cursor-pointer"
      >
        Skip Intro →
      </button>
    </div>
  );
}
