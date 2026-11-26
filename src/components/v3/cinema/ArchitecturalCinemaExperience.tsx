'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Moon, Plus, Sun, X } from 'lucide-react';
import { SERVICES_DATA } from '@/data/servicesData';
import { WHATSAPP_DETAILS } from '@/lib/constants';
import { ARCHITECTURAL_WHEEL_COLOURS } from '@/components/home/CircularColourWheel';
import type { PublicProjectDetail } from '@/lib/cms/publicProjects';
import type { PublicArticleSummary } from '@/lib/cms/publicArticles';
import { useV3Theme } from '@/components/v3/shared/V3IntroAndTheme';

export interface ArchitecturalCinemaProps {
  projects: PublicProjectDetail[];
  articles: PublicArticleSummary[];
}

const CURTAIN_DESTINATIONS = [
  {
    num: '01',
    title: 'Six Coating Disciplines',
    subtitle: 'Interior, Facade, Millwork, Lime Plaster, Heritage & Commercial',
    href: '/services',
    image: '/images/architectural-pavilion.jpg',
  },
  {
    num: '02',
    title: 'Commission Archive',
    subtitle: 'Documented residential & architectural elevations across Adelaide',
    href: '/projects',
    image: '/images/projects/adelaide-luxury-residence/living-dining-2.jpg',
  },
  {
    num: '03',
    title: 'Wall Colour Visualiser',
    subtitle: 'Private browser-side pigment & sheen simulation on your room photo',
    href: '/visualiser',
    image: '/images/architectural-paint-swatch.jpg',
  },
  {
    num: '04',
    title: 'Technical Field Notes',
    subtitle: 'Essays on substrate moisture, Level 5 skimming & raking light',
    href: '/insights',
    image: '/images/painted-texture-detail.jpg',
  },
  {
    num: '05',
    title: 'Studio Philosophy & Careers',
    subtitle: 'Preparation governance, HEPA extraction & specialist trades',
    href: '/about',
    image: '/images/projects/adelaide-luxury-residence/kitchen-island-patio-3.jpg',
  },
  {
    num: '06',
    title: 'Initiate Consultation',
    subtitle: 'On-site substrate diagnostics & itemised Adelaide schedules',
    href: '/contact',
    image: '/images/projects/adelaide-luxury-residence/living-kitchen-1.jpg',
  },
] as const;

const CRAFT_REELS = [
  {
    act: 'ACT I // DIAGNOSTICS',
    title: 'Moisture & Planar Truth Before Pigment.',
    copy: 'Every elevation is audited with digital moisture meters (< 12% WME) and 2-metre straightedges before a primer tin is opened. Unstable coatings are remediated; substrates are consolidated.',
    image: '/images/painted-texture-detail.jpg',
    caption: 'Substrate preparation & HEPA dust-extracted orbital sanding',
  },
  {
    act: 'ACT II // ATMOSPHERE',
    title: 'Calibrated Under 500-Lumen Raking Light.',
    copy: 'South Australian northern daylight exposes every joint telegraph and roller stipple. We flood wall and ceiling planes with grazing inspection beams between micro-skim passes to achieve AS/NZS 2311 Level 5 calm.',
    image: '/images/projects/adelaide-luxury-residence/living-kitchen-1.jpg',
    caption: 'Adelaide Residence — seamless ceiling-to-wall shadowline junction',
  },
  {
    act: 'ACT III // CHEMISTRY',
    title: 'Mineral Silicates, Slaked Lime & 2K Lacquers.',
    copy: 'From breathable potassium silicates that petrify into exterior masonry to catalyzed 2K polyurethane joinery finishes and zero-VOC interior mattes, chemistry is matched strictly to architectural use.',
    image: '/images/architectural-paint-swatch.jpg',
    caption: 'Curated mineral drawdowns tested in project-specific daylight',
  },
] as const;

