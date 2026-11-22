'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  Lightformer,
  OrbitControls,
} from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';

export interface ArchitecturalSurfaceStudioProps {
  colorHex: string;
  finishName: string;
  category: 'Architectural Mineral' | 'Warm Editorial' | 'Artisanal Limewash';
  sheenLabel: string;
  lightAngleDeg: number;
  lightTemp: 'daylight' | 'warm';
  resetTrigger: number;
}

function isWebGLSupported(): boolean {
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

function createSurfaceMicroBump(
  category: ArchitecturalSurfaceStudioProps['category']
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const img = ctx.createImageData(size, size);
  const data = img.data;
  let seed = category === 'Artisanal Limewash' ? 8191 : 4219;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const amplitude =
    category === 'Artisanal Limewash'
      ? 28
      : category === 'Warm Editorial'
        ? 14
        : 9;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const trowel =
        Math.sin((x / size) * Math.PI * 5 + Math.cos((y / size) * Math.PI * 3)) *
        amplitude;
      const grain = (rand() - 0.5) * amplitude * 1.15;
      const v = Math.max(0, Math.min(255, Math.round(128 + trowel + grain)));
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.needsUpdate = true;
  return tex;
}

interface StudioSceneProps {
  colorHex: string;
  category: ArchitecturalSurfaceStudioProps['category'];
  sheenLabel: string;
  lightAngleDeg: number;
  lightTemp: 'daylight' | 'warm';
  resetTrigger: number;
}

function parseRoughnessFromSheen(sheenLabel: string): number {
  const m = sheenLabel.match(/(\d+)%/);
  const pct = m ? Number(m[1]) : 5;
  // Map 1% dead flat -> 0.94 roughness, 20% satin -> 0.42 roughness
  return Math.max(0.32, Math.min(0.95, 0.96 - pct * 0.027));
}

const StudioScene: React.FC<StudioSceneProps & { isVisible: boolean }> = ({
  colorHex,
  category,
  sheenLabel,
  lightAngleDeg,
  lightTemp,
  resetTrigger,
  isVisible,
}) => {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { invalidate, camera, gl } = useThree();

  useEffect(() => {
    if (isVisible) invalidate();
  }, [isVisible, invalidate]);

  useEffect(() => {
    const dom = gl.domElement;
    const onLost = (e: Event) => e.preventDefault();
    const onRestored = () => invalidate();
    dom.addEventListener('webglcontextlost', onLost, false);
    dom.addEventListener('webglcontextrestored', onRestored, false);
    return () => {
      dom.removeEventListener('webglcontextlost', onLost);
      dom.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [gl, invalidate]);

  const bumpMap = useMemo(() => createSurfaceMicroBump(category), [category]);
  useEffect(() => {
    return () => {
      bumpMap?.dispose();
    };
  }, [bumpMap]);

  const roughness = parseRoughnessFromSheen(sheenLabel);
  const bumpScale =
    category === 'Artisanal Limewash'
      ? 0.024
      : category === 'Warm Editorial'
        ? 0.012
        : 0.007;

  // Compute directional raking light vector from grazing angle (10..75 deg)
  const rad = (lightAngleDeg * Math.PI) / 180;
  const lightX = Math.cos(rad) * 4.2;
  const lightY = 1.6 + Math.sin(rad) * 1.4;
  const lightZ = Math.sin(rad) * 3.8 + 0.45;
  const lightColor = lightTemp === 'daylight' ? '#F8FAFC' : '#FFD9A8';

  useEffect(() => {
    invalidate();
  }, [colorHex, category, sheenLabel, lightAngleDeg, lightTemp, invalidate]);

  useEffect(() => {
    if (resetTrigger === 0) return;
    camera.position.set(0.35, 0.15, 3.15);
    controlsRef.current?.target.set(0, 0, 0);
    controlsRef.current?.update();
    invalidate();
  }, [resetTrigger, camera, invalidate]);

  return (
    <>
      <ambientLight intensity={lightTemp === 'daylight' ? 0.45 : 0.35} color={lightColor} />
      <directionalLight
        position={[lightX, lightY, lightZ]}
        intensity={lightTemp === 'daylight' ? 2.1 : 1.85}
        color={lightColor}
      />

      <Environment resolution={128}>
        <Lightformer
          form="rect"
          intensity={1.6}
          color={lightColor}
          position={[lightX, lightY, lightZ]}
          scale={[4, 3, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={0.7}
          color="#F4F1EA"
          position={[-3, 2, 2]}
          scale={[5, 4, 1]}
          target={[0, 0, 0]}
        />
      </Environment>

      {/* Architectural Plaster/Paint Specimen Panel */}
      <group position={[0, 0.04, 0]}>
        <mesh>
          <boxGeometry args={[2.05, 1.38, 0.08]} />
          <meshPhysicalMaterial
            color={colorHex}
            roughness={roughness}
            metalness={0.02}
            clearcoat={roughness < 0.55 ? 0.16 : 0.04}
            clearcoatRoughness={roughness}
            sheen={0.25}
            sheenRoughness={roughness}
            sheenColor={colorHex}
            bumpMap={bumpMap ?? undefined}
            bumpScale={bumpScale}
          />
        </mesh>

        {/* Subtle Architectural Shadow-Line Reveal Backing */}
        <mesh position={[0, 0, -0.055]}>
          <boxGeometry args={[2.16, 1.48, 0.02]} />
          <meshStandardMaterial color="#20211F" roughness={0.75} metalness={0.15} />
        </mesh>
      </group>

      <ContactShadows
        position={[0, -0.82, 0]}
        opacity={0.38}
        scale={5.5}
        blur={2.2}
        far={2.5}
      />

      <OrbitControls
        ref={controlsRef}
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI * 0.32}
        maxPolarAngle={Math.PI * 0.62}
        minAzimuthAngle={-Math.PI * 0.28}
        maxAzimuthAngle={Math.PI * 0.28}
        onChange={() => invalidate()}
      />
    </>
  );
};

export const ArchitecturalSurfaceStudio: React.FC<
  ArchitecturalSurfaceStudioProps
> = (props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglOk, setWebglOk] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    setWebglOk(isWebGLSupported());
    if (typeof window !== 'undefined' && window.matchMedia) {
      setReducedMotion(
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      );
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: '120px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (!webglOk || reducedMotion) {
    return (
      <div
        ref={containerRef}
        className="relative w-full h-72 sm:h-80 border border-warm-grey/30 overflow-hidden flex items-end p-5 transition-colors duration-500"
        style={{
          background: `linear-gradient(${props.lightAngleDeg + 90}deg, ${props.colorHex} 0%, ${props.colorHex}DD 60%, #1F201D22 100%)`,
        }}
      >
        <div className="bg-white/95 border border-warm-grey/40 px-3 py-2 text-xs font-mono text-charcoal">
          {props.finishName} · {props.sheenLabel} (Illustrative Swatch)
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-72 sm:h-80 border border-warm-grey/30 bg-[#EAE6DD] overflow-hidden"
    >
      <Canvas
        frameloop={isVisible ? 'demand' : 'never'}
        dpr={[1, 1.75]}
        camera={{ position: [0.35, 0.15, 3.15], fov: 36 }}
        gl={{ antialias: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' }}
      >
        <StudioScene {...props} isVisible={isVisible} />
      </Canvas>
      <div className="pointer-events-none absolute top-3 left-3 bg-charcoal/85 text-white px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest">
        3D Surface Simulation · Drag to Inspect Angle
      </div>
    </div>
  );
};

export default ArchitecturalSurfaceStudio;
