'use client';

import React, { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface BeforeAfterSliderProps {
  className?: string;
  initialPosition?: number;
}

interface PreparationStep {
  step: string;
  title: string;
  detail: string;
}

const preparationSteps: PreparationStep[] = [
  {
    step: 'STAGE 01',
    title: 'Substrate & Joint Remediation',
    detail: 'Recessed screw heads, tape blisters, and expansion joints bedded with specialized setting compound.',
  },
  {
    step: 'STAGE 02',
    title: 'Full Level 5 Skim Coat',
    detail: 'Entire plasterboard plane skimmed uniformly to equalize surface porosity and prevent texture telegraphing.',
  },
  {
    step: 'STAGE 03',
    title: 'Dual-Axis Machine Sanding',
    detail: 'HEPA-extracted orbital sanding under 1000-lumen raking inspection lights to eliminate micro-ridges.',
  },
  {
    step: 'STAGE 04',
    title: 'High-Solid Pigment Application',
    detail: 'Micron-calibrated spray application of breathable mineral silicate with zero roller stipple or lap marks.',
  },
];

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  className,
  initialPosition = 50,
}) => {
  const [sliderPosition, setSliderPosition] = useState<number>(initialPosition);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle position calculation from client coordinates
  const updateSliderPosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const clampedPercentage = Math.min(100, Math.max(0, (offsetX / rect.width) * 100));
    setSliderPosition(Math.round(clampedPercentage));
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateSliderPosition(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateSliderPosition(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture release safety
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSliderPosition((prev) => Math.max(0, prev - 5));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSliderPosition((prev) => Math.min(100, prev + 5));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSliderPosition(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSliderPosition(100);
    }
  };

  return (
    <section
      id="surface-transformation"
      aria-label="Before and After Surface Comparison"
      className={cn(
        'relative w-full bg-ivory text-charcoal border-b border-warm-grey/30 py-20 md:py-28 lg:py-36',
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
          className="flex flex-col md:flex-row md:items-end justify-between border-b border-warm-grey/30 pb-6 mb-12 md:mb-16 gap-6"
        >
          <div>
            <span className="font-sans text-xs sm:text-sm uppercase tracking-[0.2em] text-bronze font-medium block mb-3">
              [ 04 / SURFACE TRANSFORMATION ]
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-charcoal tracking-tight max-w-2xl">
              The difference is in the invisible preparation.
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-xs font-mono text-warm-grey-dark">
            <span className="uppercase tracking-wider">
              DRAG DIVIDER OR USE ARROW KEYS TO INSPECT
            </span>
            <div className="flex items-center gap-1 border border-warm-grey/40 bg-white p-1">
              <button
                type="button"
                onClick={() => setSliderPosition(0)}
                className={cn(
                  'px-2 py-1 text-[11px] uppercase tracking-wider transition-colors',
                  sliderPosition === 0 ? 'bg-charcoal text-white font-medium' : 'hover:bg-warm-grey/10'
                )}
              >
                After Only
              </button>
              <button
                type="button"
                onClick={() => setSliderPosition(50)}
                className={cn(
                  'px-2 py-1 text-[11px] uppercase tracking-wider transition-colors',
                  sliderPosition === 50 ? 'bg-charcoal text-white font-medium' : 'hover:bg-warm-grey/10'
                )}
              >
                50/50 Split
              </button>
              <button
                type="button"
                onClick={() => setSliderPosition(100)}
                className={cn(
                  'px-2 py-1 text-[11px] uppercase tracking-wider transition-colors',
                  sliderPosition === 100 ? 'bg-charcoal text-white font-medium' : 'hover:bg-warm-grey/10'
                )}
              >
                Before Only
              </button>
            </div>
          </div>
        </motion.div>

        {/* Interactive Comparison Slider Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.99 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: [0.25, 1, 0.5, 1] }}
          className="relative w-full border border-warm-grey/40 bg-charcoal shadow-none select-none overflow-hidden"
        >
          {/* Main Slider Viewport */}
          <div
            ref={containerRef}
            role="slider"
            aria-valuenow={sliderPosition}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Substrate comparison slider. Drag horizontally or use arrow keys."
            tabIndex={0}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onKeyDown={handleKeyDown}
            className="relative w-full aspect-[16/9] md:aspect-[21/9] min-h-[380px] cursor-ew-resize touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
          >
            {/* Layer 1: AFTER - Finished Level 5 Coating (Full background) */}
            <div className="absolute inset-0 w-full h-full overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1800&q=80"
                alt="After: Flawless Level 5 architectural finish with mineral silicate coating"
                fill
                sizes="(max-width: 1280px) 100vw, 1280px"
                className="object-cover object-center pointer-events-none"
                priority
              />
              <div className="absolute inset-0 bg-charcoal/10 pointer-events-none" />

              {/* After Permanent Label */}
              <div className="absolute bottom-6 right-6 z-10 bg-white/95 border border-warm-grey/40 px-3 py-1.5 backdrop-blur-none pointer-events-none">
                <span className="font-mono text-[10px] text-bronze uppercase tracking-widest font-semibold block">
                  AFTER // STROVYN LEVEL 5 SPEC
                </span>
                <span className="font-serif text-sm text-charcoal font-medium">
                  Micro-Sanded Mineral Finish
                </span>
              </div>
            </div>

            {/* Layer 2: BEFORE - Raw Substrate & Compound (Clipped from left to right) */}
            <div
              className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
              style={{
                clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
              }}
            >
              <Image
                src="https://images.unsplash.com/photo-1581094288338-2314dddb7ece?auto=format&fit=crop&w=1800&q=80"
                alt="Before: Raw substrate, taped drywall joints and unprimed surface"
                fill
                sizes="(max-width: 1280px) 100vw, 1280px"
                className="object-cover object-center filter grayscale-[30%] contrast-[1.1] pointer-events-none"
                priority
              />
              <div className="absolute inset-0 bg-charcoal/20 pointer-events-none" />

              {/* Before Permanent Label */}
              <div className="absolute bottom-6 left-6 z-10 bg-charcoal/95 border border-warm-grey/40 px-3 py-1.5 pointer-events-none text-white">
                <span className="font-mono text-[10px] text-bronze uppercase tracking-widest font-semibold block">
                  BEFORE // RAW SUBSTRATE
                </span>
                <span className="font-serif text-sm text-white font-medium">
                  Unfinished Joint Compound &amp; Fasteners
                </span>
              </div>
            </div>

            {/* Vertical Split Line and Draggable Handle */}
            <div
              className="absolute top-0 bottom-0 z-30 pointer-events-none"
              style={{ left: `${sliderPosition}%` }}
            >
              {/* Thin architectural vertical border line */}
              <div className="w-[1.5px] h-full bg-white shadow-none -ml-[0.75px]" />

              {/* Drag Handle Node */}
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 sm:w-10 sm:h-10 bg-charcoal border border-bronze flex items-center justify-center text-white cursor-ew-resize">
                <svg
                  className="w-4 h-4 text-bronze"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  aria-hidden="true"
                >
                  <path d="M7 16l-4-4 4-4" />
                  <path d="M17 8l4 4-4 4" />
                </svg>
              </div>

              {/* Percentage Indicator Tag on hover/drag */}
              <div className="absolute -top-3 -translate-x-1/2 bg-charcoal border border-warm-grey/40 px-2 py-0.5 font-mono text-[10px] text-white whitespace-nowrap">
                {sliderPosition}%
              </div>
            </div>
          </div>

          {/* Under-Slider Technical Preparation Timeline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-warm-grey/30 border-t border-warm-grey/40 bg-white">
            {preparationSteps.map((item, index) => (
              <div key={index} className="p-5 sm:p-6 flex flex-col justify-between">
                <div>
                  <span className="font-mono text-[11px] text-bronze uppercase tracking-widest font-semibold block mb-1">
                    {item.step}
                  </span>
                  <h3 className="font-serif text-lg text-charcoal mb-2 font-normal">
                    {item.title}
                  </h3>
                  <p className="text-xs text-charcoal-muted leading-relaxed font-sans">
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default BeforeAfterSlider;
