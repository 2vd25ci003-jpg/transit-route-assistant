"use client";

import { useCallback, useEffect, useState } from "react";
import { introAudio } from "@/lib/introAudio";

export type IntroScenePhase = 1 | 2 | 3 | 4 | 5;

const INTRO_SEEN_KEY = "transit_intro_seen";

function detectWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") || canvas.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

export function useIntroSequence() {
  const [visible, setVisible] = useState(false);
  const [scene, setScene] = useState<IntroScenePhase>(1);
  const [progress, setProgress] = useState(0);
  const [isReadyForEntry, setIsReadyForEntry] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);
  const [lowQuality, setLowQuality] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const seen = window.sessionStorage.getItem(INTRO_SEEN_KEY);
    if (seen) {
      setVisible(false);
      return;
    }

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isReduced = mq.matches;
    setReducedMotion(isReduced);

    const hasWebGL = detectWebGL();
    setWebglSupported(hasWebGL);

    const cores = navigator.hardwareConcurrency ?? 8;
    const isSmallScreen = window.innerWidth < 640;
    setLowQuality(cores <= 4 || isSmallScreen);

    setVisible(true);

    if (isReduced || !hasWebGL) {
      setScene(5);
      setProgress(100);
      setIsReadyForEntry(true);
    }
  }, []);

  const enterApp = useCallback(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    }
    introAudio.stopAll();
    setSoundEnabled(false);
    setVisible(false);
  }, []);

  const replayIntro = useCallback(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(INTRO_SEEN_KEY);
    }
    setScene(1);
    setProgress(0);
    setIsReadyForEntry(false);
    setVisible(true);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      introAudio.setEnabled(next);
      return next;
    });
  }, []);

  // Keyboard accessibility: Escape skips intro
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        enterApp();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, enterApp]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      introAudio.stopAll();
    };
  }, []);

  return {
    visible,
    scene,
    setScene,
    progress,
    setProgress,
    isReadyForEntry,
    setIsReadyForEntry,
    webglSupported,
    lowQuality,
    setLowQuality,
    reducedMotion,
    soundEnabled,
    toggleSound,
    enterApp,
    replayIntro,
  };
}
