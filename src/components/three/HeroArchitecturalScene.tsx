'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

export interface HeroFinishPreset {
  id: string;
  name: string;
  hex: string;
  darkHex: string;
  sheenLabel: string;
  roughness: number;
}

export const HERO_FINISH_PRESETS: HeroFinishPreset[] = [
  {
    id: 'warm-ivory',
    name: 'Warm Ivory Mineral',
    hex: '#F4F1EA',
    darkHex: '#DDD7CB',
    sheenLabel: 'Deep Velvet Matte (3%)',
    roughness: 0.84,
  },
  {
    id: 'raw-limestone',
    name: 'Raw Limestone Chalk',
    hex: '#E6E1D6',
    darkHex: '#CFC9BC',
    sheenLabel: 'Dead Flat Mineral (1%)',
    roughness: 0.92,
  },
  {
    id: 'muted-bronze',
    name: 'Muted Bronze Ochre',
    hex: '#A78B65',
    darkHex: '#9C805B',
    sheenLabel: 'Low-Sheen Eggshell (8%)',
    roughness: 0.52,
  },
  {
    id: 'hills-slate',
    name: 'Adelaide Hills Slate',
    hex: '#7A7D79',
    darkHex: '#6E716D',
    sheenLabel: 'Velvet Low-Sheen (6%)',
    roughness: 0.64,
  },
];

function checkWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

/**
 * Generates a subtle procedural mineral-plaster micro-relief texture in memory.
 */
function createPlasterMicroTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const img = ctx.createImageData(size, size);
  const data = img.data;
  let seed = 4219;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const wave =
        Math.sin((x / size) * Math.PI * 6 + Math.cos((y / size) * Math.PI * 4)) * 12;
      const grain = (rand() - 0.5) * 20;
      const v = Math.max(0, Math.min(255, Math.round(128 + wave + grain)));
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  texture.needsUpdate = true;
  return texture;
}

interface AlcoveMeshProps {
  activePreset: HeroFinishPreset;
  isDark: boolean;
  pointerRef: React.MutableRefObject<{ x: number; y: number }>;
  reducedMotion: boolean;
}

const ArchitecturalAlcove: React.FC<AlcoveMeshProps> = ({
  activePreset,
  isDark,
  pointerRef,
  reducedMotion,
}) => {
  const wallMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const returnMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const rakingLightRef = useRef<THREE.DirectionalLight>(null);
  const warmFillRef = useRef<THREE.PointLight>(null);
  const groupRef = useRef<THREE.Group>(null);

  const plasterTexture = useMemo(() => createPlasterMicroTexture(), []);

  useEffect(() => {
    return () => {
      plasterTexture?.dispose();
    };
  }, [plasterTexture]);

  // Keep the selected architectural wall finish clearly illuminated in both Light & Dark themes
  const targetColor = useMemo(
    () => new THREE.Color(isDark ? activePreset.darkHex : activePreset.hex),
    [activePreset, isDark]
  );

  const returnColor = useMemo(
    () => new THREE.Color(isDark ? '#2B2C29' : '#DFD9CE'),
    [isDark]
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const px = reducedMotion ? 0 : pointerRef.current.x;
    const py = reducedMotion ? 0 : pointerRef.current.y;

    if (wallMatRef.current) {
      wallMatRef.current.color.lerp(targetColor, dt * 6);
      wallMatRef.current.roughness = THREE.MathUtils.lerp(
        wallMatRef.current.roughness,
        activePreset.roughness,
        dt * 6
      );
    }

    if (returnMatRef.current) {
      returnMatRef.current.color.lerp(returnColor, dt * 5);
    }

    if (rakingLightRef.current) {
      const idleSweep = reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.5) * 0.6;
      const targetLightX = 2.8 + px * 2.5 + idleSweep;
      const targetLightY = 2.0 + py * 1.3;
      rakingLightRef.current.position.x = THREE.MathUtils.lerp(
        rakingLightRef.current.position.x,
        targetLightX,
        dt * 4
      );
      rakingLightRef.current.position.y = THREE.MathUtils.lerp(
        rakingLightRef.current.position.y,
        targetLightY,
        dt * 4
      );
    }

    if (warmFillRef.current) {
      warmFillRef.current.position.x = THREE.MathUtils.lerp(
        warmFillRef.current.position.x,
        -2.0 + px * 1.2,
        dt * 3
      );
    }

    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        px * 0.065,
        dt * 4
      );
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        -py * 0.04,
        dt * 4
      );
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.04, 0]}>
      {/* Gallery ambient illumination */}
      <ambientLight intensity={isDark ? 0.78 : 0.96} color="#FAF8F5" />

      {/* Calibrated Raking Daylight (Grazing angle across plaster plane) */}
      <directionalLight
        ref={rakingLightRef}
        position={[3.0, 2.1, 2.4]}
        intensity={isDark ? 2.2 : 2.0}
        color="#FFF8EB"
      />

      {/* Warm Architectural Bronze Counter-Fill */}
      <pointLight
        ref={warmFillRef}
        position={[-2.0, -0.6, 2.0]}
        intensity={1.15}
        distance={9}
        color="#C9B28F"
      />

      {/* Primary Level 5 Architectural Plaster Wall Plane */}
      <mesh position={[0.18, 0.05, -0.38]} receiveShadow>
        <planeGeometry args={[5.8, 3.8, 32, 32]} />
        <meshStandardMaterial
          ref={wallMatRef}
          color={isDark ? activePreset.darkHex : activePreset.hex}
          roughness={activePreset.roughness}
          metalness={0.04}
          bumpMap={plasterTexture || undefined}
          bumpScale={0.018}
        />
      </mesh>

      {/* Top 10mm Shadow-Line Ceiling Reveal Channel */}
      <mesh position={[0.18, 1.38, -0.33]}>
        <boxGeometry args={[5.8, 0.055, 0.1]} />
        <meshStandardMaterial color="#161715" roughness={0.92} />
      </mesh>

      {/* Ceiling Soffit Overhang */}
      <mesh position={[0, 1.58, -0.14]}>
        <boxGeometry args={[6.2, 0.34, 0.5]} />
        <meshStandardMaterial
          ref={returnMatRef}
          color={isDark ? '#2B2C29' : '#DFD9CE'}
          roughness={0.86}
          metalness={0.02}
        />
      </mesh>

      {/* Left Architectural Return Wall & Fluted Pilaster Relief */}
      <mesh position={[-1.95, -0.02, -0.05]} rotation={[0, 0.28, 0]}>
        <boxGeometry args={[0.92, 3.1, 0.52]} />
        <meshStandardMaterial
          color={isDark ? '#262724' : '#E2DDD2'}
          roughness={0.74}
          metalness={0.05}
          bumpMap={plasterTexture || undefined}
          bumpScale={0.012}
        />
      </mesh>

      {/* Architectural Fluted Vertical Ribs Catching Grazing Light */}
      {[-0.65, -0.25, 0.15, 0.55].map((yPos, idx) => (
        <mesh key={idx} position={[-1.38, yPos, -0.22]}>
          <boxGeometry args={[0.06, 0.28, 0.14]} />
          <meshStandardMaterial
            color={isDark ? '#8C7352' : '#B8A282'}
            roughness={0.38}
            metalness={0.18}
          />
        </mesh>
      ))}

      {/* Precision Satin Architectural Datum Ledge / Plinth (20% Satin Sheen Contrast) */}
      <mesh position={[0.25, -0.96, -0.15]}>
        <boxGeometry args={[4.4, 0.11, 0.38]} />
        <meshStandardMaterial
          color={isDark ? '#6E5A3F' : '#C9B28F'}
          roughness={0.26}
          metalness={0.16}
        />
      </mesh>

      {/* Subtle Bronze Hairline Inlay Strip */}
      <mesh position={[0.25, -0.89, 0.045]}>
        <boxGeometry args={[4.4, 0.018, 0.02]} />
        <meshStandardMaterial color="#7E6340" roughness={0.2} metalness={0.48} />
      </mesh>

      <ContactShadows
        position={[0, -1.32, 0]}
        opacity={0.32}
        scale={6.5}
        blur={2.2}
        far={2.4}
      />
    </group>
  );
};

