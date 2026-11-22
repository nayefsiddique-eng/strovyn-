'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface BeforeAfterSliderProps {
  className?: string;
  initialPosition?: number;
}

interface PreparationStage {
  step: string;
  title: string;
  detail: string;
}

const educationalStages: PreparationStage[] = [
  {
    step: 'STAGE 01',
    title: 'Substrate Assessment & Repair',
    detail:
      'Identifying underlying substrate irregularities, securing junctions, and rectifying surface imperfections prior to any coating work.',
  },
  {
    step: 'STAGE 02',
    title: 'Planar Smoothing & Skimming',
    detail:
      'Applying uniform compound across wall and ceiling planes to equalize porosity and establish an even visual plane.',
  },
  {
    step: 'STAGE 03',
    title: 'Surface Refining & Light Inspection',
    detail:
      'Careful progressive abrasion combined with directional lighting checks to identify and resolve fine surface variations.',
  },
  {
    step: 'STAGE 04',
    title: 'Architectural Finish Application',
    detail:
      'Disciplined, multi-coat application formulated for consistent colour depth, uniform sheen, and enduring durability under ambient light.',
  },
];

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  className,
  initialPosition = 62,
}) => {
  const [splitPct, setSplitPct] = useState<number>(initialPosition);

  return (
    <section
      id="surface-transformation"
      aria-label="Architectural Craftsmanship and Surface Preparation"
      className={cn(
        'relative w-full bg-ivory text-charcoal border-b border-warm-grey/30 py-20 md:py-28 lg:py-36 overflow-hidden',
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col md:flex-row md:items-end justify-between border-b border-warm-grey/30 pb-6 mb-12 md:mb-16 gap-6"
        >
          <div>
            <span className="font-sans text-xs sm:text-sm uppercase tracking-[0.2em] text-bronze font-medium block mb-3">
              [ 04 / SURFACE PREPARATION &amp; CRAFTSMANSHIP ]
            </span>
            <h2 className="type-section-title text-3xl sm:text-4xl md:text-5xl text-charcoal max-w-2xl">
              The difference is in the invisible preparation.
            </h2>
          </div>

          <div className="max-w-md">
            <p className="font-sans text-xs sm:text-sm text-charcoal-muted leading-relaxed font-light">
              True architectural finishing is defined long before the final coat is applied.
              A refined finish requires methodical substrate correction, planar consistency,
              and thorough surface inspection.
            </p>
          </div>
        </motion.div>

        {/* Editorial Visual Composition */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="border border-warm-grey/40 bg-white mb-12 sm:mb-16 overflow-hidden shadow-none"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Interactive Surface & Space Comparison (8 Cols) */}
            <div className="lg:col-span-8 relative min-h-[380px] sm:min-h-[460px] lg:min-h-[520px] bg-charcoal overflow-hidden select-none">
              {/* Base Layer: Illustrative Surface Texture Study */}
              <Image
                src="/images/architectural-paint-swatch.jpg"
                alt="Illustrative Architectural Surface Texture Study"
                fill
                sizes="(max-width: 1024px) 100vw, 66vw"
                className="object-cover object-center"
              />

              {/* Clipped Top Layer: Verified Completed Adelaide Residence */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - splitPct}% 0 0)` }}
              >
                <Image
                  src="/images/projects/adelaide-luxury-residence/living-dining-2.jpg"
                  alt="Adelaide Residence · Architectural Residential Interior by Strovyn Painting Co."
                  fill
                  sizes="(max-width: 1024px) 100vw, 66vw"
                  className="object-cover object-center"
                  priority
                />
                <div className="absolute inset-0 bg-charcoal/10 pointer-events-none" />
              </div>

              {/* Vertical Comparison Divider & Handle */}
              <div
                aria-hidden="true"
                className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_12px_rgba(0,0,0,0.45)] pointer-events-none z-10"
                style={{ left: `${splitPct}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 bg-charcoal border-2 border-bronze text-white flex items-center justify-center font-mono text-[10px] shadow-lg">
                  &harr;
                </div>
              </div>

              {/* Accessible Range Input Overlay */}
              <input
                type="range"
                min={10}
                max={90}
                value={splitPct}
                onChange={(e) => setSplitPct(Number(e.target.value))}
                aria-label="Compare Completed Residence and Illustrative Surface Detail"
                className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
              />

              {/* Verified Project Badge */}
              <div className="absolute bottom-6 left-6 z-10 bg-white/95 border border-warm-grey/40 px-4 py-2 pointer-events-none">
                <span className="font-mono text-[10px] text-bronze uppercase tracking-widest font-semibold block mb-0.5">
                  COMPLETED WORK · ADELAIDE · DRAG TO COMPARE
                </span>
                <span className="type-card-title text-sm sm:text-base text-charcoal">
                  Adelaide Residence vs. Illustrative Surface Study
                </span>
              </div>
            </div>

            {/* Side Editorial Panel with Illustrative Texture Detail (4 Cols) */}
            <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-warm-grey/30 bg-[#FAF9F5] p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[10px] text-bronze uppercase tracking-widest font-semibold block mb-2">
                  FINISH STANDARDS
                </span>
                <h3 className="type-card-title text-xl sm:text-2xl text-charcoal mb-4">
                  Substrate Integrity Under Natural Light
                </h3>
                <p className="font-sans text-xs sm:text-sm text-charcoal-muted leading-relaxed font-light mb-6">
                  South Australian daylight exposes even minor deviations across broad wall and ceiling planes.
                  Meticulous substrate evening prevents telegraphing, uneven sheen, and visible lap marks.
                </p>
              </div>

              {/* Material Detail Inset (Explicitly Illustrative) */}
              <div className="border border-warm-grey/30 bg-white p-3">
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-charcoal mb-3">
                  <Image
                    src="/images/architectural-paint-swatch.jpg"
                    alt="Illustrative Architectural Paint Swatch and Surface Finish Study"
                    fill
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    className="object-cover object-center"
                  />
                </div>
                <div>
                  <span className="font-mono text-[10px] text-bronze uppercase tracking-widest font-semibold block">
                    ILLUSTRATIVE STUDY
                  </span>
                  <span className="font-sans text-xs text-charcoal-muted block font-light">
                    Material Detail · Surface Texture &amp; Sheen (Illustrative)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Educational 4-Stage Preparation Sequence */}
          <div className="border-t border-warm-grey/30 bg-white">
            <div className="px-6 py-4 border-b border-warm-grey/20 bg-warm-grey/5 flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-widest text-charcoal font-medium">
                Surface Preparation Principles
              </span>
              <span className="font-mono text-[11px] text-warm-grey-dark uppercase tracking-wider hidden sm:inline-block">
                Architectural Finishing Sequence
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-warm-grey/30">
              {educationalStages.map((item, index) => (
                <div key={index} className="p-6 sm:p-8 flex flex-col justify-between">
                  <div>
                    <span className="font-mono text-xs text-bronze uppercase tracking-widest font-semibold block mb-2">
                      {item.step}
                    </span>
                    <h4 className="type-card-title text-lg text-charcoal mb-2">
                      {item.title}
                    </h4>
                    <p className="font-sans text-xs text-charcoal-muted leading-relaxed font-light">
                      {item.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default BeforeAfterSlider;
