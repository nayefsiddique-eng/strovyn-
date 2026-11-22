'use client';

import React, { useEffect, useRef } from 'react';
import {
  ensureGsapRegistered,
  gsap,
  isFinePointer,
  prefersReducedMotion,
} from '@/lib/motion/gsapConfig';
import { cn } from '@/lib/utils';

export interface ArchitecturalTiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  sheenOpacity?: number;
}

/**
 * ArchitecturalTiltCard — Lightweight CSS perspective + GSAP quickTo tilt container.
 * Automatically disables pointer tilt on touch devices and when prefers-reduced-motion is set.
 */
export const ArchitecturalTiltCard: React.FC<ArchitecturalTiltCardProps> = ({
  children,
  className = '',
  maxTilt = 4.5,
  sheenOpacity = 0.08,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const sheenRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ensureGsapRegistered();
    const el = cardRef.current;
    const sheen = sheenRef.current;
    if (!el) return;
    if (prefersReducedMotion() || !isFinePointer()) return;

    const rxTo = gsap.quickTo(el, 'rotateX', {
      duration: 0.45,
      ease: 'power3.out',
    });
    const ryTo = gsap.quickTo(el, 'rotateY', {
      duration: 0.45,
      ease: 'power3.out',
    });
    const scaleTo = gsap.quickTo(el, 'scale', {
      duration: 0.45,
      ease: 'power3.out',
    });

    gsap.set(el, { transformPerspective: 1100, transformStyle: 'preserve-3d' });

    const handleMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const nx = Math.max(-1, Math.min(1, (px - 0.5) * 2));
      const ny = Math.max(-1, Math.min(1, (py - 0.5) * 2));

      rxTo(-ny * maxTilt);
      ryTo(nx * maxTilt);
      scaleTo(1.01);

      if (sheen) {
        sheen.style.opacity = String(sheenOpacity);
        sheen.style.background = `radial-gradient(circle at ${(px * 100).toFixed(1)}% ${(py * 100).toFixed(1)}%, rgba(255,255,255,0.65), transparent 62%)`;
      }
    };

    const handleLeave = () => {
      rxTo(0);
      ryTo(0);
      scaleTo(1);
      if (sheen) {
        sheen.style.opacity = '0';
      }
    };

    el.addEventListener('pointermove', handleMove, { passive: true });
    el.addEventListener('pointerleave', handleLeave, { passive: true });

    return () => {
      el.removeEventListener('pointermove', handleMove);
      el.removeEventListener('pointerleave', handleLeave);
      gsap.set(el, { clearProps: 'transform,transformPerspective,transformStyle' });
    };
  }, [maxTilt, sheenOpacity]);

  return (
    <div
      ref={cardRef}
      className={cn('relative will-change-transform', className)}
    >
      {children}
      <div
        ref={sheenRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 opacity-0 transition-opacity duration-300"
      />
    </div>
  );
};

export default ArchitecturalTiltCard;