export interface HeroArchitecturalSceneProps {
  activePreset: HeroFinishPreset;
  isDark: boolean;
  pointerRef: React.MutableRefObject<{ x: number; y: number }>;
  reducedMotion: boolean;
  className?: string;
}

export const HeroArchitecturalScene: React.FC<HeroArchitecturalSceneProps> = ({
  activePreset,
  isDark,
  pointerRef,
  reducedMotion,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webGLSupported, setWebGLSupported] = useState<boolean>(false);
  const [isInView, setIsInView] = useState<boolean>(true);

  useEffect(() => {
    setWebGLSupported(checkWebGLAvailable());
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const wallDisplayColor = isDark ? activePreset.darkHex : activePreset.hex;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`relative w-full h-full overflow-hidden pointer-events-none select-none ${className}`}
      style={{
        backgroundColor: wallDisplayColor,
        transition: 'background-color 450ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Architectural Room Perspective & Diagonal Raking-Daylight Underlay (Always Visible & Guarantees Instant Visual Realism) */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Diagonal Raking Sunlight Beams across the Plaster Wall */}
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{
            background: `
              linear-gradient(125deg,
                rgba(255, 252, 245, 0.42) 0%,
                rgba(255, 252, 245, 0.06) 28%,
                rgba(24, 25, 23, 0.14) 44%,
                rgba(255, 252, 245, 0.34) 58%,
                rgba(24, 25, 23, 0.22) 86%,
                rgba(20, 21, 19, 0.36) 100%)
            `,
          }}
        />

        {/* Top 10mm Shadow-Line Ceiling Reveal */}
        <div className="absolute top-[15%] left-0 right-0 h-[3px] bg-[#181917]/65 shadow-xs" />
        <div className="absolute top-0 left-0 right-0 h-[15%] bg-black/12 border-b border-white/20" />

        {/* Left Architectural Return Wall Pilaster & Shadow Corner */}
        <div
          className="absolute top-[15%] bottom-[22%] left-0 w-[22%] border-r border-black/15"
          style={{
            background:
              'linear-gradient(90deg, rgba(20,21,19,0.28) 0%, rgba(20,21,19,0.08) 100%)',
          }}
        />

        {/* Architectural Satin Datum Ledge & Plinth Base */}
        <div
          className="absolute bottom-[20%] left-[14%] right-[8%] h-[7px] border-t border-white/45 shadow-md"
          style={{ backgroundColor: '#A78B65' }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-[20%] bg-black/18 border-t border-black/20" />
      </div>

      {/* Live Interactive WebGL R3F Layer */}
      {webGLSupported && (
        <div className="absolute inset-0">
          <Canvas
            dpr={[1, 1.5]}
            camera={{ position: [0, 0, 3.6], fov: 38 }}
            frameloop={isInView && !reducedMotion ? 'always' : 'demand'}
            gl={{
              antialias: true,
              alpha: true,
              preserveDrawingBuffer: true,
              powerPreference: 'high-performance',
            }}
          >
            <ArchitecturalAlcove
              activePreset={activePreset}
              isDark={isDark}
              pointerRef={pointerRef}
              reducedMotion={reducedMotion}
            />
          </Canvas>
        </div>
      )}
    </div>
  );
};

export default HeroArchitecturalScene;
