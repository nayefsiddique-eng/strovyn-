'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import { SERVICES_DATA } from '@/data/servicesData';
import { WHATSAPP_DETAILS } from '@/lib/constants';
import type { PublicProjectDetail } from '@/lib/cms/publicProjects';
import type { PublicArticleSummary } from '@/lib/cms/publicArticles';
import type { TestimonialItem } from '@/components/home/TestimonialCarousel';
import { FinishExplorer } from '@/components/home/FinishExplorer';
import { SearchableFAQ } from '@/components/home/SearchableFAQ';

export interface V3LuxuryHomePageProps {
  projects: PublicProjectDetail[];
  articles: PublicArticleSummary[];
  testimonials: TestimonialItem[];
}

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI'] as const;

const DISCIPLINE_EDITORIAL_PLATES = [
  '/images/projects/adelaide-luxury-residence/living-kitchen-1.jpg',
  '/images/architectural-pavilion.jpg',
  '/images/projects/adelaide-luxury-residence/kitchen-island-patio-3.jpg',
  '/images/painted-texture-detail.jpg',
  '/images/projects/adelaide-luxury-residence/living-dining-2.jpg',
  '/images/architectural-paint-swatch.jpg',
] as const;

const CRAFT_ACTS = [
  {
    code: 'ACT I // SUBSTRATE DIAGNOSTICS',
    title: 'Moisture & Planar Truth Before Primer.',
    body: 'Every wall and facade is audited with digital hygrometers (< 12% WME) and 2-metre straightedges before a primer tin is opened. Friable render, efflorescence, and unstable coatings are consolidated rather than painted over.',
    image: '/images/painted-texture-detail.jpg',
    caption: 'FIG. 03 — SUBSTRATE REMEDIATION & MINERAL CONSOLIDATION',
  },
  {
    code: 'ACT II // GRAZING DAYLIGHT',
    title: 'Calibrated Under 500-Lumen Raking Light.',
    body: 'South Australian northern sunlight exposes ordinary roller stipple and plasterboard joint crowns. Our finishers skim and Festool HEPA-sand walls under oblique floodlights to achieve AS/NZS 2311 Level 5 calm.',
    image: '/images/projects/adelaide-luxury-residence/living-dining-2.jpg',
    caption: 'FIG. 04 — ADELAIDE OPEN-PLAN SHADOWLINE & CEILING CALM',
  },
  {
    code: 'ACT III // ARCHITECTURAL CHEMISTRY',
    title: 'Silicates, Slaked Lime & 2K Joinery Lacquers.',
    body: 'From breathable potassium silicates that petrify into heritage masonry to catalyzed two-pack polyurethanes atomized inside negative-pressure spray booths, coating chemistry is engineered for longevity.',
    image: '/images/architectural-paint-swatch.jpg',
    caption: 'FIG. 05 — STUDIO MINERAL & LOW-VOC DRAWDOWN ARCHIVE',
  },
] as const;

