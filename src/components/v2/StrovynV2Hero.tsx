'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Palette } from 'lucide-react';
import { prefersReducedMotion } from '@/lib/motion/gsapConfig';

interface HeroSlide {
  id: string;
  code: string;
  title: string;
  location: string;
  finishNote: string;
  image: string;
  alt: string;
  href: string;
}

const VERIFIED_HERO_SLIDES: HeroSlide[] = [
  {
    id: 'adelaide-living',
    code: 'COMMISSION 01 // INTERIOR ARCHITECTURE',
    title: 'Adelaide Residence — Living & Dining',
    location: 'Adelaide, South Australia',
    finishNote: 'AS/NZS 2311 Level 5 planar preparation & ultra-flat mineral wall finish',
    image: '/images/projects/adelaide-luxury-residence/living-dining-2.jpg',
    alt: 'Completed open-plan living and dining interior at Adelaide Residence by Strovyn Painting Co.',
    href: '/projects/the-north-adelaide-residence',
  },
  {
    id: 'adelaide-kitchen',
    code: 'COMMISSION 02 // DAYLIGHT JUNCTIONS',
    title: 'Adelaide Residence — Kitchen & Patio Aspect',
    location: 'Adelaide, South Australia',
    finishNote: 'Raking-light ceiling calibration & crisp shadow-line transitions',
    image: '/images/projects/adelaide-luxury-residence/kitchen-island-patio-3.jpg',
    alt: 'Kitchen island and patio elevation finished by Strovyn Painting Co. in Adelaide.',
    href: '/projects/the-north-adelaide-residence',
  },
  {
    id: 'exterior-pavilion',
    code: 'DISCIPLINE 03 // ARCHITECTURAL ENVELOPE',
    title: 'Exterior Facade & Mineral Coating Systems',
    location: 'Greater Adelaide, SA',
    finishNote: 'Breathable potassium silicate & UV-resilient elastomeric protection',
    image: '/images/architectural-pavilion.jpg',
    alt: 'Contemporary architectural pavilion facade representing Strovyn exterior coating systems.',
    href: '/services/exterior-facade-restoration',
  },
];

const VERIFIED_SPEC_STRIP = [
  { metric: '06', label: 'Specialist Coating Disciplines' },
  { metric: 'LEVEL 5', label: 'AS/NZS 2311 Planar Audit Standard' },
  { metric: '99.97%', label: 'HEPA Dust-Controlled Sanding' },
  { metric: 'ADELAIDE', label: 'Residential, Heritage & Commercial' },
] as const;

