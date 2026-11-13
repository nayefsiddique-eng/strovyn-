'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface CompanyIntroProps {
  /** Optional custom class name for the section */
  className?: string;
}

interface StandardPillar {
  number: string;
  title: string;
  specification: string;
  description: string;
}

const standardPillars: StandardPillar[] = [
  {
    number: '01',
    title: 'Substrate Diagnostics',
    specification: 'Laser Moisture & Planar Tolerances',
    description:
      'Rigorous pre-coating diagnostic testing. Substrates are tested for moisture equilibrium (<12% WME), alkalinity, and structural integrity before any pigment touches the surface.',
  },
  {
    number: '02',
    title: 'Level 5 Surface Finish',
    specification: 'AS/NZS 2311 & ASTM Calibrated',
    description:
      'Seamless multi-stage skim coating and dust-controlled machine-sand finish designed specifically to withstand harsh raking sunlight across expansive walls and ceilings.',
  },
  {
    number: '03',
    title: 'Mineral & Silicate Formulations',
    specification: 'Zero-VOC & Micro-Crystalline Bond',
    description:
      'We curate pure potassium silicates, artisanal slaked limes, and catalyzed 2K polyurethanes that fuse chemically with architectural envelopes rather than sitting as a synthetic skin.',
  },
  {
    number: '04',
    title: 'Architectural Light Response',
    specification: 'Spectrophotometric Calibration',
    description:
      'Pigments and gloss levels are calibrated on-site against natural northern and southern diurnal light transitions to preserve depth throughout changing hours.',
  },
];

export const CompanyIntro: React.FC<CompanyIntroProps> = ({ className }) => {
  return (
    <section
      id="about-intro"
      aria-label="Craftsmanship & Standards"
      className={cn(
        'relative w-full bg-ivory text-charcoal border-b border-warm-grey/30 py-20 md:py-28 lg:py-36 overflow-hidden',
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        {/* Section Index & Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
          className="flex items-center justify-between border-b border-warm-grey/30 pb-4 mb-12 md:mb-16"
        >
          <span className="font-sans text-xs sm:text-sm uppercase tracking-[0.2em] text-bronze font-medium">
            [ 01 / CRAFTSMANSHIP &amp; STANDARDS ]
          </span>
          <span className="font-mono text-[11px] text-warm-grey-dark uppercase tracking-widest hidden sm:inline-block">
            ARCHITECTURAL SPECIFICATION // LEVEL 5 FINISHES
          </span>
        </motion.div>

        {/* Editorial Headline */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl mb-14 md:mb-20"
        >
          <h2 className="font-serif text-3xl sm:text-5xl md:text-6xl text-charcoal tracking-tight leading-[1.12] mb-6">
            Surface perfection achieved through architectural precision.
          </h2>
          <p className="font-sans text-lg sm:text-xl text-charcoal-muted leading-relaxed font-light">
            At Strovyn Painting Co., we treat architectural coatings not as cosmetic coverage, but as the critical tactile skin of a built environment. Our work begins where construction tolerances end.
          </p>
        </motion.div>

        {/* Visual Storytelling Showcase: Architectural Reveal Image + Protocol Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* Left Column: Atmospheric Architectural Visual with Parallax / Scale reveal */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 flex flex-col gap-6"
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-charcoal border border-warm-grey/40 group">
              <Image
                src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85"
                alt="Architectural interior illuminated by raking daylight across Level 5 surface"
                fill
                sizes="(max-width: 1024px) 100vw, 42vw"
                className="object-cover object-center filter contrast-[1.04] transition-transform duration-1000 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              
              <div className="absolute bottom-6 left-6 right-6 text-white font-mono text-xs flex items-center justify-between">
                <span className="uppercase tracking-widest text-[11px] font-semibold">
                  RAKING LIGHT TOLERANCE
                </span>
                <span className="border border-white/30 px-2 py-0.5 text-[10px] bg-black/40">
                  AS/NZS 2311
                </span>
              </div>
            </div>

            <div className="border-l-2 border-bronze pl-4 py-1 italic font-serif text-charcoal/80 text-sm sm:text-base">
              &ldquo;A finish should never draw attention to its application—only to the pure geometry of light and space it honors.&rdquo;
            </div>

            <div className="pt-2">
              <Button
                variant="outline"
                size="md"
                href="/about"
                rightIcon={
                  <svg
                    className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 8H13M13 8L8.5 3.5M13 8L8.5 12.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="square"
                      strokeLinejoin="miter"
                    />
                  </svg>
                }
              >
                Learn More About Our Standards
              </Button>
            </div>
          </motion.div>

          {/* Right Column: Architectural Protocol Matrix */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="mb-6 flex items-baseline justify-between border-b border-warm-grey/30 pb-3">
              <h3 className="font-sans text-xs uppercase tracking-[0.16em] text-charcoal font-semibold">
                Execution Protocols &amp; Tolerances
              </h3>
              <span className="font-mono text-[10px] text-warm-grey-dark tracking-wider">
                [INDEX // 01-04]
              </span>
            </div>

            <div className="divide-y divide-warm-grey/30 border-y border-warm-grey/30 bg-white">
              {standardPillars.map((pillar, idx) => (
                <motion.article
                  key={pillar.number}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{
                    duration: 0.55,
                    ease: [0.16, 1, 0.3, 1],
                    delay: idx * 0.08,
                  }}
                  className="p-6 sm:p-7 group hover:bg-[#FAF8F5] transition-colors duration-200"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <span className="font-mono text-xs text-bronze font-semibold">
                      {pillar.number}
                    </span>
                    <span className="font-mono text-[11px] text-warm-grey-dark uppercase tracking-wider text-right">
                      {pillar.specification}
                    </span>
                  </div>

                  <h4 className="font-serif text-xl sm:text-2xl text-charcoal mb-2 font-normal group-hover:text-bronze transition-colors duration-200">
                    {pillar.title}
                  </h4>

                  <p className="text-sm text-charcoal-muted font-sans leading-relaxed">
                    {pillar.description}
                  </p>
                </motion.article>
              ))}
            </div>

            {/* Tactile Material Footnote */}
            <div className="mt-8 p-5 bg-white border border-warm-grey/40 flex items-center justify-between">
              <div>
                <span className="block font-sans text-xs uppercase tracking-wider text-charcoal font-semibold mb-0.5">
                  Sample Finishes &amp; Raking Light Box Testing
                </span>
                <span className="text-xs text-warm-grey-dark">
                  On-site test panels provided for architectural review prior to project mobilization.
                </span>
              </div>
              <span className="font-mono text-[10px] text-bronze uppercase shrink-0 ml-4 font-semibold border border-bronze/40 px-2.5 py-1">
                PRE-CON SPEC
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CompanyIntro;
