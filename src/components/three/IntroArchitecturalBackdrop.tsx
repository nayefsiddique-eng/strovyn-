'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface IntroArchitecturalBackdropProps {
  isDark: boolean;
  isActive: boolean;
  pointerRef: React.MutableRefObject<{ x: number; y: number }>;
  actProgressRef: React.MutableRefObject<number>;
  reducedMotion: boolean;
}

function createPlasterTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;

  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < data.length; i += 4) {
    const px = (i / 4) % size;
    const py = Math.floor(i / 4 / size);
    const wave =
      Math.sin(px * 0.07 + py * 0.04) * 10 +
      Math.cos(px * 0.03 - py * 0.08) * 8;
    const grain = (rand() - 0.5) * 24;
    const v = Math.max(0, Math.min(255, 128 + wave + grain));
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  texture.needsUpdate = true;
  return texture;
}

function canUseWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

interface SceneContentProps {
  isDark: boolean;
  pointerRef: React.MutableRefObject<{ x: number; y: number }>;
  actProgressRef: React.MutableRefObject<number>;
  reducedMotion: boolean;
}

function ArchitecturalGalleryRoom({
  isDark,
  pointerRef,
  actProgressRef,
  reducedMotion,
}: SceneContentProps) {
  const groupRef = useRef<THREE.Group>(null);
  const keyLightRef = useRef<THREE.DirectionalLight>(null);
  const spotLightRef = useRef<THREE.SpotLight>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const sunBeamRef = useRef<THREE.Mesh>(null);
  const bronzeRevealRef = useRef<THREE.Mesh>(null);
  const plinthRef = useRef<THREE.Mesh>(null);

  const plasterBump = useMemo(() => createPlasterTexture(), []);

  useEffect(() => {
    return () => {
      plasterBump?.dispose();
    };
  }, [plasterBump]);

  // Calibrated contrast so both Ivory Plaster & Dark Graphite Gallery reveal depth & form
  const palette = useMemo(
    () =>
      isDark
        ? {
            bg: '#161715',
            wall: '#2B2C28',
            recess: '#1D1E1B',
            floor: '#1A1B18',
            plinth: '#35342F',
            bronze: '#C9B28F',
            sun: '#FFE6C2',
            beamOpacity: 0.14,
          }
        : {
            bg: '#E8E2D6',
            wall: '#ECE7DD',
            recess: '#DDD6C8',
            floor: '#E3DDD0',
            plinth: '#D4CCC0',
            bronze: '#9A7750',
            sun: '#FFF4E0',
            beamOpacity: 0.14,
          },
    [isDark]
  );

  useFrame((state) => {
    const act = reducedMotion ? 2.0 : actProgressRef.current;
    const t = reducedMotion ? 0 : state.clock.getElapsedTime();

    const px = reducedMotion ? 0 : pointerRef.current.x;
    const py = reducedMotion ? 0 : pointerRef.current.y;

    let targetZ = 5.0;
    let targetX = 0;
    let targetY = 0.08;

    if (act < 1) {
      targetZ = THREE.MathUtils.lerp(6.4, 5.1, act);
      targetX = THREE.MathUtils.lerp(-0.22, 0.0, act);
      targetY = THREE.MathUtils.lerp(0.24, 0.06, act);
    } else if (act < 2) {
      const k = act - 1;
      targetZ = THREE.MathUtils.lerp(5.1, 4.35, k);
      targetX = THREE.MathUtils.lerp(0.0, 0.04, k);
      targetY = THREE.MathUtils.lerp(0.06, 0.02, k);
    } else if (act <= 2.4) {
      const k = Math.min(1, (act - 2) / 0.4);
      targetZ = THREE.MathUtils.lerp(4.35, 4.85, k);
      targetX = THREE.MathUtils.lerp(0.04, -0.32, k);
      targetY = THREE.MathUtils.lerp(0.02, 0.08, k);
    } else {
      const exitK = Math.min(1, (act - 2.4) / 0.6);
      targetZ = THREE.MathUtils.lerp(4.85, 2.6, exitK);
      targetX = THREE.MathUtils.lerp(-0.32, 0.0, exitK);
      targetY = THREE.MathUtils.lerp(0.08, 0.0, exitK);
    }

    const driftX = Math.sin(t * 0.25) * 0.05;
    const driftY = Math.cos(t * 0.2) * 0.03;

    const cam = state.camera;
    const nextCamX = THREE.MathUtils.lerp(
      cam.position.x,
      targetX + px * 0.22 + driftX,
      0.08
    );
    const nextCamY = THREE.MathUtils.lerp(
      cam.position.y,
      targetY - py * 0.14 + driftY,
      0.08
    );
    const nextCamZ = THREE.MathUtils.lerp(cam.position.z, targetZ, 0.085);
    cam.position.set(nextCamX, nextCamY, nextCamZ);
    cam.lookAt(px * 0.1, -py * 0.06, -1.6);

    if (keyLightRef.current) {
      const sunSweepX =
        act < 1
          ? THREE.MathUtils.lerp(-4.0, -0.4, act)
          : act < 2
            ? THREE.MathUtils.lerp(-0.4, 1.8, act - 1)
            : 2.5 + Math.sin(t * 0.18) * 0.25;
      keyLightRef.current.position.x = sunSweepX + px * 0.45;
      keyLightRef.current.intensity = isDark
        ? act < 1
          ? THREE.MathUtils.lerp(1.4, 2.6, act)
          : 2.8
        : act < 1
          ? THREE.MathUtils.lerp(0.95, 2.1, act)
          : 2.55;
    }

    if (spotLightRef.current) {
      const act2Focus =
        act < 0.6 ? 0.2 : act < 1.25 ? (act - 0.6) / 0.65 : act < 2.2 ? 1 : 0.45;
      spotLightRef.current.intensity = (isDark ? 4.8 : 2.6) * act2Focus;
      spotLightRef.current.position.x =
        THREE.MathUtils.lerp(-1.2, 0.6, Math.min(1, act * 0.5)) + px * 0.35;
    }

    if (ambientLightRef.current) {
      const openFactor = Math.min(1, Math.max(0, (act - 0.2) / 1.8));
      ambientLightRef.current.intensity = isDark
        ? THREE.MathUtils.lerp(0.48, 0.92, openFactor)
        : THREE.MathUtils.lerp(0.55, 1.05, openFactor);
    }

    if (sunBeamRef.current) {
      const mat = sunBeamRef.current.material as THREE.MeshBasicMaterial;
      const beamVisibility =
        act < 1 ? THREE.MathUtils.lerp(0.45, 1.0, act) : act < 2.3 ? 0.92 : 0.6;
      mat.opacity = palette.beamOpacity * beamVisibility;
      sunBeamRef.current.position.x =
        THREE.MathUtils.lerp(-1.7, 0.65, Math.min(1, act * 0.65)) + px * 0.15;
    }

    if (bronzeRevealRef.current) {
      bronzeRevealRef.current.rotation.y = px * 0.025;
    }

    if (plinthRef.current) {
      plinthRef.current.position.y = THREE.MathUtils.lerp(
        -2.1,
        -1.58,
        Math.min(1, act * 0.75)
      );
    }

    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        px * 0.03,
        0.06
      );
    }
  });

  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <fog attach="fog" args={[palette.bg, 4.8, 15]} />

      <ambientLight
        ref={ambientLightRef}
        intensity={isDark ? 0.65 : 0.72}
        color={palette.sun}
      />

      <directionalLight
        ref={keyLightRef}
        position={[-2.2, 3.8, 3.6]}
        intensity={isDark ? 2.2 : 2.2}
        color={palette.sun}
      />

      <spotLight
        ref={spotLightRef}
        position={[0.2, 2.6, 3.8]}
        angle={0.48}
        penumbra={0.9}
        intensity={isDark ? 3.2 : 2.4}
        color={palette.sun}
      />

      <group ref={groupRef}>
        {/* Primary mineral Venetian-plaster back wall */}
        <mesh position={[0, 0, -2.8]}>
          <planeGeometry args={[18, 11]} />
          <meshStandardMaterial
            color={palette.wall}
            roughness={0.88}
            metalness={0.04}
            bumpMap={plasterBump}
            bumpScale={0.018}
          />
        </mesh>

        {/* Recessed architectural shadow alcove */}
        <mesh position={[0, 0.15, -2.55]}>
          <boxGeometry args={[5.4, 3.4, 0.25]} />
          <meshStandardMaterial
            color={palette.recess}
            roughness={0.9}
            metalness={0.05}
            bumpMap={plasterBump}
            bumpScale={0.015}
          />
        </mesh>

        {/* Left & right vertical monolithic architectural pilasters */}
        <mesh position={[-3.35, 0.2, -1.9]}>
          <boxGeometry args={[1.15, 7.2, 0.9]} />
          <meshStandardMaterial
            color={palette.wall}
            roughness={0.85}
            metalness={0.04}
            bumpMap={plasterBump}
            bumpScale={0.016}
          />
        </mesh>

        <mesh position={[3.35, 0.2, -1.9]}>
          <boxGeometry args={[1.15, 7.2, 0.9]} />
          <meshStandardMaterial
            color={palette.wall}
            roughness={0.85}
            metalness={0.04}
            bumpMap={plasterBump}
            bumpScale={0.016}
          />
        </mesh>

        {/* Overhead architectural transom lintel */}
        <mesh position={[0, 2.35, -1.7]}>
          <boxGeometry args={[8.5, 0.95, 1.1]} />
          <meshStandardMaterial
            color={palette.recess}
            roughness={0.86}
            metalness={0.06}
          />
        </mesh>

        {/* Delicate brushed bronze inlay running right along the lower stone plinth */}
        <mesh ref={bronzeRevealRef} position={[0, -1.34, -2.02]}>
          <boxGeometry args={[4.6, 0.01, 0.03]} />
          <meshStandardMaterial
            color={palette.bronze}
            roughness={0.35}
            metalness={0.82}
          />
        </mesh>

        {/* Sculptural architectural stone gallery plinth */}
        <mesh ref={plinthRef} position={[0, -1.58, -2.1]}>
          <boxGeometry args={[4.6, 0.42, 1.3]} />
          <meshStandardMaterial
            color={palette.plinth}
            roughness={0.78}
            metalness={0.08}
            bumpMap={plasterBump}
            bumpScale={0.012}
          />
        </mesh>

        {/* Ground plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.86, 0]}>
          <planeGeometry args={[20, 14]} />
          <meshStandardMaterial
            color={palette.floor}
            roughness={0.9}
            metalness={0.04}
          />
        </mesh>

        {/* Diagonal volumetric raking sunlight plane */}
        <mesh
          ref={sunBeamRef}
          position={[-0.6, 0.6, -1.35]}
          rotation={[0, 0, -0.46]}
        >
          <planeGeometry args={[2.1, 8.2]} />
          <meshBasicMaterial
            color={palette.sun}
            transparent
            opacity={palette.beamOpacity}
            depthWrite={false}
          />
        </mesh>
      </group>
    </>
  );
}