export const StrovynV2Hero: React.FC = () => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || prefersReducedMotion()) return;
    const timer = window.setInterval(() => {
      setActiveIdx((i) => (i + 1) % VERIFIED_HERO_SLIDES.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [paused]);

  const activeSlide = VERIFIED_HERO_SLIDES[activeIdx];
  const nextSlide = VERIFIED_HERO_SLIDES[(activeIdx + 1) % VERIFIED_HERO_SLIDES.length];

  return (
    <section
      id="v2-hero"
      aria-label="Strovyn Architectural Painting Hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative isolate min-h-[92svh] w-full overflow-hidden bg-[#141513] text-[#F4F1EA] flex flex-col justify-between pt-24 md:pt-28"
    >
      {/* Full-Bleed Architectural Photograph with Layered Scrim */}
      <div className="absolute inset-0 -z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSlide.id}
            initial={{ opacity: 0.35, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0.35 }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            className="relative h-full w-full"
          >
            <Image
              src={activeSlide.image}
              alt={activeSlide.alt}
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />
          </motion.div>
        </AnimatePresence>
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#111210]/92 via-[#141513]/76 to-[#141513]/45"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#111210] via-transparent to-[#111210]/55"
        />
      </div>

      {/* Main Editorial Grid */}
      <div className="mx-auto w-full max-w-7xl flex-1 flex items-end px-5 sm:px-8 lg:px-12 pb-12 lg:pb-16 pt-10">
        <div className="grid w-full grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-end">
          {/* Left 8 Columns: Masthead & Primary Conversion Actions */}
          <div className="lg:col-span-8 space-y-6">
            <div className="inline-flex items-center gap-3 border border-white/20 bg-[#181917]/85 px-3.5 py-1.5">
              <span className="h-1.5 w-1.5 bg-[#C41E1E]" aria-hidden="true" />
              <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-[#C9B28F]">
                Strovyn Painting Co. &middot; Adelaide, South Australia
              </span>
            </div>

            <h1 className="type-hero uppercase text-[clamp(2.75rem,7.2vw,6.25rem)] leading-[0.94] tracking-[-0.015em] text-[#F4F1EA]">
              <span className="block">Surface Craft</span>
              <span className="block text-[#C9B28F]">For Enduring</span>
              <span className="block">Architecture.</span>
            </h1>

            <p className="max-w-xl font-sans text-sm sm:text-base lg:text-lg text-[#E2DFD7] font-light leading-relaxed">
              Precision residential, heritage, and commercial painting across Greater Adelaide.
              Engineered from diagnostic substrate preparation and HEPA dust extraction to
              daylight-calibrated architectural finishes.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <Link
                href="/contact"
                className="inline-flex min-h-[48px] items-center gap-2.5 bg-[#C41E1E] hover:bg-[#A01818] text-white px-6 py-3.5 font-mono text-xs uppercase tracking-[0.2em] font-medium transition-colors"
              >
                <span>Request Site Consultation</span>
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>

              <Link
                href="/visualiser"
                className="inline-flex min-h-[48px] items-center gap-2.5 border border-white/30 bg-[#181917]/80 hover:border-[#C9B28F] hover:text-[#C9B28F] text-[#F4F1EA] px-5 py-3.5 font-mono text-xs uppercase tracking-[0.18em] transition-colors"
              >
                <Palette className="h-4 w-4 text-[#C9B28F]" aria-hidden="true" />
                <span>Wall Colour Visualiser</span>
              </Link>
            </div>
          </div>

          {/* Right 4 Columns: Structura-Inspired Commission Frame Switcher */}
          <div className="lg:col-span-4">
            <div className="border border-white/20 bg-[#181917]/92 p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/12 pb-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#C9B28F]">
                  {activeSlide.code}
                </span>
                <span className="font-mono text-[10px] text-[#B8B5AE]">
                  0{activeIdx + 1} / 0{VERIFIED_HERO_SLIDES.length}
                </span>
              </div>

              <div>
                <h2 className="type-card-title text-xl text-[#F4F1EA]">
                  {activeSlide.title}
                </h2>
                <p className="font-sans text-xs text-[#D6D4CF] mt-1.5 leading-relaxed">
                  {activeSlide.finishNote}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/12 gap-3">
                <Link
                  href={activeSlide.href}
                  className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#C9B28F] hover:text-white transition-colors"
                >
                  <span>Inspect Specification</span>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>

                <button
                  type="button"
                  onClick={() => setActiveIdx((activeIdx + 1) % VERIFIED_HERO_SLIDES.length)}
                  aria-label={`Next showcase frame: ${nextSlide.title}`}
                  className="px-2.5 py-1.5 border border-white/20 hover:border-[#C9B28F] font-mono text-[10px] uppercase tracking-[0.16em] text-[#F4F1EA] cursor-pointer transition-colors"
                >
                  Next Frame &rarr;
                </button>
              </div>

              {/* Frame Indicator Bars */}
              <div className="grid grid-cols-3 gap-1.5 pt-1" role="tablist" aria-label="Hero showcase slides">
                {VERIFIED_HERO_SLIDES.map((slide, idx) => (
                  <button
                    key={slide.id}
                    type="button"
                    role="tab"
                    aria-selected={idx === activeIdx}
                    aria-label={`Show ${slide.title}`}
                    onClick={() => setActiveIdx(idx)}
                    className={`h-1 w-full cursor-pointer transition-colors ${
                      idx === activeIdx ? 'bg-[#C41E1E]' : 'bg-white/20 hover:bg-white/40'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Architectural Specification Datum Strip */}
      <div className="border-t border-white/15 bg-[#111210]/95">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12 py-5 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {VERIFIED_SPEC_STRIP.map((item) => (
            <div key={item.metric} className="border-l-2 border-[#A78B65] pl-3.5">
              <span className="block font-display text-xl sm:text-2xl tracking-wide text-[#F4F1EA]">
                {item.metric}
              </span>
              <span className="block font-sans text-[11px] text-[#B8B5AE] leading-snug mt-0.5">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
