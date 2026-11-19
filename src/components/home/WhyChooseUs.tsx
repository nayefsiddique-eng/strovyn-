'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface WhyChooseUsProps {
  className?: string;
}

interface MethodologyPillar {
  number: string;
  code: string;
  title: string;
  subtitle: string;
  description: string;
  parameters: string[];
}

const pillars: MethodologyPillar[] = [
  {
    number: '01',
    code: 'PROTOCOL // DIAGNOSTICS',
    title: 'Substrate-First Discipline',
    subtitle: 'Pre-Coating Diagnostics & Planar Integrity',
    description:
      'Over 70% of finish longevity is determined prior to topcoat application. We conduct rigorous pre-work moisture audits, structural crack bridging, and micro-depth skim passes to eliminate substrate deflection.',
    parameters: [
      'Moisture equilibrium < 12% WME',
      'Planar deflection < 2mm across 2m straightedge',
      'Non-invasive digital alkalinity (pH) testing',
    ],
  },
  {
    number: '02',
    code: 'PROTOCOL // CHEMISTRY',
    title: 'Precision Material Chemistry',
    subtitle: 'Mineral Silicates & Catalyzed Finishes',
    description:
      'We curate professional-grade formulations tailored to substrate dynamics: natural potassium silicates that chemically bind to masonry, pure Italian slaked lime washes, and high-solid 2K polyurethane lacquers for millwork.',
    parameters: [
      'Low & Zero-VOC environmental formulations',
      'Vapor-permeable crystalline mineral matrix',
      'Spectrophotometric on-site batch calibration',
    ],
  },
  {
    number: '03',
    code: 'PROTOCOL // ENVIRONMENT',
    title: 'Architectural Site Governance',
    subtitle: 'HEPA Containment & Climate Protocols',
    description:
      'Our teams operate with surgical cleanliness. Active areas are protected through heavy-duty ram board floor shielding, zippered containment barriers, and continuous HEPA dust extraction to preserve air quality.',
    parameters: [
      '99.97% HEPA dust-extraction during all sanding',
      'Monitored ambient humidity & curing temperatures',
      'Daily photographic progress documentation',
    ],
  },
  {
    number: '04',
    code: 'PROTOCOL // AUDITING',
    title: 'Level 5 Quality Assurance',
    subtitle: 'Raking Light Inspection & Handover',
    description:
      'Before project handover, every surface undergoes systematic high-intensity raking light inspection. Zero orange-peel, zero lap marks, and knife-sharp line transitions are non-negotiable requirements.',
    parameters: [
      'AS/NZS 2311 Level 5 surface audit',
      'Archive touch-up kit & formula codes provided',
      'Formal architectural sign-off documentation',
    ],
  },
];

export const WhyChooseUs: React.FC<WhyChooseUsProps> = ({ className }) => {
  return (
    <section
      id="methodology"
      aria-label="Why Choose Strovyn Painting Co."
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
              [ 05 / METHODOLOGY &amp; ASSURANCE ]
            </span>
            <h2 className="type-section-title text-3xl sm:text-4xl md:text-5xl text-charcoal max-w-2xl">
              Disciplined execution at every stage of the commission.
            </h2>
          </div>

          <div className="text-right">
            <span className="inline-block font-mono text-[10px] sm:text-[11px] text-charcoal bg-white border border-warm-grey/40 px-3 py-1.5 uppercase tracking-widest font-medium">
              [STANDARD ARCHITECTURAL PROTOCOL]
            </span>
          </div>
        </motion.div>

        {/* 4-Pillar Architectural Matrix Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-t border-l border-warm-grey/30">
          {pillars.map((pillar, index) => (
            <motion.div
              key={pillar.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{
                duration: 0.6,
                ease: [0.25, 1, 0.5, 1],
                delay: 0.1 + index * 0.1,
              }}
              className="border-b border-r border-warm-grey/30 bg-white/40 p-6 sm:p-8 flex flex-col justify-between hover:bg-white transition-colors duration-200"
            >
              <div>
                <div className="flex items-center justify-between border-b border-warm-grey/30 pb-3 mb-6">
                  <span className="font-mono text-sm text-bronze font-semibold">
                    {pillar.number}
                  </span>
                  <span className="font-mono text-[9px] text-warm-grey-dark uppercase tracking-widest">
                    {pillar.code}
                  </span>
                </div>

                <h3 className="type-card-title text-2xl text-charcoal mb-1">
                  {pillar.title}
                </h3>
                <h4 className="font-sans text-xs text-bronze uppercase tracking-wider font-medium mb-4">
                  {pillar.subtitle}
                </h4>

                <p className="text-xs sm:text-sm text-charcoal-muted font-sans leading-relaxed mb-6">
                  {pillar.description}
                </p>
              </div>

              {/* Concrete Parameters List */}
              <div className="border-t border-warm-grey/20 pt-4 space-y-2 mt-auto">
                <span className="block font-mono text-[10px] text-charcoal uppercase tracking-widest font-semibold">
                  Key Verification Metrics:
                </span>
                <ul className="space-y-1.5">
                  {pillar.parameters.map((param, i) => (
                    <li
                      key={i}
                      className="text-[11px] text-charcoal-muted font-sans flex items-start gap-1.5 leading-snug"
                    >
                      <span className="text-bronze font-mono shrink-0">―</span>
                      <span>{param}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Professional Commitment Banner */}
        <div className="mt-12 p-6 sm:p-8 bg-white border border-warm-grey/40 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <span className="font-sans text-xs uppercase tracking-[0.16em] text-bronze font-semibold block mb-1">
              Architect &amp; Builder Collaboration
            </span>
            <p className="text-sm text-charcoal font-sans leading-relaxed">
              We coordinate seamlessly with head contractors, interior designers, and architects—attending site meetings, adhering to construction schedules, and executing trade handovers without delay.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-4 text-xs font-mono text-warm-grey-dark uppercase tracking-wider">
            <span>ADELAIDE ARCHITECTURAL SPECIALISTS</span>
            <span className="text-bronze">|</span>
            <span>WRITTEN SCOPE SCHEDULES</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;