export function IntroArchitecturalBackdrop({
  isDark,
  isActive,
  pointerRef,
  actProgressRef,
  reducedMotion,
}: IntroArchitecturalBackdropProps) {
  const [webglSupported, setWebglSupported] = useState(false);

  useEffect(() => {
    setWebglSupported(canUseWebGL());
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Layered architectural fallback & tonal depth under/without WebGL */}
      <div
        className="absolute inset-0 transition-colors duration-700"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse 78% 68% at 50% 42%, #292925 0%, #191A17 65%, #111210 100%)'
            : 'radial-gradient(ellipse 78% 68% at 50% 42%, #F5F1E9 0%, #E7E0D3 64%, #DCD4C5 100%)',
        }}
      />

      {webglSupported && (
        <Canvas
          dpr={[1, 1.25]}
          frameloop={isActive ? 'always' : 'never'}
          camera={{ position: [0, 0.14, 6.0], fov: 38, near: 0.1, far: 30 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
          }}
          className="h-full w-full"
        >
          <ArchitecturalGalleryRoom
            isDark={isDark}
            pointerRef={pointerRef}
            actProgressRef={actProgressRef}
            reducedMotion={reducedMotion}
          />
        </Canvas>
      )}

      {/* Subtle architectural gallery vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? 'radial-gradient(circle at 50% 48%, transparent 36%, rgba(12,13,11,0.52) 100%)'
            : 'radial-gradient(circle at 50% 48%, transparent 40%, rgba(28,27,24,0.12) 100%)',
        }}
      />
    </div>
  );
}
