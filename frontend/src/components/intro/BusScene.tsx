"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { IntroScenePhase } from "@/hooks/useIntroSequence";
import { introAudio } from "@/lib/introAudio";
import { BusModel } from "./BusModel";
import { CityEnvironment } from "./CityEnvironment";
import { GPSRouteAnimation } from "./GPSRouteAnimation";

export interface BusSceneProps {
  lowQuality: boolean;
  onSceneChange: (scene: IntroScenePhase) => void;
  onProgressChange: (progress: number) => void;
  onReadyForEntry: () => void;
}

function SceneChoreography({
  lowQuality,
  onSceneChange,
  onProgressChange,
  onReadyForEntry,
}: BusSceneProps) {
  const { camera } = useThree();
  const busGroupRef = useRef<THREE.Group | null>(null);
  const speedRef = useRef<number>(0);
  const headlightRef = useRef<number>(0);
  const gpsStrengthRef = useRef<number>(0);
  const lookAtTarget = useRef(new THREE.Vector3(0, 1.5, -18));

  useFrame(() => {
    camera.lookAt(lookAtTarget.current);
  });

  useEffect(() => {
    const bus = busGroupRef.current;
    if (!bus) return;

    const stateProxy = { progress: 0 };
    camera.position.set(0, 2.3, 16);
    lookAtTarget.current.set(0, 1.5, -24);
    bus.position.set(0, 0, -48);

    const tl = gsap.timeline({
      onUpdate: () => {
        onProgressChange(Math.round(stateProxy.progress));
      },
    });

    // Scene 1: Dark atmospheric opening
    tl.call(() => {
      onSceneChange(1);
      introAudio.playOpeningSwell();
    })
      .to(stateProxy, { progress: 18, duration: 1.1, ease: "power1.inOut" }, 0)
      .to(
        camera.position,
        { x: 1.2, y: 2.1, z: 14.5, duration: 1.1, ease: "sine.inOut" },
        0
      );

    // Scene 2: Bus emerges from darkness, headlights illuminate
    tl.call(() => {
      onSceneChange(2);
      introAudio.playBusAmbience();
    })
      .to(headlightRef, { current: 1, duration: 0.7, ease: "power2.out" }, ">")
      .to(speedRef, { current: 14, duration: 0.9, ease: "power2.in" }, "<")
      .to(
        bus.position,
        { z: -18, duration: 2.0, ease: "power2.inOut" },
        "<"
      )
      .to(
        lookAtTarget.current,
        { x: 0, y: 1.55, z: -12, duration: 1.8, ease: "power1.inOut" },
        "<"
      )
      .to(stateProxy, { progress: 50, duration: 2.0, ease: "none" }, "<");

    // Scene 3: Dynamic urban sweep past bus stop & streetlights
    tl.call(() => {
      onSceneChange(3);
    })
      .to(
        camera.position,
        { x: -3.2, y: 2.0, z: 13.0, duration: 1.6, ease: "sine.inOut" },
        ">"
      )
      .to(
        bus.position,
        { z: -4, duration: 1.6, ease: "power1.out" },
        "<"
      )
      .to(
        lookAtTarget.current,
        { x: 0, y: 1.6, z: -2, duration: 1.6, ease: "power1.out" },
        "<"
      )
      .to(stateProxy, { progress: 72, duration: 1.6, ease: "none" }, "<");

    // Scene 4: GPS route illuminates & bus settles into hero foreground
    tl.call(() => {
      onSceneChange(4);
      introAudio.playGpsChime();
    })
      .to(gpsStrengthRef, { current: 1, duration: 0.7, ease: "power2.out" }, ">")
      .to(
        bus.position,
        { z: 1.6, duration: 1.3, ease: "power3.out" },
        "<"
      )
      .to(speedRef, { current: 0, duration: 1.2, ease: "power3.out" }, "<")
      .to(
        camera.position,
        { x: 2.8, y: 2.15, z: 12.2, duration: 1.3, ease: "power2.out" },
        "<"
      )
      .to(
        lookAtTarget.current,
        { x: 0, y: 1.65, z: 1.4, duration: 1.3, ease: "power2.out" },
        "<"
      )
      .to(stateProxy, { progress: 92, duration: 1.3, ease: "none" }, "<");

    // Scene 5: Final TransitAI hero lock & CTA reveal
    tl.call(() => {
      onSceneChange(5);
      introAudio.playLogoReveal();
    })
      .to(stateProxy, { progress: 100, duration: 0.6, ease: "power1.out" }, ">")
      .call(() => {
        onReadyForEntry();
      });

    return () => {
      tl.kill();
    };
  }, [camera, onProgressChange, onReadyForEntry, onSceneChange]);

  return (
    <>
      <color attach="background" args={["#040812"]} />
      <fog attach="fog" args={["#040812", 14, 72]} />

      <ambientLight intensity={0.28} color="#94a3b8" />
      <directionalLight
        position={[12, 18, 10]}
        intensity={0.9}
        color="#cbd5e1"
        castShadow={!lowQuality}
        shadow-mapSize-width={lowQuality ? 512 : 1024}
        shadow-mapSize-height={lowQuality ? 512 : 1024}
      />
      <directionalLight
        position={[-10, 6, -8]}
        intensity={0.55}
        color="#38bdf8"
      />

      <CityEnvironment lowQuality={lowQuality} />
      <GPSRouteAnimation
        gpsStrengthRef={gpsStrengthRef}
        lowQuality={lowQuality}
      />
      <BusModel
        busGroupRef={busGroupRef}
        speedRef={speedRef}
        headlightRef={headlightRef}
        lowQuality={lowQuality}
      />
    </>
  );
}

export function BusScene(props: BusSceneProps) {
  return (
    <Canvas
      dpr={props.lowQuality ? 1 : [1, 2]}
      shadows={!props.lowQuality}
      camera={{ position: [0, 2.3, 16], fov: 45, near: 0.1, far: 140 }}
      gl={{
        antialias: !props.lowQuality,
        powerPreference: "high-performance",
      }}
      className="h-full w-full"
    >
      <SceneChoreography {...props} />
    </Canvas>
  );
}
