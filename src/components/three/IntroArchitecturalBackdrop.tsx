'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

/**
 * Generates a soft cosine-feathered alpha texture so raking daylight shafts
 * diffuse naturally across plaster without hard rectangular polygon edges.
 */
function createSunbeamTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;

  for (let y = 0; y < size; y++) {
    const ny = y / (size - 1);
    // Asymmetric vertical fade: warm entrance at top soffit, soft mist fade above floor plane
    const verticalFalloff = Math.pow(Math.sin(ny * Math.PI), 1.7) * (0.45 + 0.55 * ny);
    for (let x = 0; x < size; x++) {
      const nx = x / (size - 1);
      const horizontalFalloff = Math.pow(Math.sin(nx * Math.PI), 2.4);
      const alpha = Math.round(255 * verticalFalloff * horizontalFalloff);
      const idx = (y * size + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = alpha;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
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

class WebGLErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(): void {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
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
  const secondaryBeamRef = useRef<THREE.Mesh>(null);
  const bronzeRevealRef = useRef<THREE.Mesh>(null);
  const plinthRef = useRef<THREE.Mesh>(null);

  const plasterBump = useMemo(() => createPlasterTexture(), []);
  const sunbeamAlpha = useMemo(() => createSunbeamTexture(), []);

  useEffect(() => {
    return () => {
      plasterBump?.dispose();
      sunbeamAlpha?.dispose();
    };
  }, [plasterBump, sunbeamAlpha]);

  // Calibrated contrast so both Ivory Plaster & Dark Graphite Gallery reveal depth & form
  const palette = useMemo(
    () =>
      isDark
        ? {
            bg: '#161715',
            wall: '#3F403A',
            recess: '#2F302B',
            shadowLine: '#141512',
            floor: '#272823',
            plinth: '#4C4941',
            bronze: '#D6BE96',
            sun: '#FFE6C2',
            beamOpacity: 0.15,
          }
        : {
            bg: '#EAE4D8',
            wall: '#EFEAE0',
            recess: '#DFD8CA',
            shadowLine: '#D3CBBD',
            floor: '#E5DFD2',
            plinth: '#D6CEC0',
            bronze: '#8E6D48',
            sun: '#FFF5E4',
            beamOpacity: 0.16,
          },
    [isDark]
  );

  useFrame((state, delta) => {
    const act = reducedMotion ? 2.0 : actProgressRef.current;
    const t = reducedMotion ? 0 : state.clock.getElapsedTime();
    const dt = Math.min(delta, 0.05);
    const damp = reducedMotion ? 1 : 1 - Math.exp(-5.4 * dt);

    const px = reducedMotion ? 0 : pointerRef.current.x;
    const py = reducedMotion ? 0 : pointerRef.current.y;

    let targetZ = 5.1;
    let targetX = 0;
    let targetY = 0.08;

    if (act < 1) {
      targetZ = THREE.MathUtils.lerp(6.45, 5.15, act);
      targetX = THREE.MathUtils.lerp(-0.22, 0.0, act);
      targetY = THREE.MathUtils.lerp(0.2, 0.06, act);
    } else if (act < 2) {
      const k = act - 1;
      targetZ = THREE.MathUtils.lerp(5.15, 4.45, k);
      targetX = THREE.MathUtils.lerp(0.0, 0.03, k);
      targetY = THREE.MathUtils.lerp(0.06, 0.02, k);
    } else if (act <= 2.45) {
      const k = Math.min(1, (act - 2) / 0.45);
      targetZ = THREE.MathUtils.lerp(4.45, 4.9, k);
      targetX = THREE.MathUtils.lerp(0.03, -0.3, k);
      targetY = THREE.MathUtils.lerp(0.02, 0.06, k);
    } else {
      const exitK = Math.min(1, (act - 2.45) / 0.55);
      targetZ = THREE.MathUtils.lerp(4.9, 3.0, exitK);
      targetX = THREE.MathUtils.lerp(-0.3, 0.0, exitK);
      targetY = THREE.MathUtils.lerp(0.06, 0.0, exitK);
    }

    const driftX = Math.sin(t * 0.24) * 0.04;
    const driftY = Math.cos(t * 0.19) * 0.025;

    const cam = state.camera;
    const nextCamX = THREE.MathUtils.lerp(
      cam.position.x,
      targetX + px * 0.2 + driftX,
      damp
    );
    const nextCamY = THREE.MathUtils.lerp(
      cam.position.y,
      targetY - py * 0.12 + driftY,
      damp
    );
    const nextCamZ = THREE.MathUtils.lerp(cam.position.z, targetZ, damp);
    cam.position.set(nextCamX, nextCamY, nextCamZ);
    cam.lookAt(px * 0.09, -py * 0.05, -1.6);

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
          ? THREE.MathUtils.lerp(2.1, 3.3, act)
          : 3.5
        : act < 1
          ? THREE.MathUtils.lerp(1.05, 2.15, act)
          : 2.55;
    }

    if (spotLightRef.current) {
      const act2Focus =
        act < 0.6 ? 0.25 : act < 1.25 ? (act - 0.6) / 0.65 : act < 2.2 ? 1 : 0.55;
      spotLightRef.current.intensity = (isDark ? 9.5 : 3.2) * act2Focus;
      spotLightRef.current.position.x =
        THREE.MathUtils.lerp(-1.2, 0.6, Math.min(1, act * 0.5)) + px * 0.35;
    }

    if (ambientLightRef.current) {
      const openFactor = Math.min(1, Math.max(0, (act - 0.2) / 1.8));
      ambientLightRef.current.intensity = isDark
        ? THREE.MathUtils.lerp(0.85, 1.35, openFactor)
        : THREE.MathUtils.lerp(0.6, 1.08, openFactor);
    }

    if (sunBeamRef.current) {
      const mat = sunBeamRef.current.material as THREE.MeshBasicMaterial;
      const beamVisibility =
        act < 1 ? THREE.MathUtils.lerp(0.45, 1.0, act) : act < 2.4 ? 0.94 : 0.55;
      mat.opacity = palette.beamOpacity * beamVisibility;
      sunBeamRef.current.position.x =
        THREE.MathUtils.lerp(-1.65, 0.65, Math.min(1, act * 0.65)) + px * 0.14;
    }

    if (secondaryBeamRef.current) {
      const mat = secondaryBeamRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = palette.beamOpacity * 0.55 * (act < 2.4 ? 1 : 0.5);
      secondaryBeamRef.current.position.x =
        THREE.MathUtils.lerp(-0.4, 1.75, Math.min(1, act * 0.55)) + px * 0.1;
    }

    if (bronzeRevealRef.current) {
      bronzeRevealRef.current.rotation.y = px * 0.02;
    }

    if (plinthRef.current) {
      plinthRef.current.position.y = THREE.MathUtils.lerp(
        -2.05,
        -1.58,
        Math.min(1, act * 0.78)
      );
    }

    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        px * 0.028,
        damp * 0.75
      );
    }
  });

  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <fog attach="fog" args={[palette.bg, isDark ? 6.2 : 5.2, isDark ? 18 : 16]} />

      <ambientLight
        ref={ambientLightRef}
        intensity={isDark ? 1.0 : 0.75}
        color={palette.sun}
      />

      <directionalLight
        ref={keyLightRef}
        position={[-2.2, 3.8, 3.6]}
        intensity={isDark ? 3.2 : 2.2}
        color={palette.sun}
      />

      <spotLight
        ref={spotLightRef}
        position={[0.2, 2.6, 3.8]}
        angle={0.55}
        penumbra={0.9}
        distance={22}
        decay={0.8}
        intensity={isDark ? 7.5 : 2.6}
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

        {/* Central monolithic gallery plaster panel */}
        <mesh position={[0, 0.3, -2.55]}>
          <boxGeometry args={[5.4, 3.7, 0.25]} />
          <meshStandardMaterial
            color={palette.recess}
            roughness={0.9}
            metalness={0.05}
            bumpMap={plasterBump}
            bumpScale={0.016}
          />
        </mesh>

        {/* 10mm Architectural shadow-line channels flanking central panel (flush from plinth to transom) */}
        <mesh position={[-2.74, 0.38, -2.42]}>
          <boxGeometry args={[0.04, 3.68, 0.06]} />
          <meshStandardMaterial color={palette.shadowLine} roughness={0.95} />
        </mesh>
        <mesh position={[2.74, 0.38, -2.42]}>
          <boxGeometry args={[0.04, 3.68, 0.06]} />
          <meshStandardMaterial color={palette.shadowLine} roughness={0.95} />
        </mesh>

        {/* Left & right vertical monolithic architectural pilasters */}
        <mesh position={[-3.35, 0.2, -1.9]}>
          <boxGeometry args={[1.15, 7.6, 0.9]} />
          <meshStandardMaterial
            color={palette.wall}
            roughness={0.85}
            metalness={0.04}
            bumpMap={plasterBump}
            bumpScale={0.016}
          />
        </mesh>

        <mesh position={[3.35, 0.2, -1.9]}>
          <boxGeometry args={[1.15, 7.6, 0.9]} />
          <meshStandardMaterial
            color={palette.wall}
            roughness={0.85}
            metalness={0.04}
            bumpMap={plasterBump}
            bumpScale={0.016}
          />
        </mesh>

        {/* Overhead architectural transom lintel & subtle ceiling reveal positioned clear of header text */}
        <mesh position={[0, 2.68, -1.7]}>
          <boxGeometry args={[8.5, 0.95, 1.1]} />
          <meshStandardMaterial
            color={palette.recess}
            roughness={0.86}
            metalness={0.06}
          />
        </mesh>
        <mesh position={[0, 2.2, -1.68]}>
          <boxGeometry args={[8.5, 0.03, 0.12]} />
          <meshStandardMaterial color={palette.shadowLine} roughness={0.95} />
        </mesh>

        {/* Delicate brushed bronze inlay running along the lower stone plinth */}
        <mesh ref={bronzeRevealRef} position={[0, -1.34, -2.02]}>
          <boxGeometry args={[4.6, 0.012, 0.03]} />
          <meshStandardMaterial
            color={palette.bronze}
            roughness={0.32}
            metalness={0.84}
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

        {/* Soft feathered diagonal raking sunlight shafts */}
        <mesh
          ref={sunBeamRef}
          position={[-0.6, 0.85, -1.35]}
          rotation={[0, 0, -0.44]}
        >
          <planeGeometry args={[2.5, 6.2]} />
          <meshBasicMaterial
            color={palette.sun}
            alphaMap={sunbeamAlpha}
            transparent
            opacity={palette.beamOpacity}
            depthWrite={false}
          />
        </mesh>

        <mesh
          ref={secondaryBeamRef}
          position={[1.1, 0.95, -1.55]}
          rotation={[0, 0, -0.44]}
        >
          <planeGeometry args={[1.5, 5.6]} />
          <meshBasicMaterial
            color={palette.sun}
            alphaMap={sunbeamAlpha}
            transparent
            opacity={palette.beamOpacity * 0.55}
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
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    setWebglSupported(canUseWebGL());
  }, []);

  const handleWebGLError = useCallback(() => {
    setWebglFailed(true);
  }, []);

  const showCanvas = webglSupported && !webglFailed && isActive;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
      data-webgl-active={showCanvas ? 'true' : 'false'}
    >
      {/* Layered architectural fallback & tonal depth under/without WebGL */}
      <div
        className="absolute inset-0 transition-colors duration-700"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse 78% 68% at 50% 42%, #292925 0%, #191A17 65%, #111210 100%)'
            : 'radial-gradient(ellipse 78% 68% at 50% 42%, #F6F2EA 0%, #EAE4D8 62%, #DDD5C6 100%)',
        }}
      />

      {/* Architectural CSS Raking Daylight & Pilaster Depth Fallback */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          background: isDark
            ? 'linear-gradient(118deg, rgba(255, 230, 194, 0.06) 8%, transparent 32%, rgba(255, 230, 194, 0.045) 48%, transparent 72%)'
            : 'linear-gradient(118deg, rgba(255, 250, 240, 0.55) 8%, rgba(234, 228, 216, 0) 34%, rgba(255, 248, 234, 0.38) 50%, rgba(190, 180, 162, 0.14) 84%)',
        }}
      />

      {/* Subtle architectural plinth shadow band for non-WebGL depth */}
      <div
        className="absolute right-0 bottom-0 left-0 h-[16%]"
        style={{
          background: isDark
            ? 'linear-gradient(to top, rgba(10,11,9,0.55), transparent)'
            : 'linear-gradient(to top, rgba(145,134,116,0.16), transparent)',
        }}
      />

      {showCanvas && (
        <WebGLErrorBoundary onError={handleWebGLError}>
          <Canvas
            dpr={[1, 1.25]}
            frameloop={reducedMotion ? 'demand' : 'always'}
            camera={{ position: [0, 0.14, 6.1], fov: 38, near: 0.1, far: 30 }}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: 'high-performance',
            }}
            onCreated={({ gl }) => {
              gl.domElement.addEventListener(
                'webglcontextlost',
                (event) => {
                  event.preventDefault();
                  setWebglFailed(true);
                },
                { once: true }
              );
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
        </WebGLErrorBoundary>
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
