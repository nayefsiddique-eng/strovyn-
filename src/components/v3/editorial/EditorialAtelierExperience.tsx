'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, BookOpen, Moon, Sun, X } from 'lucide-react';
import { SERVICES_DATA } from '@/data/servicesData';
import { WHATSAPP_DETAILS } from '@/lib/constants';
import { ARCHITECTURAL_WHEEL_COLOURS } from '@/components/home/CircularColourWheel';
import type { PublicProjectDetail } from '@/lib/cms/publicProjects';
import type { PublicArticleSummary } from '@/lib/cms/publicArticles';
import { useV3Theme } from '@/components/v3/shared/V3IntroAndTheme';

export interface EditorialAtelierProps {
  projects: PublicProjectDetail[];
  articles: PublicArticleSummary[];
}

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI'] as const;

const TOC_CHAPTERS = [
  { id: 'editorial-frontispiece', roman: 'I', label: 'Frontispiece' },
  { id: 'editorial-essay', roman: 'II', label: 'Atelier Essay' },
  { id: 'editorial-lookbook', roman: 'III', label: 'Six Disciplines' },
  { id: 'editorial-swatchbook', roman: 'IV', label: 'Pigment Folio' },
  { id: 'editorial-monograph', roman: 'V', label: 'Case Monograph' },
  { id: 'editorial-correspondence', roman: 'VI', label: 'Correspondence' },
] as const;

const DISCIPLINE_PLATES = [
  '/images/projects/adelaide-luxury-residence/living-kitchen-1.jpg',
  '/images/architectural-pavilion.jpg',
  '/images/projects/adelaide-luxury-residence/kitchen-island-patio-3.jpg',
  '/images/painted-texture-detail.jpg',
  '/images/projects/adelaide-luxury-residence/living-dining-2.jpg',
  '/images/architectural-paint-swatch.jpg',
] as const;