export const ArchitecturalCinemaExperience: React.FC<ArchitecturalCinemaProps> = ({
  projects,
  articles,
}) => {
  const { isDark, toggleTheme } = useV3Theme();
  const shouldReduceMotion = useReducedMotion();
  const [curtainOpen, setCurtainOpen] = useState(false);
  const [hoveredCurtainIdx, setHoveredCurtainIdx] = useState(0);
  const [activeServiceIdx, setActiveServiceIdx] = useState(0);
  const [activeReelIdx, setActiveReelIdx] = useState(0);
  const [activeSwatch, setActiveSwatch] = useState(ARCHITECTURAL_WHEEL_COLOURS[0]);
  const [reelNumber, setReelNumber] = useState('01');

  useEffect(() => {
    const ids = ['cinema-hero', 'cinema-craft', 'cinema-disciplines', 'cinema-commissions', 'cinema-finale'];
    const onScroll = () => {
      const mid = window.innerHeight * 0.45;
      for (let i = ids.length - 1; i >= 0; i--) {
        const el = document.getElementById(ids[i]);
        if (el && el.getBoundingClientRect().top <= mid) {
          setReelNumber(`0${i + 1}`);
          break;
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!curtainOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCurtainOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [curtainOpen]);

  const primaryProject = projects[0] ?? null;

  return (
    <div
      role="main"
      data-v3-concept="cinema"
      className="relative w-full min-h-screen overflow-x-hidden bg-[#0E0F0E] text-[#F4F1EA] selection:bg-[#C41E1E] selection:text-white"
    >
      {/* =====================================================================
          NAVIGATION CONCEPT A: 4-CORNER FILM-GATE HUD + FULLSCREEN CURTAIN
          (No top horizontal navbar bar — floating architectural corner anchors)
          ===================================================================== */}
      <header aria-label="Cinema corner navigation">
        {/* Top-Left Corner Anchor: Brand Mark + Live Reel Indicator */}
        <div className="fixed top-4 left-4 sm:top-7 sm:left-8 z-50 flex items-center gap-3 bg-[#0E0F0E]/80 border border-white/15 px-3.5 py-2 backdrop-blur-none">
          <Link
            href="/prototype/v3-cinema"
            className="font-display text-xl sm:text-2xl uppercase tracking-[0.05em] text-[#F4F1EA] leading-none"
          >
            STROVYN
          </Link>
          <span className="h-1.5 w-1.5 bg-[#C41E1E]" aria-hidden="true" />
          <span className="font-mono text-[10px] tracking-[0.24em] text-[#C9B28F] uppercase">
            REEL {reelNumber} / 05
          </span>
        </div>

        {/* Top-Right Corner Anchor: Theme + Fullscreen Curtain Index Trigger */}
        <div className="fixed top-4 right-4 sm:top-7 sm:right-8 z-50 flex items-center gap-2">
          <Link
            href="/contact"
            className="hidden md:inline-flex h-10 items-center gap-2 bg-[#C41E1E] hover:bg-[#A01818] text-white px-4 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors"
          >
            <span>Commission</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to warm cinema light' : 'Switch to obsidian darkroom'}
            className="inline-flex h-10 w-10 items-center justify-center bg-[#0E0F0E]/85 border border-white/20 text-[#F4F1EA] hover:border-[#C9B28F] cursor-pointer transition-colors"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => setCurtainOpen(true)}
            aria-expanded={curtainOpen}
            aria-controls="cinema-curtain-menu"
            data-testid="cinema-index-trigger"
            className="inline-flex h-10 items-center gap-2.5 bg-[#F4F1EA] text-[#141513] hover:bg-[#C9B28F] px-4 font-mono text-[11px] uppercase tracking-[0.22em] font-semibold cursor-pointer transition-colors"
          >
            <span>Index</span>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {/* Bottom-Left Film Gate Datum (Desktop only so mobile stays clean) */}
        <div
          aria-hidden="true"
          className="hidden xl:flex fixed bottom-6 left-8 z-40 items-center gap-3 font-mono text-[10px] tracking-[0.24em] uppercase text-[#B8B5AE]/80 pointer-events-none"
        >
          <span className="inline-block h-px w-8 bg-[#A78B65]" />
          <span>34.9285&deg; S &middot; 138.6007&deg; E &mdash; ADELAIDE</span>
        </div>
      </header>

      {/* Fullscreen Split Photographic Curtain Menu */}
      <AnimatePresence>
        {curtainOpen && (
          <motion.div
            id="cinema-curtain-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Strovyn Studio Directory"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="fixed inset-0 z-[90] grid grid-cols-1 lg:grid-cols-12 bg-[#0E0F0E] text-[#F4F1EA]"
          >
            {/* Left Photographic Preview Stage (Desktop) */}
            <div className="hidden lg:block lg:col-span-5 relative overflow-hidden border-r border-white/12">
              <Image
                src={CURTAIN_DESTINATIONS[hoveredCurtainIdx].image}
                alt={CURTAIN_DESTINATIONS[hoveredCurtainIdx].title}
                fill
                sizes="42vw"
                className="object-cover object-center opacity-75 transition-all duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0E0F0E] via-[#0E0F0E]/25 to-transparent" />
              <div className="absolute bottom-10 left-10 right-10 space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#C9B28F] block">
                  PREVIEW // {CURTAIN_DESTINATIONS[hoveredCurtainIdx].num}
                </span>
                <p className="font-sans text-sm text-[#E4E0D8]">
                  {CURTAIN_DESTINATIONS[hoveredCurtainIdx].subtitle}
                </p>
              </div>
            </div>

            {/* Right Directory Stage */}
            <div className="lg:col-span-7 flex flex-col justify-between p-6 sm:p-10 lg:p-14 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-white/15 pb-5">
                <span className="font-mono text-[11px] uppercase tracking-[0.26em] text-[#C9B28F]">
                  STROVYN // STUDIO INDEX
                </span>
                <button
                  type="button"
                  onClick={() => setCurtainOpen(false)}
                  aria-label="Close studio index"
                  className="inline-flex h-10 items-center gap-2 border border-white/25 px-3.5 font-mono text-[11px] uppercase tracking-[0.2em] text-[#F4F1EA] hover:border-[#C9B28F] cursor-pointer"
                >
                  <span>Close</span>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav aria-label="Full studio routes" className="my-auto py-8 divide-y divide-white/12">
                {CURTAIN_DESTINATIONS.map((item, idx) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onMouseEnter={() => setHoveredCurtainIdx(idx)}
                    onClick={() => setCurtainOpen(false)}
                    className="group py-4 sm:py-5 flex items-baseline justify-between gap-4"
                  >
                    <div className="flex items-baseline gap-5">
                      <span className="font-mono text-xs text-[#C41E1E]">{item.num}</span>
                      <span className="font-display text-3xl sm:text-5xl uppercase tracking-tight text-[#F4F1EA] group-hover:text-[#C9B28F] transition-colors">
                        {item.title}
                      </span>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-[#B8B5AE] group-hover:text-[#C9B28F] shrink-0" />
                  </Link>
                ))}
              </nav>

              <div className="border-t border-white/15 pt-5 flex flex-wrap items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.2em] text-[#B8B5AE]">
                <a href={WHATSAPP_DETAILS.chatUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                  WhatsApp {WHATSAPP_DETAILS.internationalDisplay}
                </a>
                <Link href="/careers" onClick={() => setCurtainOpen(false)} className="hover:text-white">
                  Careers
                </Link>
                <Link href="/" onClick={() => setCurtainOpen(false)} className="text-[#C9B28F] hover:text-white">
                  Production Site &rarr;
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          REEL 01: FULL-SCREEN PHOTOGRAPHIC HERO & MONUMENTAL MASTHEAD
          ===================================================================== */}
      <section
        id="cinema-hero"
        aria-label="Architectural Cinema Opening"
        className="relative h-[100svh] min-h-[680px] w-full overflow-hidden flex flex-col justify-between"
      >
        <motion.div
          initial={shouldReduceMotion ? false : { scale: 1.07 }}
          animate={{ scale: 1 }}
          transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        >
          <Image
            src="/images/projects/adelaide-luxury-residence/living-dining-2.jpg"
            alt="Completed Adelaide Residence open-plan interior finished by Strovyn Painting Co."
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0E0F0E]/65 via-[#0E0F0E]/28 to-[#0E0F0E]/95" />
        </motion.div>

        {/* Asymmetric Upper-Right Director's Epigraph */}
        <div className="relative z-10 pt-24 sm:pt-28 px-5 sm:px-10 lg:px-16 flex justify-end">
          <div className="max-w-sm border-l border-[#C9B28F]/70 pl-5 py-1 space-y-3 bg-[#0E0F0E]/55 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#C9B28F]">
              ARCHITECTURAL SURFACE ATELIER
            </p>
            <p className="font-sans text-xs sm:text-sm text-[#EAE6DD] font-light leading-relaxed">
              We engineer light-calm walls, breathable mineral facades, and furniture-grade
              joinery finishes for South Australia&apos;s finest residences.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-1 font-mono text-[10px] uppercase tracking-[0.2em]">
              <Link href="/visualiser" className="text-[#C9B28F] hover:text-white inline-flex items-center gap-1">
                <span>Test Wall Colours</span>
                <ArrowUpRight className="h-3 w-3" />
              </Link>
              <Link href="/projects" className="text-[#F4F1EA]/85 hover:text-white">
                View Film Stills &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Edge-to-Edge Monumental Typography */}
        <div className="relative z-10 px-4 sm:px-8 lg:px-12 pb-20 sm:pb-10 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/20 pb-4">
            <span className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.28em] text-[#C9B28F]">
              ARCHITECTURE IN LIGHT &middot; LEVEL 5 PREPARATION
            </span>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2.5 bg-[#C41E1E] hover:bg-[#A01818] text-white px-5 py-3 font-mono text-[11px] uppercase tracking-[0.22em] transition-colors"
            >
              <span>Request Site Walkthrough</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <h1 className="font-display uppercase text-[clamp(4.1rem,16.2vw,14.8rem)] leading-[0.82] tracking-[-0.02em] text-[#F4F1EA] select-none">
            STROVYN
          </h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pr-32 sm:pr-64 font-sans text-xs sm:text-sm text-[#D6D4CF] tracking-wide">
            <span>Transforming Spaces. Perfecting Every Finish.</span>
            <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.24em] text-[#C9B28F]">
              &middot; Greater Adelaide, South Australia
            </span>
          </div>
        </div>
      </section>

      {/* =====================================================================
          REEL 02: CRAFTSMANSHIP DIPTYCH (50vw Sticky Macro Frame + Chapter Scroll)
          ===================================================================== */}
      <section
        id="cinema-craft"
        aria-label="Surface Craftsmanship Triptych"
        className="relative w-full border-t border-white/12 bg-[#EAE4D8] dark:bg-[#151614] text-[#20211F] dark:text-[#F4F1EA]"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Sticky Full-Bleed Half-Screen Visual Plate */}
          <div className="lg:col-span-6 lg:sticky lg:top-0 lg:h-screen relative min-h-[380px] sm:min-h-[480px] overflow-hidden bg-[#111210]">
            <Image
              src={CRAFT_REELS[activeReelIdx].image}
              alt={CRAFT_REELS[activeReelIdx].caption}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center transition-all duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0E0F0E]/85 via-transparent to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4 text-[#F4F1EA]">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#C9B28F] block mb-1">
                  {CRAFT_REELS[activeReelIdx].act}
                </span>
                <p className="font-sans text-xs text-[#D6D4CF]">
                  {CRAFT_REELS[activeReelIdx].caption}
                </p>
              </div>
              <div className="flex gap-1.5">
                {CRAFT_REELS.map((r, i) => (
                  <button
                    key={r.act}
                    type="button"
                    aria-label={`Select ${r.act}`}
                    onClick={() => setActiveReelIdx(i)}
                    className={`h-1.5 w-7 cursor-pointer transition-colors ${
                      i === activeReelIdx ? 'bg-[#C41E1E]' : 'bg-white/30'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Narrative Column: Generous Cinema Pacing + Interactive Pigment Strip */}
          <div className="lg:col-span-6 px-6 sm:px-12 lg:px-16 py-20 lg:py-28 space-y-20">
            {CRAFT_REELS.map((chapter, idx) => (
              <motion.article
                key={chapter.act}
                onViewportEnter={() => setActiveReelIdx(idx)}
                viewport={{ amount: 0.55 }}
                className="space-y-5 border-l-2 border-[#7E6340] dark:border-[#C9B28F] pl-6 sm:pl-8"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F] block">
                  {chapter.act}
                </span>
                <h2 className="font-display uppercase text-3xl sm:text-5xl leading-[0.96] text-[#20211F] dark:text-[#F4F1EA]">
                  {chapter.title}
                </h2>
                <p className="font-sans text-sm sm:text-base text-[#434440] dark:text-[#D6D4CF] leading-relaxed font-light">
                  {chapter.copy}
                </p>
              </motion.article>
            ))}

            {/* Integrated Atmospheric Pigment Selector -> Wall Visualiser */}
            <div className="pt-8 border-t border-[#20211F]/15 dark:border-white/15 space-y-5">
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#7E6340] dark:text-[#C9B28F]">
                  LIGHT-RESPONSE SWATCH REEL
                </span>
                <span className="font-mono text-xs uppercase text-[#20211F] dark:text-[#F4F1EA]">
                  {activeSwatch.name} ({activeSwatch.hex})
                </span>
              </div>

              <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="Curated mineral tones">
                {ARCHITECTURAL_WHEEL_COLOURS.slice(0, 8).map((sw) => (
                  <button
                    key={sw.id}
                    type="button"
                    onClick={() => setActiveSwatch(sw)}
                    aria-label={sw.name}
                    aria-checked={activeSwatch.id === sw.id}
                    role="radio"
                    style={{ backgroundColor: sw.hex }}
                    className={`h-12 w-full cursor-pointer transition-transform ${
                      activeSwatch.id === sw.id
                        ? 'ring-2 ring-[#C41E1E] -translate-y-1'
                        : 'opacity-85 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>

              <p className="font-sans text-xs text-[#434440] dark:text-[#B8B5AE]">
                {activeSwatch.description}
              </p>

              <Link
                href={`/visualiser?color=${encodeURIComponent(activeSwatch.hex)}&finish=${encodeURIComponent(activeSwatch.name)}`}
                className="inline-flex items-center gap-2.5 bg-[#20211F] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#141513] hover:bg-[#7E6340] px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors"
              >
                <span>Project Tone onto Your Wall</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          REEL 03: HORIZONTAL EXPANDING FILMSTRIP ACCORDION (6 DISCIPLINES)
          (Zero cards — edge-to-edge interactive architectural slices)
          ===================================================================== */}
      <section
        id="cinema-disciplines"
        aria-label="Six Architectural Coating Disciplines"
        className="w-full bg-[#0E0F0E] text-[#F4F1EA] border-t border-white/12 py-16 sm:py-24"
      >
        <div className="px-5 sm:px-10 lg:px-16 pb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#C9B28F] block mb-2">
              REEL 03 // DISCIPLINE SPECTRUM
            </span>
            <h2 className="font-display uppercase text-4xl sm:text-6xl lg:text-7xl leading-[0.92]">
              Six Architectural Finishes.
            </h2>
          </div>
          <Link
            href="/services"
            className="font-mono text-xs uppercase tracking-[0.22em] text-[#C9B28F] hover:text-white inline-flex items-center gap-2"
          >
            <span>Full Technical Index</span>
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Desktop Expanding Horizontal Curtain Strip / Mobile Stacked Cinema Panels */}
        <div className="flex flex-col lg:flex-row w-full lg:h-[68vh] lg:min-h-[520px] border-y border-white/15">
          {SERVICES_DATA.map((service, idx) => {
            const expanded = idx === activeServiceIdx;
            return (
              <div
                key={service.slug}
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                onMouseEnter={() => setActiveServiceIdx(idx)}
                onClick={() => setActiveServiceIdx(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveServiceIdx(idx);
                  }
                }}
                className={`relative overflow-hidden border-b lg:border-b-0 lg:border-r border-white/15 cursor-pointer transition-[flex] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  expanded ? 'lg:flex-[4.4] min-h-[340px]' : 'lg:flex-[0.85] min-h-[84px]'
                }`}
              >
                <Image
                  src={service.heroImage}
                  alt={service.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 55vw"
                  className={`object-cover object-center transition-all duration-700 ${
                    expanded ? 'opacity-65 scale-100' : 'opacity-25 scale-105'
                  }`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0E0F0E] via-[#0E0F0E]/45 to-[#0E0F0E]/30" />

                <div className="relative z-10 h-full p-5 sm:p-7 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs tracking-[0.24em] text-[#C41E1E] font-semibold">
                      {service.number}
                    </span>
                    {expanded && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#C9B28F]">
                        {service.category}
                      </span>
                    )}
                  </div>

                  {expanded ? (
                    <div className="space-y-4 max-w-xl pt-12">
                      <h3 className="font-display uppercase text-3xl sm:text-5xl leading-[0.95] text-[#F4F1EA]">
                        {service.title}
                      </h3>
                      <p className="font-sans text-xs sm:text-sm text-[#E2DFD7] leading-relaxed">
                        {service.fullDescription}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#C9B28F]">
                        {service.tolerances}
                      </p>
                      <div className="pt-2 flex flex-wrap items-center gap-4">
                        <Link
                          href={`/services/${service.slug}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-2 bg-[#F4F1EA] text-[#141513] hover:bg-[#C9B28F] px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] font-semibold"
                        >
                          <span>Enter Specification</span>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                        <Link
                          href={`/contact?service=${encodeURIComponent(service.title)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/85 hover:text-[#C9B28F]"
                        >
                          Commission Discipline &rarr;
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="flex lg:h-full items-center lg:items-end">
                      <span className="font-display uppercase text-xl lg:text-2xl tracking-wider text-[#F4F1EA]/85 lg:[writing-mode:vertical-rl] lg:rotate-180">
                        {service.title}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          REEL 04: WIDESCREEN 21:9 COMMISSION PLATES & FIELD JOURNAL
          ===================================================================== */}
      <section
        id="cinema-commissions"
        aria-label="Selected Architectural Film Stills"
        className="w-full bg-[#141513] text-[#F4F1EA] py-20 sm:py-28 px-5 sm:px-10 lg:px-16 space-y-16"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/15 pb-8">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#C9B28F] block mb-2">
              REEL 04 // DOCUMENTED COMMISSIONS
            </span>
            <h2 className="font-display uppercase text-4xl sm:text-6xl leading-[0.94]">
              Adelaide In Natural Light.
            </h2>
          </div>
          <Link
            href="/projects"
            className="font-mono text-xs uppercase tracking-[0.22em] text-[#F4F1EA] border border-white/25 hover:border-[#C9B28F] px-5 py-3 inline-flex items-center gap-2 self-start"
          >
            <span>All Commissions</span>
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {primaryProject ? (
          <div className="space-y-12">
            {/* Widescreen Cinema Scope Frame */}
            <Link
              href={`/projects/${primaryProject.slug}`}
              className="group block relative aspect-[4/3] sm:aspect-[16/9] lg:aspect-[21/9] w-full overflow-hidden bg-[#0E0F0E]"
            >
              <Image
                src={primaryProject.heroImage}
                alt={primaryProject.title}
                fill
                sizes="100vw"
                className="object-cover object-center transition-transform duration-1000 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0E0F0E]/90 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 sm:bottom-10 sm:left-10 sm:right-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#C9B28F] block mb-1.5">
                    {primaryProject.category} &middot; {primaryProject.location}
                  </span>
                  <h3 className="font-display uppercase text-3xl sm:text-5xl text-[#F4F1EA]">
                    {primaryProject.title}
                  </h3>
                </div>
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#F4F1EA] group-hover:text-[#C9B28F] inline-flex items-center gap-2">
                  <span>Open Case Study</span>
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>
            </Link>

            {/* Asymmetric Stills Strip */}
            {primaryProject.galleryImages.length >= 2 && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
                <div className="md:col-span-7 relative aspect-[16/10] overflow-hidden bg-[#0E0F0E]">
                  <Image
                    src={primaryProject.galleryImages[1] || primaryProject.galleryImages[0]}
                    alt={`${primaryProject.title} interior junction detail`}
                    fill
                    sizes="(max-width: 768px) 100vw, 58vw"
                    className="object-cover object-center"
                  />
                </div>
                <div className="md:col-span-5 space-y-5">
                  <p className="font-sans text-sm sm:text-base text-[#D6D4CF] font-light leading-relaxed">
                    {primaryProject.description}
                  </p>
                  <div className="border-t border-white/15 pt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[#C9B28F]">
                    SPECIFIED FINISHES // {primaryProject.finishes || 'ARCHITECTURAL MATTE & TRIM ENAMEL'}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-14 border-y border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <p className="font-sans text-sm text-[#B8B5AE]">
              Commission photography reels are currently being curated for public release.
            </p>
            <Link href="/projects" className="font-mono text-xs uppercase tracking-[0.2em] text-[#C9B28F]">
              Visit Archive &rarr;
            </Link>
          </div>
        )}

        {/* Minimal Cinema Credits for Published Editorial Insights */}
        {articles.length > 0 && (
          <div className="pt-10 border-t border-white/15 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#C9B28F]">
                FIELD NOTES // PUBLISHED JOURNAL
              </span>
              <Link href="/insights" className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#B8B5AE] hover:text-white">
                All Notes &rarr;
              </Link>
            </div>
            <div className="divide-y divide-white/12 border-y border-white/12">
              {articles.slice(0, 3).map((art, i) => (
                <Link
                  key={art.id}
                  href={`/insights/${art.slug}`}
                  className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="flex items-baseline gap-4">
                    <span className="font-mono text-xs text-[#C41E1E]">0{i + 1}</span>
                    <h4 className="font-display uppercase text-xl sm:text-2xl text-[#F4F1EA] group-hover:text-[#C9B28F] transition-colors">
                      {art.title}
                    </h4>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#B8B5AE] shrink-0 inline-flex items-center gap-1.5">
                    <span>{art.category}</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* =====================================================================
          REEL 05: CONSULTATION FINALE & MONUMENTAL CINEMA COLOPHON
          ===================================================================== */}
      <footer id="cinema-finale" aria-label="Consultation and studio colophon">
        <div className="grid grid-cols-1 lg:grid-cols-12 border-t border-white/15">
          {/* Brand Red Dramatic Statement Half */}
          <div className="lg:col-span-6 bg-[#C41E1E] text-white p-8 sm:p-14 lg:p-20 flex flex-col justify-between gap-10">
            <div className="space-y-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/85 block">
                REEL 05 // PRIVATE WALKTHROUGH
              </span>
              <h2 className="font-display uppercase text-5xl sm:text-7xl leading-[0.9]">
                Begin The Commission.
              </h2>
              <p className="font-sans text-sm sm:text-base text-white/90 max-w-md font-light leading-relaxed">
                Invite our lead estimator to inspect your residence, heritage facade, or
                commercial interior across Greater Adelaide.
              </p>
            </div>

            <div className="space-y-3 font-mono text-xs uppercase tracking-[0.2em]">
              <a
                href={WHATSAPP_DETAILS.chatUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#0E0F0E] text-white px-5 py-3.5 hover:bg-black transition-colors"
              >
                <span>Direct WhatsApp ({WHATSAPP_DETAILS.internationalDisplay})</span>
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Minimalist Underlined Darkroom Brief Form */}
          <div className="lg:col-span-6 bg-[#0E0F0E] text-[#F4F1EA] p-8 sm:p-14 lg:p-20">
            <form action="/contact" method="GET" className="space-y-7">
              <div>
                <label htmlFor="cinema-name" className="block font-mono text-[10px] uppercase tracking-[0.24em] text-[#C9B28F] mb-2">
                  01 / Your Name *
                </label>
                <input
                  id="cinema-name"
                  name="name"
                  type="text"
                  required
                  placeholder="Full name"
                  className="w-full bg-transparent border-0 border-b border-white/30 py-3 text-base font-sans text-white placeholder:text-[#8E8B82] focus:outline-none focus:border-[#C9B28F]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-7">
                <div>
                  <label htmlFor="cinema-email" className="block font-mono text-[10px] uppercase tracking-[0.24em] text-[#C9B28F] mb-2">
                    02 / Email *
                  </label>
                  <input
                    id="cinema-email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@domain.com"
                    className="w-full bg-transparent border-0 border-b border-white/30 py-3 text-base font-sans text-white placeholder:text-[#8E8B82] focus:outline-none focus:border-[#C9B28F]"
                  />
                </div>
                <div>
                  <label htmlFor="cinema-suburb" className="block font-mono text-[10px] uppercase tracking-[0.24em] text-[#C9B28F] mb-2">
                    03 / Adelaide Suburb
                  </label>
                  <input
                    id="cinema-suburb"
                    name="location"
                    type="text"
                    placeholder="e.g. Unley, North Adelaide"
                    className="w-full bg-transparent border-0 border-b border-white/30 py-3 text-base font-sans text-white placeholder:text-[#8E8B82] focus:outline-none focus:border-[#C9B28F]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="cinema-service" className="block font-mono text-[10px] uppercase tracking-[0.24em] text-[#C9B28F] mb-2">
                  04 / Primary Scope
                </label>
                <select
                  id="cinema-service"
                  name="service"
                  defaultValue="Interior Precision Painting"
                  className="w-full bg-[#161715] border border-white/25 px-3.5 py-3 text-sm font-sans text-white focus:outline-none focus:border-[#C9B28F]"
                >
                  <option value="Interior Precision Painting">Interior Architectural Painting</option>
                  <option value="Exterior Cladding & Facade Protection">Exterior Facade &amp; Mineral Coatings</option>
                  <option value="Cabinet Refinishing & Spraying">Fine Cabinetry &amp; 2K Lacquering</option>
                  <option value="Woodwork & Architectural Trim">Artisanal Plasters &amp; Lime Washes</option>
                  <option value="Commercial & Heritage Painting">Heritage &amp; Commercial Finishes</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-[#F4F1EA] hover:bg-[#C9B28F] text-[#0E0F0E] font-mono text-xs uppercase tracking-[0.24em] font-semibold cursor-pointer transition-colors"
              >
                Transmit Project Coordinates &rarr;
              </button>
            </form>
          </div>
        </div>

        {/* Colophon Bar */}
        <div className="bg-[#090A09] border-t border-white/10 px-5 sm:px-10 lg:px-16 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[#B8B5AE]">
          <span>&copy; 2026 STROVYN PAINTING CO. &middot; ADELAIDE SA</span>
          <div className="flex flex-wrap gap-6">
            <Link href="/services" className="hover:text-white">Services</Link>
            <Link href="/projects" className="hover:text-white">Projects</Link>
            <Link href="/visualiser" className="hover:text-white">Visualiser</Link>
            <Link href="/insights" className="hover:text-white">Insights</Link>
            <Link href="/careers" className="hover:text-white">Careers</Link>
            <Link href="/feedback" className="hover:text-white">Feedback</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
