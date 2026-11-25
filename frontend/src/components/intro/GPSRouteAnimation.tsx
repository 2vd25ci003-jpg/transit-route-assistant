"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

export interface GPSRouteAnimationProps {
  gpsStrengthRef: React.MutableRefObject<number>;
  lowQuality?: boolean;
}

const MARKER_Z = [-30, -16, -2, 8];

export function GPSRouteAnimation({
  gpsStrengthRef,
  lowQuality = false,
}: GPSRouteAnimationProps) {
  const tubeMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const markerRefs = useRef<Array<THREE.Mesh | null>>([]);

  const { tubeGeo, curve, particleGeo } = useMemo(() => {
    const pts = [
      new THREE.Vector3(-1.4, 0.08, -44),
      new THREE.Vector3(-0.6, 0.08, -28),
      new THREE.Vector3(0.4, 0.08, -12),
      new THREE.Vector3(0.0, 0.08, 2),
      new THREE.Vector3(-0.3, 0.08, 12),
    ];
    const c = new THREE.CatmullRomCurve3(pts);
    const tGeo = new THREE.TubeGeometry(c, lowQuality ? 32 : 64, 0.09, 8, false);

    const count = lowQuality ? 28 : 64;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const p = c.getPoint(i / count);
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y + 0.15;
      positions[i * 3 + 2] = p.z;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    return { tubeGeo: tGeo, curve: c, particleGeo: pGeo };
  }, [lowQuality]);

  useFrame((state) => {
    const strength = gpsStrengthRef.current;
    const t = state.clock.elapsedTime;

    if (tubeMatRef.current) {
      tubeMatRef.current.opacity = strength * 0.92;
      tubeMatRef.current.emissiveIntensity = strength * 2.8;
    }

    if (particlesRef.current) {
      const attr = particlesRef.current.geometry.getAttribute(
        "position"
      ) as THREE.BufferAttribute;
      const count = attr.count;
      for (let i = 0; i < count; i++) {
        const u = ((i / count) + t * 0.22) % 1;
        const p = curve.getPoint(u);
        attr.setXYZ(i, p.x, p.y + 0.18, p.z);
      }
      attr.needsUpdate = true;
      (particlesRef.current.material as THREE.PointsMaterial).opacity =
        strength * 0.95;
    }

    for (let i = 0; i < markerRefs.current.length; i++) {
      const m = markerRefs.current[i];
      if (!m) continue;
      const pulse = 1 + Math.sin(t * 4 + i) * 0.18;
      m.scale.set(pulse * strength, pulse * strength, pulse * strength);
      (m.material as THREE.MeshStandardMaterial).opacity = strength * 0.9;
    }
  });

  return (
    <group>
      {/* Glowing Lobster Red / Prussian Blue GPS Path */}
      <mesh geometry={tubeGeo}>
        <meshStandardMaterial
          ref={tubeMatRef}
          color="#d64527"
          emissive="#d64527"
          emissiveIntensity={0}
          transparent
          opacity={0}
        />
      </mesh>

      {/* Streaming Navigation Particles */}
      <points ref={particlesRef} geometry={particleGeo}>
        <pointsMaterial
          color="#faf6ef"
          size={0.28}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Pulsing GPS Waypoint Rings */}
      {MARKER_Z.map((z, idx) => (
        <mesh
          key={z}
          ref={(el) => {
            markerRefs.current[idx] = el;
          }}
          position={[idx % 2 === 0 ? -0.35 : 0.25, 0.12, z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.38, 0.58, 24]} />
          <meshStandardMaterial
            color="#d64527"
            emissive="#e05336"
            emissiveIntensity={2.2}
            transparent
            opacity={0}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
