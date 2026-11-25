"use client";

import { useMemo } from "react";

export interface CityEnvironmentProps {
  lowQuality?: boolean;
}

interface BuildingSpec {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: string;
  accent: string;
}

const STREETLIGHT_Z = [-46, -32, -18, -4, 10];
const LANE_MARK_Z = [-48, -41, -34, -27, -20, -13, -6, 1, 8, 15];

export function CityEnvironment({ lowQuality = false }: CityEnvironmentProps) {
  const buildings = useMemo<BuildingSpec[]>(() => {
    const items: BuildingSpec[] = [];
    const palette = ["#003153", "#0a3d62", "#1c4b6e", "#00223b"];
    const accents = ["#faf6ef", "#d64527", "#f2eadc", "#e05336"];

    for (let i = 0; i < 8; i++) {
      const z = -48 + i * 9;
      items.push({
        x: -11.5 - (i % 2) * 1.8,
        z,
        w: 5.5 + (i % 3) * 1.1,
        h: 9 + ((i * 5) % 11),
        d: 6.5,
        color: palette[i % palette.length],
        accent: accents[i % accents.length],
      });
      items.push({
        x: 11.8 + ((i + 1) % 2) * 1.8,
        z: z + 2,
        w: 5.8 + ((i + 1) % 3) * 0.9,
        h: 10 + ((i * 7) % 12),
        d: 6.5,
        color: palette[(i + 1) % palette.length],
        accent: accents[(i + 2) % accents.length],
      });
    }
    return items;
  }, []);

  return (
    <group>
      {/* Asphalt Road */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, -16]}
        receiveShadow
      >
        <planeGeometry args={[10.5, 90]} />
        <meshStandardMaterial
          color="#0a243a"
          roughness={0.68}
          metalness={0.18}
        />
      </mesh>

      {/* Sidewalks (Left & Right) */}
      <mesh position={[-6.8, 0.12, -16]} receiveShadow>
        <boxGeometry args={[3.2, 0.24, 90]} />
        <meshStandardMaterial color="#e9dfd0" roughness={0.85} />
      </mesh>
      <mesh position={[6.8, 0.12, -16]} receiveShadow>
        <boxGeometry args={[3.2, 0.24, 90]} />
        <meshStandardMaterial color="#e9dfd0" roughness={0.85} />
      </mesh>

      {/* Road Edge Lines */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4.5, 0.015, -16]}>
        <planeGeometry args={[0.14, 90]} />
        <meshStandardMaterial color="#faf6ef" roughness={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[4.5, 0.015, -16]}>
        <planeGeometry args={[0.14, 90]} />
        <meshStandardMaterial color="#faf6ef" roughness={0.5} />
      </mesh>

      {/* Dashed Center Lane Markings */}
      {LANE_MARK_Z.map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, z]}>
          <planeGeometry args={[0.18, 3.2]} />
          <meshStandardMaterial
            color="#d64527"
            emissive="#d64527"
            emissiveIntensity={0.25}
          />
        </mesh>
      ))}

      {/* Modern Indian Bus Stop Shelter (Right Sidewalk) */}
      <group position={[5.6, 0.24, 2]}>
        {/* Back Panel */}
        <mesh position={[0.9, 1.35, 0]}>
          <boxGeometry args={[0.12, 2.7, 4.4]} />
          <meshStandardMaterial
            color="#003153"
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
        {/* Illuminated Route Map Sign */}
        <mesh position={[0.82, 1.5, 0]}>
          <boxGeometry args={[0.06, 1.3, 2.2]} />
          <meshStandardMaterial
            color="#071a2f"
            emissive="#38bdf8"
            emissiveIntensity={1.6}
          />
        </mesh>
        {/* Cantilever Roof */}
        <mesh position={[0, 2.72, 0]}>
          <boxGeometry args={[2.1, 0.12, 4.8]} />
          <meshStandardMaterial
            color="#1e293b"
            metalness={0.7}
            roughness={0.25}
          />
        </mesh>
        {/* Lobster Red Shelter Accent Trim */}
        <mesh position={[-1.02, 2.72, 0]}>
          <boxGeometry args={[0.08, 0.14, 4.82]} />
          <meshStandardMaterial
            color="#d64527"
            emissive="#d64527"
            emissiveIntensity={0.6}
          />
        </mesh>
        {/* Bench */}
        <mesh position={[0.45, 0.52, 0]}>
          <boxGeometry args={[0.55, 0.1, 2.6]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.7} />
        </mesh>
      </group>

      {/* Traffic Signal Gantry */}
      <group position={[5.1, 0.24, -10]}>
        <mesh position={[0, 2.6, 0]}>
          <cylinderGeometry args={[0.1, 0.12, 5.2, 10]} />
          <meshStandardMaterial color="#1e293b" metalness={0.7} />
        </mesh>
        <mesh position={[-1.4, 5.0, 0]}>
          <boxGeometry args={[3.0, 0.14, 0.14]} />
          <meshStandardMaterial color="#1e293b" metalness={0.7} />
        </mesh>
        <mesh position={[-2.2, 4.65, 0]}>
          <boxGeometry args={[0.36, 0.9, 0.28]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh position={[-2.2, 4.42, 0.15]}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial
            color="#22c55e"
            emissive="#22c55e"
            emissiveIntensity={3.2}
          />
        </mesh>
      </group>

      {/* Streetlights */}
      {STREETLIGHT_Z.map((z, idx) => (
        <group key={z}>
          {([-1, 1] as const).map((side) => (
            <group key={side} position={[side * 5.6, 0.24, z]}>
              <mesh position={[0, 3.0, 0]}>
                <cylinderGeometry args={[0.07, 0.1, 6.0, 8]} />
                <meshStandardMaterial color="#1e293b" metalness={0.6} />
              </mesh>
              <mesh position={[-side * 0.65, 5.9, 0]}>
                <boxGeometry args={[1.4, 0.08, 0.1]} />
                <meshStandardMaterial color="#1e293b" metalness={0.6} />
              </mesh>
              <mesh position={[-side * 1.2, 5.82, 0]}>
                <boxGeometry args={[0.35, 0.1, 0.2]} />
                <meshStandardMaterial
                  color="#fef3c7"
                  emissive="#fbbf24"
                  emissiveIntensity={3.5}
                />
              </mesh>
              {!lowQuality && idx % 2 === 0 && side === 1 && (
                <pointLight
                  position={[-1.2, 5.4, 0]}
                  color="#fde68a"
                  intensity={6}
                  distance={16}
                  decay={2}
                />
              )}
            </group>
          ))}
        </group>
      ))}

      {/* Urban Buildings with Lit Window Strips */}
      {buildings.map((b, i) => (
        <group key={i} position={[b.x, b.h / 2, b.z]}>
          <mesh>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial
              color={b.color}
              roughness={0.8}
              metalness={0.2}
            />
          </mesh>
          {/* Glowing Window Floors */}
          {[0.2, 0, -0.22].map((yNorm, row) => (
            <mesh
              key={row}
              position={[b.x > 0 ? -b.w / 2 - 0.02 : b.w / 2 + 0.02, b.h * yNorm, 0]}
            >
              <boxGeometry args={[0.05, 0.35, b.d * 0.68]} />
              <meshStandardMaterial
                color={b.accent}
                emissive={b.accent}
                emissiveIntensity={1.1}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
