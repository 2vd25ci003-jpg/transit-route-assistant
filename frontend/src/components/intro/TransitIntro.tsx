"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useIntroSequence } from "@/hooks/useIntroSequence";
import { IntroLoader } from "./IntroLoader";
import { IntroLogo } from "./IntroLogo";
import { SkipIntro } from "./SkipIntro";
import "./intro.css";

const BusScene = dynamic(
  () => import("./BusScene").then((mod) => mod.BusScene),
  { ssr: false }
);

export function TransitIntro() {
  const {
    visible,
    scene,
    progress,
    isReadyForEntry,
    webglSupported,
    lowQuality,
    reducedMotion,
    soundEnabled,
    setScene,
    setProgress,
    setIsReadyForEntry,
    setLowQuality,
    enterApp,
    toggleSound,
  } = useIntroSequence();

  const [exiting, setExiting] = useState(false);

  const handleEnter = useCallback(() => {
    setExiting(true);
    window.setTimeout(() => {
      enterApp();
      setExiting(false);
    }, 500);
  }, [enterApp]);

  const handleReadyForEntry = useCallback(() => {
    setIsReadyForEntry(true);
  }, [setIsReadyForEntry]);

  // Immediate fallback progression if WebGL is unavailable or reduced motion is preferred
  useEffect(() => {
    if (!visible) return;
    if (!webglSupported || reducedMotion) {
      setScene(5);
      setProgress(100);
      setIsReadyForEntry(true);
    }
  }, [
    visible,
    webglSupported,
    reducedMotion,
    setScene,
    setProgress,
    setIsReadyForEntry,
  ]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="TransitAI 3D Cinematic Intro"
      className={`fixed inset-0 z-[100] overflow-hidden bg-[#040812] text-white transition-opacity duration-500 ${
        exiting ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {/* 3D WebGL Canvas or Graceful Dark Fallback */}
      {webglSupported && !reducedMotion ? (
        <div className="absolute inset-0">
          <BusScene
            lowQuality={lowQuality}
            onSceneChange={setScene}
            onProgressChange={setProgress}
            onReadyForEntry={handleReadyForEntry}
          />
        </div>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(56,189,248,0.22),#040812_70%)]" />
      )}

      {/* Atmospheric Vignette & Cinematic Letterbox */}
      <div className="transit-intro-radial pointer-events-none absolute inset-0" />
      <div className="transit-intro-letterbox-top pointer-events-none absolute inset-x-0 top-0 h-20" />
      <div className="transit-intro-letterbox-bottom pointer-events-none absolute inset-x-0 bottom-0 h-24" />

      {/* Top Controls: Sound, Quality, Skip */}
      <SkipIntro
        soundEnabled={soundEnabled}
        lowQuality={lowQuality}
        onToggleSound={toggleSound}
        onToggleQuality={() => setLowQuality((prev) => !prev)}
        onSkip={handleEnter}
      />

      {/* Scene 1 & Scene 5 Typography + ENTER APP CTA */}
      <IntroLogo
        scene={scene}
        isReadyForEntry={isReadyForEntry}
        onEnterApp={handleEnter}
      />

      {/* Bottom Progress Indicator */}
      <IntroLoader progress={progress} scene={scene} />
    </div>
  );
}
