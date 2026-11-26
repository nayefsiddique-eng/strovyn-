'use client';

import React from 'react';
import { motion } from 'framer-motion';

export interface ProcessStep {
  number: string;
  title: string;
  subtitle: string;
  description: string;
  action: string;
}

export const processStages: ProcessStep[] = [
  {
    number: '01',
    title: 'Understand',
    subtitle: 'Diagnostic Consultation & Light Analysis',
    description:
      'We inspect on-site substrate integrity, laser moisture equilibrium, and evaluate natural raking light angles across architectural planes before formulating coating specifications.',
    action: 'Plan Review & On-Site Moisture Audit',
  },
  {
    number: '02',
    title: 'Prepare',
    subtitle: 'Zero-Deflection Substrate Engineering',
    description:
      'The vast majority of finish quality is won in preparation. We execute multi-pass skim coating, structural joint tape bedding, and dual-axis HEPA machine sanding under 1000-lumen inspection lights.',
    action: 'Precision Substrate Micro-Skim & Sand',
  },
  {
    number: '03',
    title: 'Apply',
    subtitle: 'High-Solid Formulation & Spray Conversion',
    description:
      'Calibrated spray and hand-cut applications using premium mineral silicates, artisanal Venetian slaked limes, or 2K polyurethanes with zero lap marks and surgical edge precision.',
    action: 'Micron-Calibrated Architectural Coating',
  },
  {
    number: '04',
    title: 'Refine',
    subtitle: 'Raking Light Inspection & Archival Sign-Off',
    description:
      'Final surfaces are audited against intense raking light transitions. Zero orange-peel, zero texture telegraphing, and complete touch-up archives handed to architects and estate owners.',
    action: 'Daylight Audit & Archive Handover',
  },
];

export interface StrovynApproachProps {
  className?: string;
}

export const StrovynApproach: React.FC<StrovynApproachProps> = ({ className = '' }) => {
  return (
    <section
      id="approach"
      aria-label="The Strovyn Approach"
      className={`relative w-full bg-[#181917] text-white py-24 md:py-36 border-b border-warm-grey/30 overflow-hidden ${className}`}
    >
      {/* Subtle Drafting Grid */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, #FFFFFF 1px, transparent 1px),
            linear-gradient(to bottom, #FFFFFF 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col md:flex-row md:items-end justify-between border-b border-white/20 pb-6 mb-16 gap-6"
        >
          <div>
            <span className="font-sans text-xs sm:text-sm uppercase tracking-[0.2em] text-bronze font-medium block mb-3">
              [ 04 / METHODOLOGY &amp; DISCIPLINE ]
            </span>
            <h2 className="type-section-title text-3xl sm:text-5xl md:text-6xl text-white max-w-2xl">
              The Strovyn Approach.
            </h2>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs text-white/60 uppercase tracking-widest">
            <span className="w-2 h-2 bg-brand-red inline-block" />
            <span>4-STAGE ARCHITECTURAL PROTOCOL</span>
          </div>
        </motion.div>

        {/* 4-Stage Architectural Specification Ledger (MotionSites-inspired editorial cadence) */}
        <div className="border-t border-white/15">
          {processStages.map((step, idx) => (
            <motion.article
              key={step.number}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{
                duration: 0.55,
                ease: [0.16, 1, 0.3, 1],
                delay: idx * 0.06,
              }}
              className="group relative grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 py-8 sm:py-10 border-b border-white/15 transition-colors duration-300 hover:bg-white/[0.02] px-2 sm:px-4"
            >
              {/* Left architectural index & stage title */}
              <div className="lg:col-span-4 flex items-baseline gap-5">
                <span className="font-mono text-xs tracking-[0.22em] text-bronze font-semibold shrink-0">
                  {step.number}
                </span>
                <div>
                  <h3 className="type-card-title text-2xl sm:text-3xl text-white group-hover:text-bronze transition-colors duration-300">
                    {step.title}
                  </h3>
                  <p className="font-sans text-xs text-bronze/90 uppercase tracking-[0.14em] font-medium mt-1">
                    {step.subtitle}
                  </p>
                </div>
              </div>

              {/* Center discipline narrative */}
              <div className="lg:col-span-5 flex items-center">
                <p className="font-sans text-sm text-warm-grey-light font-light leading-relaxed">
                  {step.description}
                </p>
              </div>

              {/* Right execution datum */}
              <div className="lg:col-span-3 flex flex-col justify-center lg:items-end lg:text-right border-t lg:border-t-0 border-white/10 pt-4 lg:pt-0">
                <span className="font-mono text-[10px] text-white/50 uppercase tracking-[0.2em] block mb-1">
                  Execution Datum
                </span>
                <span className="font-mono text-xs text-white/95 font-medium">
                  {step.action}
                </span>
              </div>

              {/* Subtle bottom bronze hairline reveal on hover */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 left-0 h-px w-0 bg-bronze transition-all duration-500 ease-out group-hover:w-full"
              />
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StrovynApproach;
