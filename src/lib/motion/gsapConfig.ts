'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

let registered = false;

export function ensureGsapRegistered(): void {
  if (typeof window !== 'undefined' && !registered) {
    gsap.registerPlugin(ScrollTrigger);
    registered = true;
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isFinePointer(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: fine)').matches;
}

/**
 * Attaches a restrained magnetic pull to an interactive CTA button on fine pointers.
 * Automatically disabled on touch devices and when prefers-reduced-motion is active.
 */
export function attachMagneticInteraction(
  element: HTMLElement | null,
  strength = 0.22
): () => void {
  if (!element || typeof window === 'undefined') return () => {};
  if (prefersReducedMotion() || !isFinePointer()) return () => {};

  const xTo = gsap.quickTo(element, 'x', { duration: 0.45, ease: 'power3.out' });
  const yTo = gsap.quickTo(element, 'y', { duration: 0.45, ease: 'power3.out' });

  const handleMove = (e: MouseEvent) => {
    const rect = element.getBoundingClientRect();
    const relX = e.clientX - (rect.left + rect.width / 2);
    const relY = e.clientY - (rect.top + rect.height / 2);
    xTo(relX * strength);
    yTo(relY * strength);
  };

  const handleLeave = () => {
    xTo(0);
    yTo(0);
  };

  element.addEventListener('mousemove', handleMove, { passive: true });
  element.addEventListener('mouseleave', handleLeave, { passive: true });

  return () => {
    element.removeEventListener('mousemove', handleMove);
    element.removeEventListener('mouseleave', handleLeave);
    gsap.set(element, { x: 0, y: 0 });
  };
}

export { gsap, ScrollTrigger };