export const V3LuxuryHomePage: React.FC<V3LuxuryHomePageProps> = ({
  projects,
  articles,
  testimonials,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [activeCraftAct, setActiveCraftAct] = useState(0);
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  const leftServices = SERVICES_DATA.filter((_, i) => i % 2 === 0);
  const rightServices = SERVICES_DATA.filter((_, i) => i % 2 === 1);
  const primaryProject = projects[0] ?? null;
  const secondaryProjects = projects.slice(1, 3);
  const activeTestimonial =
    testimonials.length > 0 ? testimonials[testimonialIdx % testimonials.length] : null;

  return (
    <div
      role="main"
      className="w-full bg-[#F4F1EA] dark:bg-[#181917] text-[#20211F] dark:text-[#F4F1EA]"
    >
      {/* =====================================================================
          1 & 2. ARCHITECTURAL EDITORIAL HERO + CONCISE VALUE PROPOSITION
          ===================================================================== */}
      <section
        id="frontispiece"
        aria-label="Strovyn Architectural Frontispiece"
        className="px-5 sm:px-10 lg:px-16 pt-8 sm:pt-12 pb-20 sm:pb-28 border-b border-[#B8B5AE]/70 dark:border-white/15"
      >
        {/* Running Monograph Issue Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[#20211F]/25 dark:border-white/20 py-2.5 mb-10 sm:mb-14 font-mono text-[10px] uppercase tracking-[0.22em] text-[#5C5A55] dark:text-[#B8B5AE]">
          <span>STROVYN PAINTING CO. &mdash; GREATER ADELAIDE, SOUTH AUSTRALIA</span>
          <span>AS/NZS 2311 LEVEL 5 PREPARATION GOVERNANCE</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-start">
          {/* Left Typography & Value Proposition */}
          <div className="lg:col-span-6 space-y-7 lg:pt-4">
            <div className="inline-flex items-center gap-3">
              <span className="h-[1px] w-8 bg-[#7E6340] dark:bg-[#C9B28F]" />
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F]">
                ARCHITECTURAL PAINTING, HERITAGE &amp; FINE PLASTERS
              </span>
            </div>

            <motion.h1
              initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
              className="font-display uppercase text-[clamp(3rem,6.2vw,6rem)] leading-[0.93] tracking-tight text-[#20211F] dark:text-[#F4F1EA]"
            >
              The Quiet Authority Of A Perfect Wall.
            </motion.h1>

            <p className="font-sans text-base sm:text-lg text-[#42413D] dark:text-[#D5D2CA] font-light leading-[1.75] max-w-xl">
              Strovyn Painting Co. delivers Level 5 interior painting, breathable exterior facade
              coatings, fine 2K cabinetry lacquering, and artisanal lime plasters for discerning
              homes and architectural spaces across Adelaide.
            </p>

            {/* Primary Conversion Path */}
            <div className="pt-2 flex flex-wrap items-center gap-6">
              <Link
                href="/contact"
                className="group inline-flex items-center gap-3 bg-[#C41E1E] hover:bg-[#20211F] text-[#F4F1EA] px-6 py-4 font-mono text-[11px] uppercase tracking-[0.22em] font-semibold transition-colors"
              >
                <span>Book Free Adelaide Consultation</span>
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>

              <Link
                href="/visualiser"
                className="inline-flex items-center gap-2 border-b border-[#20211F] dark:border-[#F4F1EA] pb-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-[#20211F] dark:text-[#F4F1EA] hover:text-[#7E6340] dark:hover:text-[#C9B28F] transition-colors py-2"
              >
                <span>Wall Colour Visualiser</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Verified Engineering Benchmarks */}
            <dl className="pt-7 border-t border-[#B8B5AE]/70 dark:border-white/15 grid grid-cols-3 gap-4">
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#7E6340] dark:text-[#C9B28F]">
                  FLATNESS
                </dt>
                <dd className="font-sans text-xs sm:text-sm font-medium mt-1">
                  &lt; 1.5mm / 2m Edge
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#7E6340] dark:text-[#C9B28F]">
                  EXTRACTION
                </dt>
                <dd className="font-sans text-xs sm:text-sm font-medium mt-1">
                  99.97% HEPA Sanding
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#7E6340] dark:text-[#C9B28F]">
                  DIAGNOSTICS
                </dt>
                <dd className="font-sans text-xs sm:text-sm font-medium mt-1">
                  &lt; 12% Moisture WME
                </dd>
              </div>
            </dl>
          </div>

          {/* Right Overlapping Dual-Crop Figure Study (Cinema Lens Settle + Editorial Matting) */}
          <div className="lg:col-span-6 relative sm:pb-14">
            <figure className="w-full sm:w-[84%] ml-auto">
              <figcaption className="mb-2.5 flex items-center justify-between font-mono text-[10px] tracking-[0.16em] text-[#5C5A55] dark:text-[#B8B5AE]">
                <span>FIG. 01 &mdash; ADELAIDE RESIDENCE, NORTHERN DAYLIGHT</span>
                <span>LEVEL 5 MATTE</span>
              </figcaption>
              <div className="relative aspect-[3/4] overflow-hidden bg-[#E2DDD2] dark:bg-[#242522] border border-[#B8B5AE]/65 dark:border-white/15">
                <motion.div
                  initial={shouldReduceMotion ? false : { scale: 1.05 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0"
                >
                  <Image
                    src="/images/projects/adelaide-luxury-residence/living-kitchen-1.jpg"
                    alt="Completed Adelaide residence open-plan interior finished by Strovyn Painting Co."
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 42vw"
                    className="object-cover object-center"
                  />
                </motion.div>
              </div>
            </figure>

            <figure className="hidden sm:block w-[45%] absolute left-0 bottom-0 bg-[#F4F1EA] dark:bg-[#181917] p-3 border border-[#B8B5AE]/85 dark:border-white/20 shadow-[0_18px_40px_rgba(32,33,31,0.09)]">
              <div className="relative aspect-[4/5] overflow-hidden">
                <Image
                  src="/images/architectural-paint-swatch.jpg"
                  alt="Architectural mineral drawdown swatch study"
                  fill
                  sizes="20vw"
                  className="object-cover object-center"
                />
              </div>
              <figcaption className="pt-2 font-mono text-[9px] uppercase tracking-[0.18em] text-[#7E6340] dark:text-[#C9B28F]">
                FIG. 02 &mdash; MINERAL DRAWDOWN FOLIO
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. SERVICES — STAGGERED ASYMMETRIC EDITORIAL LOOKBOOK
          ===================================================================== */}
      <section
        id="disciplines"
        aria-label="Six Architectural Finishing Disciplines"
        className="px-5 sm:px-10 lg:px-16 py-20 sm:py-28 border-b border-[#B8B5AE]/70 dark:border-white/15"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16 pb-6 border-b border-[#20211F]/20 dark:border-white/15">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F] block mb-2">
              § II &middot; SIX SPECIALIST DISCIPLINES
            </span>
            <h2 className="font-display uppercase text-4xl sm:text-6xl leading-[0.94]">
              Architectural Coating Practice.
            </h2>
          </div>
          <Link
            href="/services"
            className="inline-flex items-center gap-2 border border-[#20211F]/35 dark:border-white/25 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.22em] hover:border-[#C41E1E] self-start"
          >
            <span>Full Specification Index</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Left Column (Folios I, III, V — 4:5 Portrait Crops) */}
          <div className="md:col-span-6 space-y-20">
            {leftServices.map((service) => {
              const idx = SERVICES_DATA.findIndex((s) => s.slug === service.slug);
              const roman = ROMAN_NUMERALS[idx] || service.number;
              const imgSrc = DISCIPLINE_EDITORIAL_PLATES[idx] || service.heroImage;
              return (
                <article key={service.slug} className="group space-y-4">
                  <Link
                    href={`/services/${service.slug}`}
                    className="block overflow-hidden border border-[#B8B5AE]/65 dark:border-white/15"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-[#E5E0D5] dark:bg-[#232421]">
                      <Image
                        src={imgSrc}
                        alt={service.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 40vw"
                        className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                    </div>
                  </Link>

                  <div className="flex items-baseline justify-between border-b border-[#B8B5AE]/60 dark:border-white/15 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#7E6340] dark:text-[#C9B28F]">
                    <span>FOLIO {roman}</span>
                    <span className="truncate ml-4">{service.category}</span>
                  </div>

                  <h3 className="font-display uppercase text-2xl sm:text-4xl leading-[0.96]">
                    <Link
                      href={`/services/${service.slug}`}
                      className="hover:text-[#C41E1E] dark:hover:text-[#C9B28F] transition-colors"
                    >
                      {service.title}
                    </Link>
                  </h3>

                  <p className="font-sans text-sm text-[#4A4945] dark:text-[#C8C5BE] font-light leading-relaxed">
                    {service.shortDescription}
                  </p>

                  <p className="font-mono text-[10px] text-[#5C5A55] dark:text-[#9E9B93] leading-relaxed">
                    CHEMISTRY &mdash; {service.chemistry}
                  </p>

                  <Link
                    href={`/services/${service.slug}`}
                    className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#20211F] dark:text-[#F4F1EA] group-hover:text-[#C41E1E] dark:group-hover:text-[#C9B28F] py-1"
                  >
                    <span>Explore Specification</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </article>
              );
            })}
          </div>

          {/* Right Column (Folios II, IV, VI — Staggered Offset + 16:11 Wide Crops) */}
          <div className="md:col-span-6 md:mt-24 space-y-20">
            {rightServices.map((service) => {
              const idx = SERVICES_DATA.findIndex((s) => s.slug === service.slug);
              const roman = ROMAN_NUMERALS[idx] || service.number;
              const imgSrc = DISCIPLINE_EDITORIAL_PLATES[idx] || service.heroImage;
              return (
                <article key={service.slug} className="group space-y-4">
                  <Link
                    href={`/services/${service.slug}`}
                    className="block overflow-hidden border border-[#B8B5AE]/65 dark:border-white/15"
                  >
                    <div className="relative aspect-[16/11] overflow-hidden bg-[#E5E0D5] dark:bg-[#232421]">
                      <Image
                        src={imgSrc}
                        alt={service.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 40vw"
                        className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                    </div>
                  </Link>

                  <div className="flex items-baseline justify-between border-b border-[#B8B5AE]/60 dark:border-white/15 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#7E6340] dark:text-[#C9B28F]">
                    <span>FOLIO {roman}</span>
                    <span className="truncate ml-4">{service.category}</span>
                  </div>

                  <h3 className="font-display uppercase text-2xl sm:text-4xl leading-[0.96]">
                    <Link
                      href={`/services/${service.slug}`}
                      className="hover:text-[#C41E1E] dark:hover:text-[#C9B28F] transition-colors"
                    >
                      {service.title}
                    </Link>
                  </h3>

                  <p className="font-sans text-sm text-[#4A4945] dark:text-[#C8C5BE] font-light leading-relaxed">
                    {service.shortDescription}
                  </p>

                  <p className="font-mono text-[10px] text-[#5C5A55] dark:text-[#9E9B93] leading-relaxed">
                    TOLERANCE &mdash; {service.tolerances}
                  </p>

                  <Link
                    href={`/services/${service.slug}`}
                    className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#20211F] dark:text-[#F4F1EA] group-hover:text-[#C41E1E] dark:group-hover:text-[#C9B28F] py-1"
                  >
                    <span>Explore Specification</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================================
          4. CRAFTSMANSHIP & FINISHING EXPERTISE (CINEMA DIPTYCH + DROP-CAP ESSAY)
          ===================================================================== */}
      <section
        id="approach"
        aria-label="Craftsmanship and Surface Preparation Protocol"
        className="px-5 sm:px-10 lg:px-16 py-20 sm:py-28 border-b border-[#B8B5AE]/70 dark:border-white/15 bg-[#EFECE4] dark:bg-[#141513]"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* Left Sticky Photographic Cinema Frame */}
          <figure className="lg:col-span-5 lg:sticky lg:top-10 space-y-3">
            <div className="relative aspect-[4/5] overflow-hidden bg-[#181917] border border-[#B8B5AE]/70 dark:border-white/15">
              <Image
                key={CRAFT_ACTS[activeCraftAct].image}
                src={CRAFT_ACTS[activeCraftAct].image}
                alt={CRAFT_ACTS[activeCraftAct].title}
                fill
                sizes="(max-width: 1024px) 100vw, 38vw"
                className="object-cover object-center transition-opacity duration-500"
              />
            </div>
            <figcaption className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7E6340] dark:text-[#C9B28F]">
              {CRAFT_ACTS[activeCraftAct].caption}
            </figcaption>
          </figure>

          {/* Right Editorial Essay + Interactive 3-Act Ledger */}
          <div className="lg:col-span-7 space-y-10">
            <div className="space-y-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F] block">
                § III &middot; PREPARATION GOVERNANCE
              </span>
              <h2 className="font-display uppercase text-3xl sm:text-5xl leading-[0.95]">
                Seventy Percent Of Finish Quality Happens Before Primer.
              </h2>
              <p className="font-sans text-sm sm:text-base text-[#3A3936] dark:text-[#D5D2CA] font-light leading-[1.85]">
                <span className="float-left font-display text-6xl leading-[0.82] pr-3.5 pt-1 text-[#C41E1E]">
                  S
                </span>
                outh Australian daylight is unforgiving. When low-angle morning sun rakes across a
                hallway in Unley or a double-height void in Burnside, standard trade roller stipple
                and drywall joint crowns immediately betray rushed preparation. Every Strovyn
                commission follows a documented diagnostic, HEPA-extracted sanding, and natural
                daylight sign-off sequence.
              </p>
            </div>

            <div className="divide-y divide-[#B8B5AE]/70 dark:divide-white/15 border-y border-[#B8B5AE]/70 dark:border-white/15">
              {CRAFT_ACTS.map((act, idx) => {
                const selected = activeCraftAct === idx;
                return (
                  <button
                    key={act.code}
                    type="button"
                    onClick={() => setActiveCraftAct(idx)}
                    onMouseEnter={() => setActiveCraftAct(idx)}
                    className={`w-full text-left py-6 pl-5 border-l-2 transition-colors cursor-pointer ${
                      selected
                        ? 'border-[#C41E1E] bg-[#FAF8F4]/70 dark:bg-[#1B1C19]'
                        : 'border-transparent hover:border-[#7E6340]'
                    }`}
                  >
                    <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#7E6340] dark:text-[#C9B28F] block mb-1.5">
                      {act.code}
                    </span>
                    <h3 className="font-display uppercase text-2xl sm:text-3xl leading-tight mb-2">
                      {act.title}
                    </h3>
                    <p className="font-sans text-xs sm:text-sm text-[#4A4945] dark:text-[#B8B5AE] font-light leading-relaxed max-w-2xl">
                      {act.body}
                    </p>
                  </button>
                );
              })}
            </div>

            <div>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-[#20211F] dark:text-[#F4F1EA] border-b border-[#20211F] dark:border-[#F4F1EA] pb-1 hover:text-[#C41E1E]"
              >
                <span>Examine Full 4-Stage Studio Protocol</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          5. APPROVED PROJECT PORTFOLIO (21:9 CINEMA HEADER + HONEST EMPTY STATE)
          ===================================================================== */}
      <section
        id="commissions"
        aria-label="Approved Architectural Commissions"
        className="px-5 sm:px-10 lg:px-16 py-20 sm:py-28 border-b border-[#B8B5AE]/70 dark:border-white/15 space-y-12"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#20211F]/20 dark:border-white/15">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F] block mb-2">
              § IV &middot; COMMISSION ARCHIVE
            </span>
            <h2 className="font-display uppercase text-4xl sm:text-6xl leading-[0.94]">
              Adelaide In Natural Light.
            </h2>
          </div>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 border border-[#20211F]/35 dark:border-white/25 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.22em] hover:border-[#C41E1E] self-start"
          >
            <span>Open Full Portfolio</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {primaryProject ? (
          <div className="space-y-12">
            {/* Widescreen 21:9 Cinema Case-Study Frame (Adapted from Concept A) */}
            <Link
              href={`/projects/${primaryProject.slug}`}
              className="group block relative aspect-[4/3] sm:aspect-[16/9] lg:aspect-[21/9] w-full overflow-hidden bg-[#141513] border border-[#B8B5AE]/65 dark:border-white/15"
            >
              <Image
                src={primaryProject.heroImage}
                alt={primaryProject.title}
                fill
                sizes="100vw"
                className="object-cover object-center transition-transform duration-1000 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0E0F0E]/90 via-[#0E0F0E]/20 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 sm:bottom-9 sm:left-9 sm:right-9 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#C9B28F] block mb-1.5">
                    {primaryProject.isDemonstrationSpec ? 'DEMONSTRATION STUDY' : primaryProject.lifecycle} &middot;{' '}
                    {primaryProject.category} &middot; {primaryProject.location}
                  </span>
                  <h3 className="font-display uppercase text-3xl sm:text-5xl text-[#F4F1EA] leading-none">
                    {primaryProject.title}
                  </h3>
                </div>
                <span className="inline-flex items-center gap-2 bg-[#F4F1EA] text-[#141513] px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] font-semibold self-start sm:self-auto">
                  <span>Inspect Monograph</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>

            {/* Editorial Scope Summary + Detail Plate */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-6 space-y-4">
                <p className="font-sans text-sm sm:text-base text-[#3A3936] dark:text-[#D5D2CA] font-light leading-relaxed">
                  {primaryProject.description}
                </p>
                {primaryProject.finishes && (
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#7E6340] dark:text-[#C9B28F] pt-2 border-t border-[#B8B5AE]/60 dark:border-white/15">
                    SPECIFIED SYSTEM &mdash; {primaryProject.finishes}
                  </p>
                )}
              </div>

              {secondaryProjects.length > 0 ? (
                <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {secondaryProjects.map((proj) => (
                    <Link key={proj.slug} href={`/projects/${proj.slug}`} className="group block space-y-2.5">
                      <div className="relative aspect-[16/10] overflow-hidden bg-[#181917] border border-[#B8B5AE]/60 dark:border-white/15">
                        <Image
                          src={proj.heroImage}
                          alt={proj.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 25vw"
                          className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                        />
                      </div>
                      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#7E6340] dark:text-[#C9B28F] block">
                        {proj.location}
                      </span>
                      <h4 className="font-display uppercase text-xl group-hover:text-[#C41E1E] transition-colors">
                        {proj.title}
                      </h4>
                    </Link>
                  ))}
                </div>
              ) : (
                primaryProject.galleryImages.length > 1 && (
                  <div className="lg:col-span-6 grid grid-cols-2 gap-4">
                    {primaryProject.galleryImages.slice(1, 3).map((gImg, i) => (
                      <div
                        key={gImg}
                        className="relative aspect-[16/11] overflow-hidden border border-[#B8B5AE]/60 dark:border-white/15"
                      >
                        <Image
                          src={gImg}
                          alt={`${primaryProject.title} surface detail ${i + 1}`}
                          fill
                          sizes="(max-width: 768px) 50vw, 24vw"
                          className="object-cover object-center"
                        />
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        ) : (
          /* Elegant Empty State when 0 CMS Projects are Published */
          <div
            data-testid="v3-portfolio-empty-state"
            className="border border-[#B8B5AE] dark:border-white/20 bg-[#FAF8F4] dark:bg-[#1C1D1A] p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
          >
            <div className="lg:col-span-8 space-y-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F] block">
                CURATORIAL ARCHIVE NOTICE
              </span>
              <h3 className="font-display uppercase text-3xl leading-tight">
                Approved Commission Monographs In Preparation.
              </h3>
              <p className="font-sans text-sm text-[#4A4945] dark:text-[#B8B5AE] font-light leading-relaxed max-w-2xl">
                Strovyn publishes residential and commercial photography only with explicit client
                release. Request an on-site consultation to inspect physical 600&times;600mm
                drawdown boards or preview finishes on your own room photo in our Visualiser.
              </p>
            </div>
            <div className="lg:col-span-4 flex flex-wrap lg:justify-end gap-3">
              <Link
                href="/visualiser"
                className="inline-flex items-center gap-2 bg-[#20211F] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#181917] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.2em] font-semibold"
              >
                <span>Open Visualiser</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* =====================================================================
          6. FINISH EXPLORER INTEGRATION (EXISTING INTERACTIVE COLOUR & SHEEN STUDIO)
          ===================================================================== */}
      <div className="border-b border-[#B8B5AE]/70 dark:border-white/15">
        <FinishExplorer />
      </div>

      {/* =====================================================================
          7. TESTIMONIALS FROM APPROVED CMS CONTENT (WITH ELEGANT EMPTY STATE)
          ===================================================================== */}
      <section
        id="endorsements"
        aria-label="Verified Client Perspectives"
        className="px-5 sm:px-10 lg:px-16 py-20 sm:py-24 border-b border-[#B8B5AE]/70 dark:border-white/15 bg-[#EFECE4]/70 dark:bg-[#151614]"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F] block mb-2">
              § VI &middot; CLIENT PERSPECTIVES
            </span>
            <h2 className="font-display uppercase text-3xl sm:text-5xl leading-[0.95]">
              Verified Reflections.
            </h2>
          </div>
          <Link
            href="/feedback"
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#7E6340] dark:text-[#C9B28F] underline"
          >
            Submit Project Evaluation &rarr;
          </Link>
        </div>

        {activeTestimonial ? (
          <div className="border border-[#B8B5AE] dark:border-white/20 bg-[#FAF8F4] dark:bg-[#1B1C19] p-7 sm:p-12 space-y-6">
            <blockquote className="font-sans text-lg sm:text-2xl font-light italic leading-relaxed text-[#20211F] dark:text-[#F4F1EA] max-w-3xl">
              &ldquo;{activeTestimonial.quote}&rdquo;
            </blockquote>
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#B8B5AE]/60 dark:border-white/15">
              <div>
                <span className="font-display uppercase text-xl block">
                  {activeTestimonial.author}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#7E6340] dark:text-[#C9B28F]">
                  {[activeTestimonial.role, activeTestimonial.location, activeTestimonial.project]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>

              {testimonials.length > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setTestimonialIdx((p) => (p - 1 + testimonials.length) % testimonials.length)
                    }
                    aria-label="Previous testimonial"
                    className="h-10 w-10 border border-[#B8B5AE] dark:border-white/25 inline-flex items-center justify-center cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestimonialIdx((p) => (p + 1) % testimonials.length)}
                    aria-label="Next testimonial"
                    className="h-10 w-10 border border-[#B8B5AE] dark:border-white/25 inline-flex items-center justify-center cursor-pointer"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            data-testid="v3-testimonials-empty-state"
            className="border border-[#B8B5AE]/80 dark:border-white/15 bg-[#FAF8F4] dark:bg-[#1B1C19] p-7 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6"
          >
            <div className="space-y-2 max-w-2xl">
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#7E6340] dark:text-[#C9B28F] block">
                GOVERNANCE VERIFICATION
              </span>
              <p className="font-sans text-sm text-[#4A4945] dark:text-[#C8C5BE] font-light leading-relaxed">
                Client endorsements are published exclusively after project handover and explicit
                written client consent. Completed a project with Strovyn? Share your evaluation
                through our client reflection folio.
              </p>
            </div>
            <Link
              href="/feedback"
              className="inline-flex items-center gap-2 border border-[#20211F] dark:border-white/30 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.2em] shrink-0 self-start md:self-auto"
            >
              <span>Record Reflection</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </section>

      {/* =====================================================================
          8. INSIGHT PREVIEWS (3-COLUMN PRINT BROADSHEET FROM LIVE CMS)
          ===================================================================== */}
      <section
        id="insights"
        aria-label="Published Technical Insights"
        className="px-5 sm:px-10 lg:px-16 py-20 sm:py-28 border-b border-[#B8B5AE]/70 dark:border-white/15 space-y-12"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#20211F]/20 dark:border-white/15">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F] block mb-2">
              § VII &middot; TECHNICAL FIELD JOURNAL
            </span>
            <h2 className="font-display uppercase text-4xl sm:text-5xl leading-[0.95]">
              Coatings Science &amp; Field Notes.
            </h2>
          </div>
          <Link
            href="/insights"
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-[#20211F] dark:text-[#F4F1EA] hover:text-[#C41E1E]"
          >
            <span>All Published Essays</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {articles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#B8B5AE]/70 dark:divide-white/15">
            {articles.slice(0, 3).map((article, idx) => (
              <article
                key={article.id}
                className={`py-6 md:py-0 ${
                  idx === 0 ? 'md:pr-8' : idx === 1 ? 'md:px-8' : 'md:pl-8'
                }`}
              >
                <Link href={`/insights/${article.slug}`} className="group block space-y-3">
                  <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#7E6340] dark:text-[#C9B28F] block">
                    {article.category} &middot; {article.readTimeLabel}
                  </span>
                  <h3 className="font-display uppercase text-2xl sm:text-3xl leading-[0.98] group-hover:text-[#C41E1E] dark:group-hover:text-[#C9B28F] transition-colors">
                    {article.title}
                  </h3>
                  <p className="font-sans text-xs sm:text-sm text-[#4A4945] dark:text-[#B8B5AE] font-light leading-relaxed line-clamp-3">
                    {article.excerpt}
                  </p>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] pt-1 text-[#20211F] dark:text-[#F4F1EA] group-hover:text-[#C41E1E]">
                    <span>Read Paper</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="p-8 border border-[#B8B5AE]/70 dark:border-white/15 font-sans text-sm text-[#5C5A55] dark:text-[#B8B5AE]">
            Technical field papers are currently in editorial review.
          </div>
        )}
      </section>

      {/* =====================================================================
          9. SEARCHABLE FAQ (EXISTING INTERACTIVE SEARCH & FILTER COMPONENT)
          ===================================================================== */}
      <div className="border-b border-[#B8B5AE]/70 dark:border-white/15">
        <SearchableFAQ />
      </div>

      {/* =====================================================================
          10. STRONG CONSULTATION CTA (CRIMSON × VELLUM COMMISSION SLIP)
          ===================================================================== */}
      <section
        id="consultation"
        aria-label="Request Adelaide Site Consultation"
        className="grid grid-cols-1 lg:grid-cols-12"
      >
        <div className="lg:col-span-5 bg-[#C41E1E] text-[#F4F1EA] p-8 sm:p-12 lg:p-16 flex flex-col justify-between gap-8">
          <div className="space-y-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/85 block">
              § IX &middot; FREE ADELAIDE CONSULTATION
            </span>
            <h2 className="font-display uppercase text-4xl sm:text-6xl leading-[0.92]">
              Begin Your Commission.
            </h2>
            <p className="font-sans text-sm sm:text-base text-white/90 font-light leading-relaxed max-w-md">
              Invite our estimating director to inspect your residence, heritage villa, or
              architectural plans anywhere across Greater Adelaide.
            </p>
          </div>

          <div className="pt-4 border-t border-white/25 space-y-2 font-mono text-xs uppercase tracking-[0.2em]">
            <span className="block text-white/80">DIRECT WHATSAPP DESK</span>
            <a
              href={WHATSAPP_DETAILS.chatUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#141513] text-[#F4F1EA] px-5 py-3 font-semibold"
            >
              <span>Chat: {WHATSAPP_DETAILS.displayNumber}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        <div className="lg:col-span-7 bg-[#FAF8F4] dark:bg-[#1B1C19] p-8 sm:p-12 lg:p-16 flex flex-col justify-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F] block mb-2">
            COMMISSION INTAKE SLIP
          </span>
          <h3 className="font-display uppercase text-3xl sm:text-4xl mb-6">
            Outline Your Project Coordinates.
          </h3>

          <form action="/contact" method="GET" className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <label className="block space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                Your Name or Practice *
              </span>
              <input
                type="text"
                name="name"
                required
                placeholder="Full name or studio"
                className="w-full bg-transparent border-b border-[#20211F]/40 dark:border-white/30 py-3 font-sans text-sm focus:outline-none focus:border-[#C41E1E]"
              />
            </label>

            <label className="block space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                Adelaide Suburb *
              </span>
              <input
                type="text"
                name="location"
                required
                placeholder="e.g. North Adelaide, Unley, Norwood"
                className="w-full bg-transparent border-b border-[#20211F]/40 dark:border-white/30 py-3 font-sans text-sm focus:outline-none focus:border-[#C41E1E]"
              />
            </label>

            <label className="sm:col-span-2 block space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                Primary Coating Discipline
              </span>
              <select
                name="service"
                defaultValue="Interior Precision Painting"
                className="w-full bg-[#EFECE4] dark:bg-[#141513] border border-[#B8B5AE] dark:border-white/20 px-4 py-3 font-sans text-sm text-[#20211F] dark:text-[#F4F1EA] focus:outline-none focus:border-[#C41E1E]"
              >
                <option value="Interior Precision Painting">Interior Architectural Painting (Level 5)</option>
                <option value="Exterior Cladding & Facade Protection">Exterior Facade Restoration &amp; Mineral Coatings</option>
                <option value="Cabinet Refinishing & Spraying">Fine Cabinetry &amp; 2K Lacquering</option>
                <option value="Woodwork & Architectural Trim">Artisanal Plasters &amp; Architectural Timber</option>
                <option value="Commercial & Heritage Painting">Commercial &amp; Heritage Conservation</option>
              </select>
            </label>

            <div className="sm:col-span-2 pt-2 flex flex-wrap items-center justify-between gap-4">
              <span className="font-sans text-xs text-[#5C5A55] dark:text-[#B8B5AE]">
                Continues to full specification intake with optional PDF plan upload.
              </span>
              <button
                type="submit"
                className="inline-flex items-center gap-3 bg-[#20211F] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#181917] hover:bg-[#C41E1E] dark:hover:bg-[#C9B28F] px-7 py-4 font-mono text-[11px] uppercase tracking-[0.22em] font-semibold transition-colors cursor-pointer"
              >
                <span>Continue To Full Quotation</span>
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
};
