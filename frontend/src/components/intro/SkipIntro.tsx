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
        className="min-h-[44px] min-w-[44px] px-3 rounded-full bg-[#faf6ef]/85 hover:bg-[#f2eadc] backdrop-blur-md border border-[#d8cebe] text-[#003153] flex items-center justify-center gap-1.5 text-xs font-semibold shadow-sm transition-colors cursor-pointer"
      >
        <span className="material-symbols-outlined text-[18px] text-[#d64527]">
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
        className="min-h-[44px] px-3 rounded-full bg-[#faf6ef]/85 hover:bg-[#f2eadc] backdrop-blur-md border border-[#d8cebe] text-[#003153] text-xs font-mono font-semibold shadow-sm transition-colors cursor-pointer"
      >
        {lowQuality ? "3D Lite" : "3D HD"}
      </button>

      {/* Skip Intro */}
      <button
        type="button"
        onClick={onSkip}
        className="min-h-[44px] px-4 rounded-full bg-[#003153] hover:bg-[#d64527] text-[#faf6ef] border border-[#003153] hover:border-[#d64527] text-xs font-bold tracking-wider uppercase shadow-sm transition-all cursor-pointer"
      >
        Skip Intro →
      </button>
    </div>
  );
}
