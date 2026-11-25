"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

export interface BusModelProps {
  busGroupRef: React.RefObject<THREE.Group | null>;
  speedRef: React.MutableRefObject<number>;
  headlightRef: React.MutableRefObject<number>;
  lowQuality?: boolean;
}

const WHEEL_POSITIONS: Array<[number, number, number]> = [
  [-1.18, 0.52, 2.75],
  [1.18, 0.52, 2.75],
  [-1.18, 0.52, -2.55],
  [1.18, 0.52, -2.55],
];

const SIDE_WINDOW_Z = [-3.1, -1.75, -0.4, 0.95, 2.3];

export function BusModel({
  busGroupRef,
  speedRef,
  headlightRef,
  lowQuality = false,
}: BusModelProps) {
  const chassisRef = useRef<THREE.Group>(null);
  const wheelRefs = useRef<Array<THREE.Group | null>>([]);
  const leftSpotRef = useRef<THREE.SpotLight>(null);
  const rightSpotRef = useRef<THREE.SpotLight>(null);
  const leftConeRef = useRef<THREE.Mesh>(null);
  const rightConeRef = useRef<THREE.Mesh>(null);
  const leftBulbMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const rightBulbMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const spotTarget = useMemo(() => {
    const obj = new THREE.Object3D();
    obj.position.set(0, 0.2, 18);
    return obj;
  }, []);

  useFrame((state, delta) => {
    const speed = speedRef.current;
    const hl = headlightRef.current;

    // Rotate wheels proportionally to bus forward speed
    const wheelSpin = speed * delta * 2.4;
    for (let i = 0; i < wheelRefs.current.length; i++) {
      const w = wheelRefs.current[i];
      if (w) {
        w.rotation.x += wheelSpin;
      }
    }

    // Subtle suspension bounce and body roll while moving
    if (chassisRef.current) {
      const t = state.clock.elapsedTime;
      const moveFactor = Math.min(1, speed / 4);
      chassisRef.current.position.y =
        Math.sin(t * 7.5) * 0.018 * moveFactor + Math.sin(t * 2.1) * 0.005;
      chassisRef.current.rotation.z = Math.sin(t * 3.2) * 0.006 * moveFactor;
      chassisRef.current.rotation.x = -0.008 * moveFactor;
    }

    // Update headlight intensity & volumetric cones
    if (leftSpotRef.current) leftSpotRef.current.intensity = hl * 42;
    if (rightSpotRef.current) rightSpotRef.current.intensity = hl * 42;

    const coneOpacity = Math.max(0, Math.min(0.22, hl * 0.18));
    if (leftConeRef.current) {
      (leftConeRef.current.material as THREE.MeshBasicMaterial).opacity =
        coneOpacity;
    }
    if (rightConeRef.current) {
      (rightConeRef.current.material as THREE.MeshBasicMaterial).opacity =
        coneOpacity;
    }
    if (leftBulbMatRef.current) {
      leftBulbMatRef.current.emissiveIntensity = 0.4 + hl * 4.5;
    }
    if (rightBulbMatRef.current) {
      rightBulbMatRef.current.emissiveIntensity = 0.4 + hl * 4.5;
    }
  });

  return (
    <group ref={busGroupRef} position={[0, 0, -48]}>
      {/* SpotLight target attached ahead of the bus */}
      <primitive object={spotTarget} />

      {/* Main animated chassis */}
      <group ref={chassisRef}>
        {/* Lower Prussian Blue Chassis Body */}
        <mesh position={[0, 1.38, 0]} castShadow={!lowQuality} receiveShadow>
          <boxGeometry args={[2.52, 1.45, 9.2]} />
          <meshStandardMaterial
            color="#003153"
            metalness={0.55}
            roughness={0.28}
          />
        </mesh>

        {/* Lobster Red Signature City Transit Stripe */}
        <mesh position={[0, 1.32, 0.02]}>
          <boxGeometry args={[2.56, 0.24, 9.22]} />
          <meshStandardMaterial
            color="#d64527"
            metalness={0.4}
            roughness={0.3}
          />
        </mesh>

        {/* Upper Ricotta Cream / Pearl Trim */}
        <mesh position={[0, 2.52, 0]} castShadow={!lowQuality}>
          <boxGeometry args={[2.48, 0.92, 9.05]} />
          <meshStandardMaterial
            color="#f4efe6"
            metalness={0.25}
            roughness={0.35}
          />
        </mesh>

        {/* Dark Tinted Window Band (Left & Right) */}
        <mesh position={[0, 2.38, -0.25]}>
          <boxGeometry args={[2.51, 0.88, 7.9]} />
          <meshStandardMaterial
            color="#08111a"
            metalness={0.9}
            roughness={0.12}
          />
        </mesh>

        {/* Individual Window Pillar Dividers */}
        {SIDE_WINDOW_Z.map((zPos) => (
          <mesh key={zPos} position={[0, 2.38, zPos]}>
            <boxGeometry args={[2.53, 0.9, 0.1]} />
            <meshStandardMaterial
              color="#0b1f33"
              metalness={0.5}
              roughness={0.4}
            />
          </mesh>
        ))}

        {/* Sloped Front Windshield */}
        <mesh position={[0, 2.28, 4.54]} rotation={[-0.1, 0, 0]}>
          <boxGeometry args={[2.32, 1.18, 0.14]} />
          <meshStandardMaterial
            color="#091521"
            metalness={0.92}
            roughness={0.08}
          />
        </mesh>

        {/* Front Lower Fascia & Bumper */}
        <mesh position={[0, 0.72, 4.58]}>
          <boxGeometry args={[2.46, 0.42, 0.22]} />
          <meshStandardMaterial
            color="#0a1624"
            metalness={0.5}
            roughness={0.45}
          />
        </mesh>

        {/* Front Chrome/Blue Grille Accent */}
        <mesh position={[0, 1.18, 4.61]}>
          <boxGeometry args={[1.55, 0.26, 0.06]} />
          <meshStandardMaterial
            color="#10253a"
            metalness={0.75}
            roughness={0.22}
          />
        </mesh>

        {/* Glowing LED Destination Display Board */}
        <mesh position={[0, 2.98, 4.53]}>
          <boxGeometry args={[1.65, 0.24, 0.08]} />
          <meshStandardMaterial
            color="#051320"
            emissive="#38bdf8"
            emissiveIntensity={2.2}
            roughness={0.2}
          />
        </mesh>

        {/* Roof AC Pod & Aerodynamic Cowling */}
        <mesh position={[0, 3.12, -0.4]} castShadow={!lowQuality}>
          <boxGeometry args={[1.75, 0.28, 4.6]} />
          <meshStandardMaterial
            color="#e5dfd3"
            metalness={0.3}
            roughness={0.4}
          />
        </mesh>

        {/* Side Mirrors */}
        {([-1, 1] as const).map((side) => (
          <group key={side} position={[side * 1.42, 2.25, 4.38]}>
            <mesh position={[-side * 0.12, 0.08, -0.06]}>
              <boxGeometry args={[0.26, 0.06, 0.06]} />
              <meshStandardMaterial color="#111827" roughness={0.5} />
            </mesh>
            <mesh>
              <boxGeometry args={[0.12, 0.38, 0.16]} />
              <meshStandardMaterial
                color="#d64527"
                metalness={0.45}
                roughness={0.3}
              />
            </mesh>
          </group>
        ))}

        {/* Headlight Lenses & Volumetric Cones */}
        <mesh position={[-0.92, 0.92, 4.62]}>
          <boxGeometry args={[0.38, 0.18, 0.08]} />
          <meshStandardMaterial
            ref={leftBulbMatRef}
            color="#fff7ed"
            emissive="#bae6fd"
            emissiveIntensity={0.4}
          />
        </mesh>
        <mesh position={[0.92, 0.92, 4.62]}>
          <boxGeometry args={[0.38, 0.18, 0.08]} />
          <meshStandardMaterial
            ref={rightBulbMatRef}
            color="#fff7ed"
            emissive="#bae6fd"
            emissiveIntensity={0.4}
          />
        </mesh>

        {/* Volumetric Headlight Beams */}
        <mesh
          ref={leftConeRef}
          position={[-0.92, 0.68, 9.4]}
          rotation={[Math.PI / 2 + 0.05, 0, 0]}
        >
          <coneGeometry args={[1.55, 9.5, 24, 1, true]} />
          <meshBasicMaterial
            color="#bae6fd"
            transparent
            opacity={0}
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh
          ref={rightConeRef}
          position={[0.92, 0.68, 9.4]}
          rotation={[Math.PI / 2 + 0.05, 0, 0]}
        >
          <coneGeometry args={[1.55, 9.5, 24, 1, true]} />
          <meshBasicMaterial
            color="#bae6fd"
            transparent
            opacity={0}
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* Real Three.js SpotLights */}
        <spotLight
          ref={leftSpotRef}
          position={[-0.92, 0.95, 4.7]}
          target={spotTarget}
          angle={0.42}
          penumbra={0.65}
          distance={32}
          color="#e0f2fe"
          intensity={0}
        />
        <spotLight
          ref={rightSpotRef}
          position={[0.92, 0.95, 4.7]}
          target={spotTarget}
          angle={0.42}
          penumbra={0.65}
          distance={32}
          color="#e0f2fe"
          intensity={0}
        />

        {/* Rear Tail Lights */}
        <mesh position={[-0.95, 0.95, -4.62]}>
          <boxGeometry args={[0.36, 0.18, 0.06]} />
          <meshStandardMaterial
            color="#dc2626"
            emissive="#ef4444"
            emissiveIntensity={2.0}
          />
        </mesh>
        <mesh position={[0.95, 0.95, -4.62]}>
          <boxGeometry args={[0.36, 0.18, 0.06]} />
          <meshStandardMaterial
            color="#dc2626"
            emissive="#ef4444"
            emissiveIntensity={2.0}
          />
        </mesh>
      </group>

      {/* 4 Rotating 3D Wheels */}
      {WHEEL_POSITIONS.map((pos, idx) => (
        <group
          key={idx}
          ref={(el) => {
            wheelRefs.current[idx] = el;
          }}
          position={pos}
        >
          {/* Rubber Tire */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow={!lowQuality}>
            <cylinderGeometry args={[0.52, 0.52, 0.34, lowQuality ? 16 : 28]} />
            <meshStandardMaterial color="#111318" roughness={0.85} />
          </mesh>
          {/* Silver Alloy Rim */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.31, 0.31, 0.36, lowQuality ? 12 : 20]} />
            <meshStandardMaterial
              color="#cbd5e1"
              metalness={0.85}
              roughness={0.22}
            />
          </mesh>
          {/* Center Hubcap */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.12, 0.12, 0.38, 12]} />
            <meshStandardMaterial
              color="#003153"
              metalness={0.7}
              roughness={0.3}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