export const EditorialAtelierExperience: React.FC<EditorialAtelierProps> = ({
  projects,
  articles,
}) => {
  const { isDark, toggleTheme } = useV3Theme();
  const shouldReduceMotion = useReducedMotion();
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [activeChapter, setActiveChapter] = useState<string>('editorial-frontispiece');
  const [selectedTone, setSelectedTone] = useState(ARCHITECTURAL_WHEEL_COLOURS[1] || ARCHITECTURAL_WHEEL_COLOURS[0]);

  useEffect(() => {
    const onScroll = () => {
      const triggerY = window.innerHeight * 0.38;
      for (let i = TOC_CHAPTERS.length - 1; i >= 0; i--) {
        const el = document.getElementById(TOC_CHAPTERS[i].id);
        if (el && el.getBoundingClientRect().top <= triggerY) {
          setActiveChapter(TOC_CHAPTERS[i].id);
          break;
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const primaryProject = projects[0] ?? null;
  const swatchSelection = ARCHITECTURAL_WHEEL_COLOURS.slice(0, 8);

  const leftColumnServices = SERVICES_DATA.filter((_, idx) => idx % 2 === 0);
  const rightColumnServices = SERVICES_DATA.filter((_, idx) => idx % 2 === 1);

  return (
    <div
      role="main"
      className="min-h-screen bg-[#F4F1EA] dark:bg-[#181917] text-[#20211F] dark:text-[#F4F1EA] selection:bg-[#A78B65] selection:text-[#181917] transition-colors duration-500"
    >
      {/* =====================================================================
          NAVIGATION DESIGN #2: FIXED LEFT VERTICAL BOOK-SPINE RAIL (DESKTOP)
          + PRINT BROADSHEET MASTHEAD (MOBILE/TABLET)
          ===================================================================== */}
      <aside
        aria-label="Editorial Monograph Spine Navigation"
        className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-[244px] flex-col justify-between border-r border-[#B8B5AE]/70 dark:border-white/15 bg-[#EFECE4] dark:bg-[#141513] px-7 py-8 select-none"
      >
        {/* Top Masthead */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#B8B5AE]/60 dark:border-white/15 pb-3">
            <span className="font-mono text-[9px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F]">
              FOLIO NO. 03
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#5C5A55] dark:text-[#B8B5AE]">
              ADELAIDE
            </span>
          </div>

          <Link href="/prototype/v3-editorial" className="block group">
            <span className="font-display text-3xl tracking-[0.06em] uppercase text-[#20211F] dark:text-[#F4F1EA] block leading-none">
              STROVYN
            </span>
            <span className="font-sans text-[11px] text-[#5C5A55] dark:text-[#B8B5AE] mt-1.5 block leading-snug">
              Architectural Coating &amp; Plaster Atelier
            </span>
          </Link>
        </div>

        {/* Middle Roman-Numeral Table of Contents */}
        <nav aria-label="Monograph Chapters" className="space-y-5">
          <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F] block">
            TABLE OF CONTENTS
          </span>
          <ul className="space-y-2.5 border-l border-[#B8B5AE]/60 dark:border-white/15 pl-4">
            {TOC_CHAPTERS.map((ch) => {
              const isCurrent = activeChapter === ch.id;
              return (
                <li key={ch.id} className="relative">
                  {isCurrent && (
                    <motion.span
                      layoutId="editorial-spine-indicator"
                      className="absolute -left-[17px] top-1 bottom-1 w-[2px] bg-[#C41E1E]"
                    />
                  )}
                  <a
                    href={`#${ch.id}`}
                    className={`flex items-baseline gap-2.5 py-0.5 transition-colors ${
                      isCurrent
                        ? 'text-[#20211F] dark:text-[#F4F1EA] font-medium'
                        : 'text-[#6A6862] dark:text-[#9E9B93] hover:text-[#20211F] dark:hover:text-[#F4F1EA]'
                    }`}
                  >
                    <span className="font-mono text-[10px] tracking-[0.18em] w-5 text-[#7E6340] dark:text-[#C9B28F]">
                      §{ch.roman}
                    </span>
                    <span className="font-sans text-xs tracking-wide">{ch.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>

          {/* Studio Directory Links */}
          <div className="pt-4 border-t border-[#B8B5AE]/60 dark:border-white/15 space-y-1.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F] block mb-2">
              STUDIO DIRECTORY
            </span>
            {[
              { label: 'Disciplines Index', href: '/services' },
              { label: 'Commission Archive', href: '/projects' },
              { label: 'Colour Visualiser', href: '/visualiser' },
              { label: 'Field Journal', href: '/insights' },
              { label: 'Practice & Careers', href: '/about' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between py-1 font-sans text-xs text-[#4A4945] dark:text-[#C8C5BE] hover:text-[#C41E1E] dark:hover:text-[#C9B28F] transition-colors"
              >
                <span>{item.label}</span>
                <ArrowUpRight className="h-3 w-3 opacity-60" />
              </Link>
            ))}
          </div>
        </nav>

        {/* Bottom Colophon & Edition Controls */}
        <div className="space-y-3 pt-4 border-t border-[#B8B5AE]/60 dark:border-white/15">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to Daylight Paper Edition' : 'Switch to Nocturne Ink Edition'}
            className="w-full flex items-center justify-between px-3 py-2 border border-[#B8B5AE]/80 dark:border-white/20 text-[10px] font-mono uppercase tracking-[0.2em] text-[#20211F] dark:text-[#F4F1EA] hover:border-[#20211F] dark:hover:border-[#C9B28F] transition-colors cursor-pointer"
          >
            <span>{isDark ? 'Nocturne Edition' : 'Paper Edition'}</span>
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          <Link
            href="/contact"
            className="w-full inline-flex items-center justify-between bg-[#20211F] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#181917] hover:bg-[#C41E1E] dark:hover:bg-[#C9B28F] px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-[0.22em] font-semibold transition-colors"
          >
            <span>Commission Slip</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </aside>

      {/* Mobile / Tablet Print Broadsheet Masthead */}
      <header className="lg:hidden sticky top-0 z-40 bg-[#F4F1EA]/95 dark:bg-[#181917]/95 backdrop-blur-md border-b border-[#B8B5AE]/80 dark:border-white/15">
        <div className="px-4 py-3 flex items-center justify-between">
          <Link href="/prototype/v3-editorial" className="flex items-baseline gap-2">
            <span className="font-display text-2xl tracking-[0.06em] uppercase text-[#20211F] dark:text-[#F4F1EA]">
              STROVYN
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#7E6340] dark:text-[#C9B28F]">
              ATELIER
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to Paper Edition' : 'Switch to Nocturne Edition'}
              className="p-2 border border-[#B8B5AE]/80 dark:border-white/20 text-[#20211F] dark:text-[#F4F1EA]"
            >
              {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setMobileTocOpen((v) => !v)}
              aria-expanded={mobileTocOpen}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#20211F] dark:border-[#F4F1EA]/40 font-mono text-[10px] uppercase tracking-[0.2em]"
            >
              {mobileTocOpen ? <X className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
              <span>Contents</span>
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileTocOpen && (
            <motion.nav
              aria-label="Mobile Monograph Contents"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-t border-[#B8B5AE]/70 dark:border-white/15 bg-[#EFECE4] dark:bg-[#141513] px-5 py-6 space-y-5"
            >
              <div className="grid grid-cols-2 gap-2.5">
                {TOC_CHAPTERS.map((ch) => (
                  <a
                    key={ch.id}
                    href={`#${ch.id}`}
                    onClick={() => setMobileTocOpen(false)}
                    className="border border-[#B8B5AE]/60 dark:border-white/15 px-3 py-2.5 flex items-baseline gap-2"
                  >
                    <span className="font-mono text-[10px] text-[#7E6340] dark:text-[#C9B28F]">
                      §{ch.roman}
                    </span>
                    <span className="font-sans text-xs">{ch.label}</span>
                  </a>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 pt-3 border-t border-[#B8B5AE]/60 dark:border-white/15 font-mono text-[10px] uppercase tracking-[0.18em]">
                <Link href="/services" onClick={() => setMobileTocOpen(false)}>
                  Services
                </Link>
                <span>&middot;</span>
                <Link href="/projects" onClick={() => setMobileTocOpen(false)}>
                  Projects
                </Link>
                <span>&middot;</span>
                <Link href="/visualiser" onClick={() => setMobileTocOpen(false)}>
                  Visualiser
                </Link>
                <span>&middot;</span>
                <Link href="/insights" onClick={() => setMobileTocOpen(false)}>
                  Insights
                </Link>
                <span>&middot;</span>
                <Link href="/contact" onClick={() => setMobileTocOpen(false)} className="text-[#C41E1E] font-semibold">
                  Consultation &rarr;
                </Link>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* =====================================================================
          BOOK SPREAD CANVAS (OFFSET BY 244PX ON DESKTOP)
          ===================================================================== */}
      <div className="lg:pl-[244px]">
        {/* § I — FRONTISPIECE HERO SPREAD */}
        <section
          id="editorial-frontispiece"
          aria-label="Monograph Frontispiece"
          className="px-5 sm:px-10 lg:px-16 pt-8 sm:pt-12 pb-20 sm:pb-28 border-b border-[#B8B5AE]/70 dark:border-white/15"
        >
          {/* Running Folio Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-b border-[#20211F]/25 dark:border-white/20 py-2.5 mb-12 sm:mb-16 font-mono text-[10px] uppercase tracking-[0.24em] text-[#5C5A55] dark:text-[#B8B5AE]">
            <span>MONOGRAPH ON ARCHITECTURAL SURFACES &mdash; SOUTH AUSTRALIA</span>
            <span>AS/NZS 2311 LEVEL 5 GOVERNANCE</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-start">
            {/* Left Editorial Typography Column */}
            <div className="lg:col-span-6 space-y-8 lg:pt-6">
              <div className="inline-flex items-center gap-3">
                <span className="h-[1px] w-8 bg-[#7E6340] dark:bg-[#C9B28F]" />
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F]">
                  § I &middot; ON LIGHT, PLASTER &amp; PATIENCE
                </span>
              </div>

              <motion.h1
                initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                className="font-display uppercase text-[clamp(3.1rem,6.4vw,6.2rem)] leading-[0.93] tracking-tight text-[#20211F] dark:text-[#F4F1EA]"
              >
                The Quiet Authority Of A Perfect Wall.
              </motion.h1>

              <p className="font-sans text-base sm:text-lg text-[#454440] dark:text-[#D2CFC7] font-light leading-[1.75] max-w-xl">
                Before colour enters a room, light interrogates its geometry. Across Adelaide&rsquo;s
                heritage villas and contemporary residences, Strovyn treats coating not as cosmetic
                trade work, but as calm architectural surface engineering.
              </p>

              {/* Print-style Underlined Calls to Action */}
              <div className="pt-2 flex flex-wrap items-center gap-8">
                <Link
                  href="/contact"
                  className="group inline-flex items-center gap-3 bg-[#20211F] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#181917] hover:bg-[#C41E1E] dark:hover:bg-[#C9B28F] px-6 py-3.5 font-mono text-[11px] uppercase tracking-[0.22em] font-semibold transition-colors"
                >
                  <span>Request On-Site Folio</span>
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>

                <Link
                  href="/visualiser"
                  className="inline-flex items-center gap-2 border-b border-[#20211F] dark:border-[#F4F1EA] pb-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-[#20211F] dark:text-[#F4F1EA] hover:text-[#7E6340] dark:hover:text-[#C9B28F] transition-colors"
                >
                  <span>Pigment Visualiser</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {/* Quiet Editorial Footnote Trio */}
              <dl className="pt-8 border-t border-[#B8B5AE]/70 dark:border-white/15 grid grid-cols-3 gap-4">
                <div>
                  <dt className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#7E6340] dark:text-[#C9B28F]">
                    TOLERANCE
                  </dt>
                  <dd className="font-sans text-xs sm:text-sm text-[#20211F] dark:text-[#F4F1EA] mt-1">
                    &lt; 1.5mm / 2m Edge
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#7E6340] dark:text-[#C9B28F]">
                    CONTAINMENT
                  </dt>
                  <dd className="font-sans text-xs sm:text-sm text-[#20211F] dark:text-[#F4F1EA] mt-1">
                    99.97% HEPA Sanding
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#7E6340] dark:text-[#C9B28F]">
                    CHEMISTRY
                  </dt>
                  <dd className="font-sans text-xs sm:text-sm text-[#20211F] dark:text-[#F4F1EA] mt-1">
                    Silicate, Lime &amp; 2K
                  </dd>
                </div>
              </dl>
            </div>

            {/* Right Asymmetric Dual-Crop Figure Study */}
            <div className="lg:col-span-6 relative pb-12 sm:pb-16">
              {/* Primary Tall Portrait Plate */}
              <figure className="w-full sm:w-[84%] ml-auto">
                <figcaption className="mb-2.5 flex items-center justify-between font-mono text-[10px] tracking-[0.16em] text-[#5C5A55] dark:text-[#B8B5AE]">
                  <span>FIG. 01 &mdash; ADELAIDE RESIDENCE, NORTHERN DAYLIGHT</span>
                  <span>MATTE WASH</span>
                </figcaption>
                <div className="relative aspect-[3/4] overflow-hidden bg-[#E2DDD2] dark:bg-[#242522] border border-[#B8B5AE]/60 dark:border-white/15">
                  <Image
                    src="/images/projects/adelaide-luxury-residence/living-kitchen-1.jpg"
                    alt="Sunlit architectural interior finished by Strovyn Painting Co."
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 42vw"
                    className="object-cover object-center"
                  />
                </div>
              </figure>

              {/* Overlapping Secondary Macro Material Crop */}
              <figure className="hidden sm:block w-[46%] absolute left-0 bottom-0 bg-[#F4F1EA] dark:bg-[#181917] p-3 border border-[#B8B5AE]/80 dark:border-white/20 shadow-[0_18px_40px_rgba(32,33,31,0.08)]">
                <div className="relative aspect-[4/5] overflow-hidden">
                  <Image
                    src="/images/architectural-paint-swatch.jpg"
                    alt="Curated architectural mineral paint swatch study"
                    fill
                    sizes="22vw"
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

        {/* § II — CRAFTSMANSHIP ESSAY (LITERARY DROP-CAP + MARGINALIA) */}
        <section
          id="editorial-essay"
          aria-label="Atelier Preparation Essay"
          className="px-5 sm:px-10 lg:px-16 py-20 sm:py-28 border-b border-[#B8B5AE]/70 dark:border-white/15 bg-[#EFECE4]/65 dark:bg-[#1C1D1A]"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            {/* Left Margin Technical Footnotes */}
            <div className="lg:col-span-3 space-y-6 border-t border-[#20211F]/25 dark:border-white/20 pt-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F] block">
                § II &middot; ATELIER ESSAY
              </span>
              <div className="space-y-4 font-mono text-[10px] leading-relaxed text-[#5C5A55] dark:text-[#B8B5AE]">
                <p>
                  <strong className="text-[#20211F] dark:text-[#F4F1EA] block tracking-[0.18em]">
                    NOTE 01 // SUBSTRATE WME
                  </strong>
                  Digital hygrometer audit below 12% wood-moisture equivalent prior to primer lock.
                </p>
                <p>
                  <strong className="text-[#20211F] dark:text-[#F4F1EA] block tracking-[0.18em]">
                    NOTE 02 // RAKING LIGHT
                  </strong>
                  500-lumen oblique floodlight verification across plasterboard joints before topcoat.
                </p>
                <p>
                  <strong className="text-[#20211F] dark:text-[#F4F1EA] block tracking-[0.18em]">
                    NOTE 03 // CLEAN OCCUPANCY
                  </strong>
                  Negative-pressure masking and Festool HEPA extraction protect lived-in interiors.
                </p>
              </div>
            </div>

            {/* Center Literary Two-Paragraph Essay with Giant Anton Drop Cap */}
            <div className="lg:col-span-5 space-y-6">
              <h2 className="font-display uppercase text-3xl sm:text-5xl leading-[0.96] text-[#20211F] dark:text-[#F4F1EA]">
                Eighty Percent Of Beauty Happens Before Primer.
              </h2>

              <p className="font-sans text-sm sm:text-base text-[#3A3936] dark:text-[#D5D2CA] font-light leading-[1.85]">
                <span className="float-left font-display text-6xl leading-[0.82] pr-3.5 pt-1 text-[#C41E1E]">
                  S
                </span>
                outh Australian daylight is unforgiving. When morning sun rakes across a long hallway
                in Unley or a cantilevered pavilion in Burnside, ordinary roller stipple and drywall
                joint crowns immediately betray hurried workmanship. At Strovyn, our craftsmen spend
                four days calming the substrate for every day spent atomizing pigment.
              </p>

              <p className="font-sans text-sm sm:text-base text-[#3A3936] dark:text-[#D5D2CA] font-light leading-[1.85]">
                Whether consolidating nineteenth-century lime mortar with breathable potassium
                silicates or spraying catalyzed two-pack polyurethane inside a sealed joinery booth,
                each coating system is written as an explicit specification&mdash;documented by film
                build, sheen angle, and substrate compatibility.
              </p>

              <div className="pt-3">
                <Link
                  href="/about"
                  className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-[#7E6340] dark:text-[#C9B28F] border-b border-[#7E6340] dark:border-[#C9B28F] pb-1"
                >
                  <span>Read Studio Governance</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Right Tall Texture Study Plate */}
            <figure className="lg:col-span-4">
              <div className="relative aspect-[3/4] overflow-hidden border border-[#B8B5AE]/70 dark:border-white/15">
                <Image
                  src="/images/painted-texture-detail.jpg"
                  alt="Macro mineral plaster and brush texture detail"
                  fill
                  sizes="(max-width: 1024px) 100vw, 28vw"
                  className="object-cover object-center"
                />
              </div>
              <figcaption className="mt-2.5 font-mono text-[10px] tracking-[0.16em] text-[#5C5A55] dark:text-[#B8B5AE]">
                FIG. 03 &mdash; HAND-TROWELLED MINERAL LIME TEXTURE STUDY
              </figcaption>
            </figure>
          </div>
        </section>

        {/* § III — SIX DISCIPLINES ASYMMETRIC MAGAZINE LOOKBOOK */}
        <section
          id="editorial-lookbook"
          aria-label="Six Coating Disciplines Lookbook"
          className="px-5 sm:px-10 lg:px-16 py-20 sm:py-28 border-b border-[#B8B5AE]/70 dark:border-white/15"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16 pb-6 border-b border-[#20211F]/20 dark:border-white/15">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F] block mb-2">
                § III &middot; CURATED PRACTICE FOLIO
              </span>
              <h2 className="font-display uppercase text-4xl sm:text-6xl leading-[0.94]">
                Six Architectural Disciplines.
              </h2>
            </div>
            <p className="font-sans text-xs sm:text-sm text-[#5C5A55] dark:text-[#B8B5AE] max-w-sm leading-relaxed">
              Presented as an asymmetric material lookbook. Select any plate to inspect full film
              tolerances, process stages, and substrate chemistry.
            </p>
          </div>

          {/* Staggered Two-Column Print Spread (No Uniform Grid, No Accordion) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* Left Lookbook Column (Disciplines I, III, V — Tall Portrait Plates) */}
            <div className="md:col-span-6 space-y-20">
              {leftColumnServices.map((service) => {
                const originalIdx = SERVICES_DATA.findIndex((s) => s.slug === service.slug);
                const roman = ROMAN_NUMERALS[originalIdx] || service.number;
                const plateImg = DISCIPLINE_PLATES[originalIdx] || service.heroImage;
                return (
                  <article key={service.slug} className="group space-y-5">
                    <Link href={`/services/${service.slug}`} className="block overflow-hidden border border-[#B8B5AE]/60 dark:border-white/15">
                      <div className="relative aspect-[4/5] overflow-hidden bg-[#E5E0D5] dark:bg-[#232421]">
                        <Image
                          src={plateImg}
                          alt={service.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 40vw"
                          className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                        />
                      </div>
                    </Link>

                    <div className="flex items-baseline justify-between border-b border-[#B8B5AE]/60 dark:border-white/15 pb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#7E6340] dark:text-[#C9B28F]">
                      <span>FOLIO {roman}</span>
                      <span>{service.category}</span>
                    </div>

                    <h3 className="font-display uppercase text-2xl sm:text-4xl leading-[0.98]">
                      <Link href={`/services/${service.slug}`} className="hover:text-[#C41E1E] dark:hover:text-[#C9B28F] transition-colors">
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
                      className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#20211F] dark:text-[#F4F1EA] group-hover:text-[#C41E1E] dark:group-hover:text-[#C9B28F]"
                    >
                      <span>Read Full Specification</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </article>
                );
              })}
            </div>

            {/* Right Lookbook Column (Disciplines II, IV, VI — Offset Downward + Wide Landscape Plates) */}
            <div className="md:col-span-6 md:mt-28 space-y-20">
              {rightColumnServices.map((service) => {
                const originalIdx = SERVICES_DATA.findIndex((s) => s.slug === service.slug);
                const roman = ROMAN_NUMERALS[originalIdx] || service.number;
                const plateImg = DISCIPLINE_PLATES[originalIdx] || service.heroImage;
                return (
                  <article key={service.slug} className="group space-y-5">
                    <Link href={`/services/${service.slug}`} className="block overflow-hidden border border-[#B8B5AE]/60 dark:border-white/15">
                      <div className="relative aspect-[16/11] overflow-hidden bg-[#E5E0D5] dark:bg-[#232421]">
                        <Image
                          src={plateImg}
                          alt={service.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 40vw"
                          className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                        />
                      </div>
                    </Link>

                    <div className="flex items-baseline justify-between border-b border-[#B8B5AE]/60 dark:border-white/15 pb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#7E6340] dark:text-[#C9B28F]">
                      <span>FOLIO {roman}</span>
                      <span>{service.category}</span>
                    </div>

                    <h3 className="font-display uppercase text-2xl sm:text-4xl leading-[0.98]">
                      <Link href={`/services/${service.slug}`} className="hover:text-[#C41E1E] dark:hover:text-[#C9B28F] transition-colors">
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
                      className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#20211F] dark:text-[#F4F1EA] group-hover:text-[#C41E1E] dark:group-hover:text-[#C9B28F]"
                    >
                      <span>Read Full Specification</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* § IV — TACTILE PAPER SWATCH FOLIO (INTERACTIVE COLOUR ATELIER) */}
        <section
          id="editorial-swatchbook"
          aria-label="Paper Pigment Swatch Folio"
          className="px-5 sm:px-10 lg:px-16 py-20 sm:py-28 border-b border-[#B8B5AE]/70 dark:border-white/15 bg-[#EAE5DA] dark:bg-[#1E1F1C]"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-5 space-y-6">
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F] block">
                § IV &middot; PIGMENT DRAWDOWN ARCHIVE
              </span>
              <h2 className="font-display uppercase text-4xl sm:text-5xl leading-[0.95]">
                Sampled In Real Adelaide Daylight.
              </h2>
              <p className="font-sans text-sm text-[#4A4945] dark:text-[#C8C5BE] font-light leading-relaxed">
                Paint chips viewed under retail fluorescent tubes mislead. Inspect our studio mineral
                palette below, then upload a photograph of your own room into our browser-based
                Visualiser to observe wall shadow and undertone shifts privately.
              </p>

              {/* Active Paper Drawdown Specimen Card */}
              <div className="bg-[#FAF8F3] dark:bg-[#141513] border border-[#B8B5AE] dark:border-white/20 p-5 space-y-4">
                <div
                  className="h-28 w-full border border-black/10 transition-colors duration-500"
                  style={{ backgroundColor: selectedTone.hex }}
                />
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#7E6340] dark:text-[#C9B28F] block">
                      {selectedTone.family}
                    </span>
                    <span className="font-display uppercase text-2xl text-[#20211F] dark:text-[#F4F1EA]">
                      {selectedTone.name}
                    </span>
                  </div>
                  <span className="font-mono text-xs uppercase tracking-[0.18em] text-[#5C5A55] dark:text-[#B8B5AE]">
                    {selectedTone.hex}
                  </span>
                </div>
                <p className="font-sans text-xs text-[#5C5A55] dark:text-[#B8B5AE] leading-relaxed">
                  {selectedTone.description}
                </p>
                <Link
                  href="/visualiser"
                  className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#C41E1E] dark:text-[#C9B28F] font-semibold"
                >
                  <span>Apply In Room Visualiser</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Tactile Paper Chips Grid */}
            <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {swatchSelection.map((swatch, idx) => {
                const active = swatch.id === selectedTone.id;
                return (
                  <button
                    key={swatch.id}
                    type="button"
                    onClick={() => setSelectedTone(swatch)}
                    className={`text-left bg-[#FAF8F3] dark:bg-[#141513] p-3 border transition-all cursor-pointer ${
                      active
                        ? 'border-[#20211F] dark:border-[#F4F1EA] -translate-y-1 shadow-md'
                        : 'border-[#B8B5AE]/70 dark:border-white/15 hover:border-[#7E6340]'
                    }`}
                  >
                    <span
                      className="block aspect-square w-full border border-black/10 mb-3"
                      style={{ backgroundColor: swatch.hex }}
                    />
                    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#7E6340] dark:text-[#C9B28F] block">
                      CHIP 0{idx + 1}
                    </span>
                    <span className="font-sans text-xs font-medium text-[#20211F] dark:text-[#F4F1EA] block truncate mt-0.5">
                      {swatch.name}
                    </span>
                    <span className="font-mono text-[9px] text-[#6A6862] dark:text-[#9E9B93] block mt-0.5">
                      {swatch.hex}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* § V — CASE MONOGRAPH & PRINT BROADSHEET JOURNAL */}
        <section
          id="editorial-monograph"
          aria-label="Case Monograph and Print Journal"
          className="px-5 sm:px-10 lg:px-16 py-20 sm:py-28 border-b border-[#B8B5AE]/70 dark:border-white/15 space-y-20"
        >
          {primaryProject ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
              <div className="lg:col-span-5 space-y-6">
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F] block">
                  § V &middot; ARCHITECTURAL MONOGRAPH
                </span>
                <h2 className="font-display uppercase text-4xl sm:text-5xl leading-[0.95]">
                  {primaryProject.title}
                </h2>
                <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE] border-y border-[#B8B5AE]/60 dark:border-white/15 py-3">
                  <span>{primaryProject.location}</span>
                  <span>&middot;</span>
                  <span>{primaryProject.category}</span>
                  <span>&middot;</span>
                  <span>{primaryProject.year}</span>
                </div>
                <p className="font-sans text-sm text-[#4A4945] dark:text-[#C8C5BE] font-light leading-relaxed">
                  {primaryProject.description}
                </p>
                {primaryProject.scope.length > 0 && (
                  <ul className="space-y-2 border-l border-[#7E6340] pl-4 font-sans text-xs text-[#4A4945] dark:text-[#C8C5BE]">
                    {primaryProject.scope.slice(0, 3).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
                <div className="pt-2 flex flex-wrap items-center gap-6">
                  <Link
                    href={`/projects/${primaryProject.slug}`}
                    className="inline-flex items-center gap-2 bg-[#20211F] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#181917] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.22em] font-semibold"
                  >
                    <span>Read Case Study</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    href="/projects"
                    className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#7E6340] dark:text-[#C9B28F]"
                  >
                    Full Archive &rarr;
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-8 relative aspect-[4/3] overflow-hidden border border-[#B8B5AE]/60 dark:border-white/15">
                  <Image
                    src={primaryProject.heroImage}
                    alt={primaryProject.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 45vw"
                    className="object-cover object-center"
                  />
                </div>
                <div className="sm:col-span-4 relative aspect-[3/4] sm:aspect-auto sm:h-full min-h-[220px] overflow-hidden border border-[#B8B5AE]/60 dark:border-white/15">
                  <Image
                    src={primaryProject.galleryImages[2] || primaryProject.galleryImages[0] || primaryProject.heroImage}
                    alt={`${primaryProject.title} detail`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 20vw"
                    className="object-cover object-center"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="border-y border-[#B8B5AE]/70 dark:border-white/15 py-12 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F] block mb-1">
                  § V &middot; MONOGRAPH ARCHIVE
                </span>
                <p className="font-sans text-sm text-[#5C5A55] dark:text-[#B8B5AE]">
                  Verified commission plates are currently being prepared for editorial publication.
                </p>
              </div>
              <Link href="/projects" className="font-mono text-xs uppercase tracking-[0.2em] underline">
                Open Portfolio Index
              </Link>
            </div>
          )}

          {/* Print Broadsheet 3-Column Field Notes */}
          {articles.length > 0 && (
            <div className="pt-12 border-t border-[#20211F]/20 dark:border-white/15 space-y-8">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F]">
                  TECHNICAL BROADSHEET // FIELD JOURNAL
                </span>
                <Link
                  href="/insights"
                  className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#20211F] dark:text-[#F4F1EA] hover:text-[#C41E1E]"
                >
                  All Essays &rarr;
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#B8B5AE]/70 dark:divide-white/15">
                {articles.map((article, idx) => (
                  <Link
                    key={article.id}
                    href={`/insights/${article.slug}`}
                    className={`group block py-6 md:py-0 ${
                      idx === 0 ? 'md:pr-8' : idx === 1 ? 'md:px-8' : 'md:pl-8'
                    }`}
                  >
                    <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#7E6340] dark:text-[#C9B28F] block mb-2">
                      {article.category} &middot; {article.readTimeLabel}
                    </span>
                    <h3 className="font-display uppercase text-2xl leading-tight group-hover:text-[#C41E1E] dark:group-hover:text-[#C9B28F] transition-colors mb-3">
                      {article.title}
                    </h3>
                    <p className="font-sans text-xs text-[#5C5A55] dark:text-[#B8B5AE] leading-relaxed line-clamp-3">
                      {article.excerpt}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* § VI — VELLUM CORRESPONDENCE SLIP & EDITORIAL COLOPHON */}
        <section
          id="editorial-correspondence"
          aria-label="Atelier Correspondence Slip"
          className="px-5 sm:px-10 lg:px-16 py-20 sm:py-28 bg-[#EFECE4] dark:bg-[#141513]"
        >
          <div className="max-w-4xl border border-[#20211F]/30 dark:border-white/20 bg-[#FAF8F4] dark:bg-[#1B1C19] p-7 sm:p-12 space-y-10">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#B8B5AE]/70 dark:border-white/15 pb-6">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F] block mb-2">
                  § VI &middot; COMMISSION SLIP
                </span>
                <h2 className="font-display uppercase text-3xl sm:text-5xl leading-[0.95]">
                  Begin A Private Consultation.
                </h2>
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE] sm:text-right">
                <span className="block">DESK // GREATER ADELAIDE SA</span>
                <a
                  href={WHATSAPP_DETAILS.chatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#C41E1E] dark:text-[#C9B28F] underline mt-1 inline-block"
                >
                  WhatsApp {WHATSAPP_DETAILS.displayNumber}
                </a>
              </div>
            </div>

            <form action="/contact" method="GET" className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <label className="block space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#5C5A55] dark:text-[#B8B5AE]">
                  Your Name or Practice
                </span>
                <input
                  type="text"
                  name="name"
                  placeholder="e.g. Studio / Homeowner"
                  className="w-full bg-transparent border-b border-[#20211F]/40 dark:border-white/30 py-2.5 font-sans text-sm focus:outline-none focus:border-[#C41E1E]"
                />
              </label>

              <label className="block space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#5C5A55] dark:text-[#B8B5AE]">
                  Suburb &amp; Discipline
                </span>
                <select
                  name="service"
                  defaultValue="Interior Architectural Painting"
                  className="w-full bg-transparent border-b border-[#20211F]/40 dark:border-white/30 py-2.5 font-sans text-sm focus:outline-none focus:border-[#C41E1E] text-[#20211F] dark:text-[#F4F1EA]"
                >
                  {SERVICES_DATA.map((s) => (
                    <option key={s.slug} value={s.title} className="bg-[#FAF8F4] text-[#20211F]">
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>

              <div className="sm:col-span-2 pt-2 flex flex-wrap items-center justify-between gap-4">
                <p className="font-sans text-xs text-[#5C5A55] dark:text-[#B8B5AE]">
                  Continues to our full specification intake with optional architectural plan notes.
                </p>
                <button
                  type="submit"
                  className="inline-flex items-center gap-3 bg-[#C41E1E] hover:bg-[#20211F] text-[#F4F1EA] px-7 py-3.5 font-mono text-[11px] uppercase tracking-[0.22em] font-semibold transition-colors cursor-pointer"
                >
                  <span>Proceed To Intake</span>
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>

          {/* Editorial Colophon */}
          <footer className="mt-16 pt-8 border-t border-[#B8B5AE]/70 dark:border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
            <span>&copy; 2026 STROVYN PAINTING CO. &mdash; ADELAIDE, SOUTH AUSTRALIA</span>
            <div className="flex flex-wrap gap-5">
              <Link href="/privacy" className="hover:text-[#20211F] dark:hover:text-[#F4F1EA]">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-[#20211F] dark:hover:text-[#F4F1EA]">
                Terms
              </Link>
              <Link href="/careers" className="hover:text-[#20211F] dark:hover:text-[#F4F1EA]">
                Careers
              </Link>
              <Link href="/admin/login" className="hover:text-[#20211F] dark:hover:text-[#F4F1EA]">
                Staff Portal
              </Link>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
};
