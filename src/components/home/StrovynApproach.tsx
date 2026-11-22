'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArchitecturalTiltCard } from '@/components/ui/ArchitecturalTiltCard';

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

        {/* 4-Stage Horizontal Grid with Animated Connecting Line */}
        <div className="relative">
          {/* Animated Connecting Line Across Columns */}
          <div className="hidden lg:block absolute top-[52px] left-0 right-0 h-[1.5px] bg-white/15 z-0" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-8 relative z-10">
            {processStages.map((step, idx) => (
              <ArchitecturalTiltCard
                key={step.number}
                maxTilt={2.5}
                sheenOpacity={0.05}
                className="flex"
              >
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{
                    duration: 0.7,
                    ease: [0.16, 1, 0.3, 1],
                    delay: idx * 0.1,
                  }}
                  className="w-full bg-[#20211F] border border-white/15 p-6 sm:p-8 flex flex-col justify-between group hover:border-bronze/60 transition-all duration-300"
                >
                <div>
                  {/* Step Header with Node */}
                  <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
                    <span className="w-10 h-10 bg-[#161715] border border-bronze flex items-center justify-center font-mono text-xs font-semibold text-bronze">
                      {step.number}
                    </span>
                    <span className="font-mono text-[10px] text-white/50 tracking-widest uppercase">
                      STAGE {step.number}
                    </span>
                  </div>

                  {/* Stage Title */}
                  <h3 className="type-card-title text-2xl sm:text-3xl text-white mb-2 group-hover:text-bronze transition-colors">
                    {step.title}
                  </h3>

                  <h4 className="font-sans text-xs text-bronze uppercase tracking-wider font-medium mb-4">
                    {step.subtitle}
                  </h4>

                  <p className="font-sans text-xs sm:text-sm text-warm-grey-light font-light leading-relaxed mb-6">
                    {step.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/10 mt-auto">
                  <span className="font-mono text-[10px] text-white/60 uppercase tracking-widest block mb-1">
                    EXECUTION METRIC
                  </span>
                  <span className="font-mono text-xs text-white font-medium">
                    {step.action}
                  </span>
                </div>
              </motion.div>
              </ArchitecturalTiltCard>
            ))}
          </div>
        </div>

        {/* Collaboration Footnote Banner */}
        <div className="mt-12 p-6 bg-[#20211F] border border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <span className="font-sans text-xs uppercase tracking-[0.16em] text-bronze font-semibold block mb-1">
              ARCHITECT &amp; HEAD CONTRACTOR COLLABORATION
            </span>
            <p className="font-sans text-xs sm:text-sm text-warm-grey-light font-light leading-relaxed">
              We coordinate seamlessly with Adelaide designers, builders and estate managers—providing physical drawdown test panels, strict milestone governance, and dust containment protocols.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-4 text-xs font-mono text-white/60 uppercase tracking-wider">
            <span>ADELAIDE ARCHITECTURAL SPECIALISTS</span>
            <span className="text-bronze">|</span>
            <span>WRITTEN SCOPE SCHEDULES</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default StrovynApproach;
