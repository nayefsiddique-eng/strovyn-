'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export const WallCanvasExperience: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollMax = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollMax > 0) {
        const progress = Math.min(1, Math.max(0, window.scrollY / scrollMax));
        setScrollProgress(progress);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 2. Lighting (Architectural Raking Light)
    const ambientLight = new THREE.AmbientLight(0xf4f1ea, 0.8);
    scene.add(ambientLight);

    const rakingLight = new THREE.DirectionalLight(0xa78b65, 2.2);
    rakingLight.position.set(5, 3, 4);
    scene.add(rakingLight);

    // 3. Wall Mesh (Substrate Layer)
    const wallGeo = new THREE.PlaneGeometry(3.6, 2.2, 32, 32);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xd6d4cf,
      roughness: 0.9,
      metalness: 0.05,
    });
    const wallMesh = new THREE.Mesh(wallGeo, wallMat);
    scene.add(wallMesh);

    // 4. Roller Mesh (Architectural Roller Cylinder)
    const rollerGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.4, 32);
    const rollerMat = new THREE.MeshStandardMaterial({
      color: 0xa78b65,
      roughness: 0.4,
      metalness: 0.2,
    });
    const rollerMesh = new THREE.Mesh(rollerGeo, rollerMat);
    rollerMesh.rotation.z = Math.PI / 2;
    rollerMesh.position.set(0, -1.2, 0.25);
    scene.add(rollerMesh);

    let animationId: number;

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      // Smooth roller progression controlled by scroll progress
      const targetY = -1.1 + scrollProgress * 2.2;
      rollerMesh.position.y += (targetY - rollerMesh.position.y) * 0.1;
      rollerMesh.rotation.x += 0.04;

      // Subtle planar wall hue transition from raw plaster (warm grey) to finished ivory
      const finishColor = new THREE.Color(0xd6d4cf).lerp(
        new THREE.Color(0xf4f1ea),
        scrollProgress
      );
      wallMat.color.copy(finishColor);
      wallMat.roughness = THREE.MathUtils.lerp(0.9, 0.35, scrollProgress);

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      wallGeo.dispose();
      wallMat.dispose();
      rollerGeo.dispose();
      rollerMat.dispose();
      renderer.dispose();
    };
  }, [scrollProgress]);

  return (
    <section className="relative w-full py-20 bg-charcoal text-white border-y border-charcoal-light overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-5 space-y-4">
          <span className="font-mono text-xs uppercase text-bronze tracking-widest block">
            [ INTERACTIVE 3D EXPERIENCE ]
          </span>
          <h2 className="type-section-title text-3xl sm:text-4xl">
            The Micro-Planar Transformation
          </h2>
          <p className="font-sans text-sm text-warm-grey leading-relaxed">
            As you navigate through our portfolio, the physical roller executes a progressive surface transformation. Watch the raw, friable plaster substrate convert into a velvety Level 5 architectural finish under calibrated raking illumination.
          </p>
          <div className="pt-2 font-mono text-xs text-bronze flex items-center gap-3">
            <span>Scroll Transform: {Math.round(scrollProgress * 100)}%</span>
            <span className="w-24 h-1 bg-charcoal-light inline-block relative">
              <span
                className="absolute top-0 left-0 h-full bg-bronze transition-all duration-150"
                style={{ width: `${scrollProgress * 100}%` }}
              />
            </span>
          </div>
        </div>

        <div className="lg:col-span-7 h-[360px] sm:h-[420px] bg-[#161715] border border-warm-grey/20 relative">
          <div ref={mountRef} className="w-full h-full" />
          <span className="absolute bottom-3 right-4 font-mono text-[10px] text-warm-grey-dark uppercase tracking-widest pointer-events-none">
            WebGL Three.js Active
          </span>
        </div>
      </div>
    </section>
  );
};
