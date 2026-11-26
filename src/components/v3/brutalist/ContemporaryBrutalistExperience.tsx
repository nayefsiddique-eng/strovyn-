'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Grid, Minus, Moon, Plus, Sun, X } from 'lucide-react';
import { SERVICES_DATA } from '@/data/servicesData';
import { WHATSAPP_DETAILS } from '@/lib/constants';
import { ARCHITECTURAL_WHEEL_COLOURS } from '@/components/home/CircularColourWheel';
import type { PublicProjectDetail } from '@/lib/cms/publicProjects';
import type { PublicArticleSummary } from '@/lib/cms/publicArticles';
import { useV3Theme } from '@/components/v3/shared/V3IntroAndTheme';

export interface ContemporaryBrutalistProps {
  projects: PublicProjectDetail[];
  articles: PublicArticleSummary[];
}

const ELEVATION_PLATES = [
  {
    code: 'ELEV-A',
    label: 'EXTERIOR ENVELOPE',
    src: '/images/architectural-pavilion.jpg',
    alt: 'Contemporary architectural concrete and rendered pavilion elevation',
    spec: 'POTASSIUM SILICATE // CLASS 1 VAPOUR PERMEABLE',
  },
  {
    code: 'ELEV-B',
    label: 'LEVEL 5 INTERIOR',
    src: '/images/projects/adelaide-luxury-residence/living-dining-2.jpg',
    alt: 'Open-plan architectural residence finished to Level 5 standard',
    spec: 'AS/NZS 2311 LEVEL 5 // < 1.5MM DEVIATION OVER 2000MM',
  },
  {
    code: 'ELEV-C',
    label: 'SUBSTRATE TEXTURE',
    src: '/images/painted-texture-detail.jpg',
    alt: 'Macro mineral coating and hand-applied plaster surface study',
    spec: 'SLAKED LIME & MINERAL AGGREGATE // ZERO SYNTHETIC SEALER',
  },
] as const;

const PROTOCOL_CELLS = [
  {
    num: '01',
    code: 'DIAG // WME',
    title: 'DIGITAL SUBSTRATE AUDIT',
    body: 'Moisture equilibrium verified below 12% WME. Friable render, efflorescence, and delaminating alkyds stripped or chemically consolidated before primer specification.',
    surface: 'bg-[#141513] text-[#F4F1EA]',
    accent: 'text-[#C9B28F]',
  },
  {
    num: '02',
    code: 'PREP // L5',
    title: 'RAKING-LIGHT PLANAR SKIM',
    body: 'Full-surface setting compounds machine-sanded under 500-lumen oblique floodlights so northern Adelaide glazing reveals zero joint telegraphing.',
    surface: 'bg-[#F4F1EA] dark:bg-[#1E1F1D] text-[#141513] dark:text-[#F4F1EA]',
    accent: 'text-[#C41E1E]',
  },
  {
    num: '03',
    code: 'HEPA // 99.97',
    title: 'SEALED CONTAINMENT ZONES',
    body: 'Negative-pressure masking, architectural floor armour, and Festool HEPA dust extraction protect occupied residences and bespoke joinery.',
    surface: 'bg-[#C41E1E] text-[#F4F1EA]',
    accent: 'text-[#F4F1EA]',
  },
  {
    num: '04',
    code: 'FILM // MICRON',
    title: 'CALIBRATED ATOMIZATION',
    body: 'HVLP fine-finish and airless micron-controlled application matched to wet-film gauges across dead-flat mattes, 2K polyurethanes, and silicates.',
    surface: 'bg-[#20211F] text-[#F4F1EA]',
    accent: 'text-[#C9B28F]',
  },
] as const;

const DOCK_SECTIONS = [
  { id: 'brutalist-poster', code: '01', label: 'POSTER' },
  { id: 'brutalist-schedule', code: '02', label: 'SCHEDULE' },
  { id: 'brutalist-protocol', code: '03', label: 'PROTOCOL' },
  { id: 'brutalist-plates', code: '04', label: 'PLATES' },
  { id: 'brutalist-terminal', code: '05', label: 'DISPATCH' },
] as const;

export const ContemporaryBrutalistExperience: React.FC<ContemporaryBrutalistProps> = ({
  projects,
  articles,
}) => {
  const { isDark, toggleTheme } = useV3Theme();
  const [mobileGridOpen, setMobileGridOpen] = useState(false);
  const [activeElevation, setActiveElevation] = useState(0);
  const [expandedRow, setExpandedRow] = useState<string>(SERVICES_DATA[0]?.slug ?? '');
  const [activeDock, setActiveDock] = useState<string>('brutalist-poster');
  const [selectedRigColour, setSelectedRigColour] = useState(ARCHITECTURAL_WHEEL_COLOURS[2] || ARCHITECTURAL_WHEEL_COLOURS[0]);

  useEffect(() => {
    const onScroll = () => {
      const probe = window.innerHeight * 0.4;
      for (let i = DOCK_SECTIONS.length - 1; i >= 0; i--) {
        const el = document.getElementById(DOCK_SECTIONS[i].id);
        if (el && el.getBoundingClientRect().top <= probe) {
          setActiveDock(DOCK_SECTIONS[i].id);
          break;
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const currentPlate = ELEVATION_PLATES[activeElevation];
  const primaryProject = projects[0] ?? null;
  const rigSwatches = ARCHITECTURAL_WHEEL_COLOURS.slice(0, 8);

  return (
    <div
      role="main"
      className="min-h-screen bg-[#F4F1EA] dark:bg-[#121311] text-[#141513] dark:text-[#F4F1EA] selection:bg-[#C41E1E] selection:text-[#F4F1EA]"
    >
      {/* =====================================================================
          NAVIGATION DESIGN #3: EXPOSED 2PX BLUEPRINT UTILITY GRID BAR
          + FLOATING BOTTOM STRUCTURAL JUMP DOCK
          ===================================================================== */}
      <header className="sticky top-0 z-40 bg-[#F4F1EA] dark:bg-[#121311] border-b-2 border-[#141513] dark:border-[#F4F1EA]/45">
        <div className="grid grid-cols-12 items-stretch min-h-[58px]">
          {/* Cell 1: Solid Inverted Wordmark Stamp */}
          <Link
            href="/prototype/v3-brutalist"
            className="col-span-6 sm:col-span-5 lg:col-span-3 bg-[#141513] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#121311] px-4 sm:px-6 flex items-center justify-between border-r-2 border-[#141513] dark:border-[#F4F1EA]/45"
          >
            <span className="font-display text-2xl sm:text-3xl tracking-[0.05em] uppercase leading-none">
              STROVYN
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-80">
              SA // SPEC
            </span>
          </Link>

          {/* Cell 2: Standard Stamp (Desktop) */}
          <div className="hidden lg:flex lg:col-span-2 px-4 items-center border-r-2 border-[#141513] dark:border-[#F4F1EA]/45 font-mono text-[10px] uppercase tracking-[0.18em]">
            <span>AS/NZS 2311 &middot; L5</span>
          </div>

          {/* Cell 3: Hard-Bordered Route Cells (Desktop) */}
          <nav
            aria-label="Blueprint Route Cells"
            className="hidden lg:grid lg:col-span-4 grid-cols-4 border-r-2 border-[#141513] dark:border-[#F4F1EA]/45"
          >
            {[
              { label: 'SERVICES', href: '/services' },
              { label: 'ARCHIVE', href: '/projects' },
              { label: 'VISUALISER', href: '/visualiser' },
              { label: 'JOURNAL', href: '/insights' },
            ].map((item, idx) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-center font-mono text-[10px] uppercase tracking-[0.2em] font-semibold hover:bg-[#141513] hover:text-[#F4F1EA] dark:hover:bg-[#F4F1EA] dark:hover:text-[#121311] transition-colors duration-150 ${
                  idx < 3 ? 'border-r-2 border-[#141513] dark:border-[#F4F1EA]/45' : ''
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Cell 4: Theme Polarity Cell */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to Raw Plaster Light Polarity' : 'Switch to Carbon Dark Polarity'}
            className="col-span-2 sm:col-span-2 lg:col-span-1 flex items-center justify-center gap-1.5 border-r-2 border-[#141513] dark:border-[#F4F1EA]/45 font-mono text-[10px] uppercase tracking-[0.18em] hover:bg-[#141513] hover:text-[#F4F1EA] dark:hover:bg-[#F4F1EA] dark:hover:text-[#121311] transition-colors duration-150 cursor-pointer"
          >
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{isDark ? 'RAW' : 'INK'}</span>
          </button>

          {/* Cell 5: Desktop Signal-Red Dispatch OR Mobile Grid Switch */}
          <Link
            href="/contact"
            className="hidden lg:flex lg:col-span-2 bg-[#C41E1E] hover:bg-[#141513] text-[#F4F1EA] px-5 items-center justify-between font-mono text-[11px] uppercase tracking-[0.22em] font-bold transition-colors duration-150"
          >
            <span>SITE AUDIT</span>
            <ArrowUpRight className="h-4 w-4" />
          </Link>

          <button
            type="button"
            onClick={() => setMobileGridOpen((v) => !v)}
            aria-expanded={mobileGridOpen}
            className="lg:hidden col-span-4 sm:col-span-5 bg-[#C41E1E] text-[#F4F1EA] px-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] font-bold"
          >
            <span>{mobileGridOpen ? 'CLOSE' : 'INDEX'}</span>
            {mobileGridOpen ? <X className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
          </button>
        </div>

        {/* Mobile Structural Grid Drawer */}
        {mobileGridOpen && (
          <nav
            aria-label="Mobile Structural Matrix"
            className="lg:hidden border-t-2 border-[#141513] dark:border-[#F4F1EA]/45 bg-[#F4F1EA] dark:bg-[#121311] grid grid-cols-2"
          >
            {[
              { label: '01 // SERVICES', href: '/services' },
              { label: '02 // ARCHIVE', href: '/projects' },
              { label: '03 // VISUALISER', href: '/visualiser' },
              { label: '04 // JOURNAL', href: '/insights' },
              { label: '05 // STUDIO', href: '/about' },
              { label: '06 // STAFF CMS', href: '/admin/login' },
            ].map((cell, i) => (
              <Link
                key={cell.href}
                href={cell.href}
                onClick={() => setMobileGridOpen(false)}
                className={`p-4 font-mono text-xs uppercase tracking-[0.2em] font-semibold border-b-2 border-[#141513] dark:border-[#F4F1EA]/45 ${
                  i % 2 === 0 ? 'border-r-2' : ''
                }`}
              >
                {cell.label}
              </Link>
            ))}
            <Link
              href="/contact"
              onClick={() => setMobileGridOpen(false)}
              className="col-span-2 p-4 bg-[#141513] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#121311] font-mono text-xs uppercase tracking-[0.24em] font-bold flex items-center justify-between"
            >
              <span>INITIATE SITE CONSULTATION</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </nav>
        )}
      </header>

      {/* Floating Bottom-Center Structural Jump Dock (Desktop) */}
      <nav
        aria-label="Blueprint Section Jump Dock"
        className="hidden md:flex fixed bottom-5 left-1/2 -translate-x-1/2 z-30 border-2 border-[#141513] dark:border-[#F4F1EA]/60 bg-[#F4F1EA] dark:bg-[#121311] shadow-[6px_6px_0px_#141513] dark:shadow-[6px_6px_0px_#C41E1E]"
      >
        {DOCK_SECTIONS.map((sec, idx) => {
          const active = activeDock === sec.id;
          return (
            <a
              key={sec.id}
              href={`#${sec.id}`}
              className={`px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.2em] font-semibold transition-colors duration-150 ${
                idx < DOCK_SECTIONS.length - 1
                  ? 'border-r-2 border-[#141513] dark:border-[#F4F1EA]/60'
                  : ''
              } ${
                active
                  ? 'bg-[#C41E1E] text-[#F4F1EA]'
                  : 'text-[#141513] dark:text-[#F4F1EA] hover:bg-[#141513] hover:text-[#F4F1EA] dark:hover:bg-[#F4F1EA] dark:hover:text-[#121311]'
              }`}
            >
              {sec.code} {sec.label}
            </a>
          );
        })}
      </nav>

      {/* =====================================================================
          BLOCK 01: STRUCTURAL POSTER HERO WITH EXPOSED 2PX GRID CELLS
          ===================================================================== */}
      <section
        id="brutalist-poster"
        aria-label="Structural Architectural Poster"
        className="border-b-2 border-[#141513] dark:border-[#F4F1EA]/45"
      >
        {/* Upper Monumental Display Banner */}
        <div className="border-b-2 border-[#141513] dark:border-[#F4F1EA]/45 px-4 sm:px-8 py-5 sm:py-7 flex flex-col lg:flex-row lg:items-end justify-between gap-4 bg-[#EAE6DC] dark:bg-[#181917]">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] space-y-1">
            <span className="inline-block bg-[#141513] text-[#F4F1EA] px-2 py-0.5 font-bold">
              DRAWING NO. STV-01
            </span>
            <span className="block text-[#4A4945] dark:text-[#B8B5AE]">
              ARCHITECTURAL SURFACE ENGINEERING &mdash; GREATER ADELAIDE, SOUTH AUSTRALIA
            </span>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#C41E1E] dark:text-[#C9B28F] font-bold">
            [ ZERO ROUNDED EDGES &middot; ZERO COSMETIC SHORTCUTS ]
          </div>
        </div>

        {/* Main 7 / 5 Structural Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Left 7 Columns: Monumental Poster Typography & Spec Matrix */}
          <div className="lg:col-span-7 lg:border-r-2 border-[#141513] dark:border-[#F4F1EA]/45 flex flex-col justify-between">
            <div className="p-5 sm:p-10 lg:p-12 space-y-6">
              <h1 className="font-display uppercase text-[clamp(3.3rem,7.5vw,7.4rem)] leading-[0.88] tracking-[-0.01em]">
                <span className="block">ZERO-TOLERANCE</span>{' '}
                <span className="inline-block bg-[#C41E1E] text-[#F4F1EA] px-3 py-1 my-1.5">
                  ARCHITECTURAL
                </span>{' '}
                <span className="block">COATING SYSTEMS.</span>
              </h1>

              <p className="font-sans text-sm sm:text-base text-[#2D2E2B] dark:text-[#D5D2CA] max-w-xl leading-relaxed font-normal">
                Engineered wall, facade, lime plaster, and catalyzed 2K joinery finishes built to
                withstand 500-lumen raking inspection light across South Australia&rsquo;s most
                demanding residential and commercial architecture.
              </p>

              <div className="pt-2 flex flex-wrap gap-4">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-3 bg-[#141513] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#121311] hover:bg-[#C41E1E] dark:hover:bg-[#C41E1E] dark:hover:text-[#F4F1EA] px-6 py-4 font-mono text-xs uppercase tracking-[0.22em] font-bold border-2 border-[#141513] dark:border-[#F4F1EA] transition-colors duration-150"
                >
                  <span>BOOK SUBSTRATE AUDIT</span>
                  <ArrowUpRight className="h-4 w-4" />
                </Link>

                <Link
                  href="/visualiser"
                  className="inline-flex items-center gap-3 bg-transparent text-[#141513] dark:text-[#F4F1EA] hover:bg-[#141513] hover:text-[#F4F1EA] dark:hover:bg-[#F4F1EA] dark:hover:text-[#121311] px-6 py-4 font-mono text-xs uppercase tracking-[0.22em] font-bold border-2 border-[#141513] dark:border-[#F4F1EA]/60 transition-colors duration-150"
                >
                  <span>PIGMENT RIG</span>
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Exposed 4-Cell Technical Tolerance Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 border-t-2 border-[#141513] dark:border-[#F4F1EA]/45">
              {[
                { k: 'FLATNESS', v: '< 1.5MM / 2M' },
                { k: 'MOISTURE', v: '< 12% WME' },
                { k: 'EXTRACTION', v: '99.97% HEPA' },
                { k: 'ADHESION', v: 'ASTM CLASS 5B' },
              ].map((spec, idx) => (
                <div
                  key={spec.k}
                  className={`p-4 sm:p-5 bg-[#F4F1EA] dark:bg-[#161715] ${
                    idx < 3 ? 'border-r-2 border-[#141513] dark:border-[#F4F1EA]/45' : ''
                  } ${idx < 2 ? 'border-b-2 sm:border-b-0 border-[#141513] dark:border-[#F4F1EA]/45' : ''}`}
                >
                  <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#7E6340] dark:text-[#C9B28F] block">
                    {spec.k}
                  </span>
                  <span className="font-display text-xl sm:text-2xl uppercase mt-1 block">
                    {spec.v}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right 5 Columns: Tabbed Architectural Elevation Plate */}
          <div className="lg:col-span-5 border-t-2 lg:border-t-0 border-[#141513] dark:border-[#F4F1EA]/45 flex flex-col justify-between bg-[#141513] text-[#F4F1EA]">
            {/* Elevation Selector Tabs */}
            <div className="grid grid-cols-3 border-b-2 border-[#F4F1EA]/30">
              {ELEVATION_PLATES.map((plate, idx) => {
                const active = activeElevation === idx;
                return (
                  <button
                    key={plate.code}
                    type="button"
                    onClick={() => setActiveElevation(idx)}
                    className={`p-3.5 text-left font-mono text-[10px] uppercase tracking-[0.18em] cursor-pointer transition-colors duration-150 ${
                      idx < 2 ? 'border-r-2 border-[#F4F1EA]/30' : ''
                    } ${
                      active
                        ? 'bg-[#C41E1E] text-[#F4F1EA] font-bold'
                        : 'bg-[#141513] text-[#B8B5AE] hover:text-[#F4F1EA]'
                    }`}
                  >
                    <span className="block">{plate.code}</span>
                    <span className="block text-[9px] truncate opacity-85">{plate.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Framed Architectural Plate */}
            <div className="relative aspect-[4/4] sm:aspect-[5/4] lg:flex-1 min-h-[340px] overflow-hidden">
              <Image
                key={currentPlate.src}
                src={currentPlate.src}
                alt={currentPlate.alt}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 42vw"
                className="object-cover object-center"
              />
              {/* Structural Crosshair Stamp */}
              <div className="absolute top-4 left-4 bg-[#141513]/90 border border-[#F4F1EA]/40 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.22em]">
                {currentPlate.code} {'//'} LIVE PLATE
              </div>
            </div>

            {/* Plate Specification Footer */}
            <div className="p-4 sm:p-5 border-t-2 border-[#F4F1EA]/30 font-mono text-[10px] uppercase tracking-[0.2em] flex items-center justify-between gap-4">
              <span className="text-[#C9B28F]">{currentPlate.spec}</span>
              <span>SCALE 1:20</span>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          BLOCK 02: INDUSTRIAL SPECIFICATION SCHEDULE (SERVICES 01–06)
          ===================================================================== */}
      <section
        id="brutalist-schedule"
        aria-label="Specification Schedule of Coating Disciplines"
        className="border-b-2 border-[#141513] dark:border-[#F4F1EA]/45"
      >
        {/* Schedule Header Band */}
        <div className="grid grid-cols-12 border-b-2 border-[#141513] dark:border-[#F4F1EA]/45 bg-[#141513] text-[#F4F1EA] px-5 sm:px-8 py-6 items-end gap-4">
          <div className="col-span-12 md:col-span-8">
            <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#C9B28F] block mb-1">
              SECTION 02 // SCHEDULE OF ARCHITECTURAL FINISHES
            </span>
            <h2 className="font-display uppercase text-4xl sm:text-6xl leading-[0.92]">
              SIX ENGINEERED COATING SYSTEMS.
            </h2>
          </div>
          <div className="col-span-12 md:col-span-4 md:text-right font-mono text-[10px] uppercase tracking-[0.2em] text-[#B8B5AE]">
            CLICK ANY SCHEDULE ROW TO INSPECT PROCESS &amp; SUBSTRATES
          </div>
        </div>

        {/* Column Legend (Desktop) */}
        <div className="hidden lg:grid grid-cols-12 border-b-2 border-[#141513] dark:border-[#F4F1EA]/45 bg-[#EAE6DC] dark:bg-[#181917] font-mono text-[10px] uppercase tracking-[0.22em] font-bold">
          <div className="col-span-1 p-3.5 border-r-2 border-[#141513] dark:border-[#F4F1EA]/45">
            CODE
          </div>
          <div className="col-span-4 p-3.5 border-r-2 border-[#141513] dark:border-[#F4F1EA]/45">
            DISCIPLINE
          </div>
          <div className="col-span-4 p-3.5 border-r-2 border-[#141513] dark:border-[#F4F1EA]/45">
            CHEMICAL MATRIX
          </div>
          <div className="col-span-3 p-3.5">INSPECTION</div>
        </div>

        {/* Schedule Rows */}
        {SERVICES_DATA.map((service, idx) => {
          const isOpen = expandedRow === service.slug;
          return (
            <div
              key={service.slug}
              className={
                idx < SERVICES_DATA.length - 1
                  ? 'border-b-2 border-[#141513] dark:border-[#F4F1EA]/45'
                  : ''
              }
            >
              <button
                type="button"
                onClick={() => setExpandedRow(isOpen ? '' : service.slug)}
                aria-expanded={isOpen}
                className={`w-full text-left grid grid-cols-12 items-stretch transition-colors duration-150 cursor-pointer ${
                  isOpen
                    ? 'bg-[#C41E1E] text-[#F4F1EA]'
                    : 'bg-[#F4F1EA] dark:bg-[#121311] hover:bg-[#EAE6DC] dark:hover:bg-[#1B1C19]'
                }`}
              >
                <div className="col-span-3 sm:col-span-2 lg:col-span-1 p-4 sm:p-5 border-r-2 border-[#141513] dark:border-[#F4F1EA]/45 flex items-center justify-center">
                  <span className="font-display text-3xl sm:text-4xl leading-none">
                    {service.number}
                  </span>
                </div>

                <div className="col-span-7 sm:col-span-8 lg:col-span-4 p-4 sm:p-5 lg:border-r-2 border-[#141513] dark:border-[#F4F1EA]/45 flex flex-col justify-center">
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-80">
                    {service.category}
                  </span>
                  <span className="font-display uppercase text-2xl sm:text-3xl leading-[0.96] mt-0.5">
                    {service.title}
                  </span>
                </div>

                <div className="hidden lg:flex lg:col-span-4 p-5 border-r-2 border-[#141513] dark:border-[#F4F1EA]/45 items-center font-mono text-xs leading-relaxed">
                  {service.chemistry}
                </div>

                <div className="col-span-2 lg:col-span-3 p-4 sm:p-5 flex items-center justify-end lg:justify-between font-mono text-[10px] uppercase tracking-[0.22em] font-bold">
                  <span className="hidden lg:inline">
                    {isOpen ? 'CLOSE DRAWER' : 'OPEN SPECIFICATION'}
                  </span>
                  {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t-2 border-[#141513] dark:border-[#F4F1EA]/45 bg-[#141513] text-[#F4F1EA] grid grid-cols-1 lg:grid-cols-12">
                  {/* Left Technical Spec & 4 Process Cells */}
                  <div className="lg:col-span-8 p-5 sm:p-8 space-y-6 lg:border-r-2 border-[#F4F1EA]/30">
                    <p className="font-sans text-sm sm:text-base text-[#E2DFD7] leading-relaxed max-w-2xl">
                      {service.fullDescription}
                    </p>

                    <div className="p-4 border-2 border-[#F4F1EA]/30 bg-[#1C1D1B] font-mono text-xs text-[#C9B28F]">
                      TOLERANCE STANDARD // {service.tolerances}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-2 border-[#F4F1EA]/30">
                      {service.processSteps.map((step, sIdx) => (
                        <div
                          key={step.step}
                          className={`p-4 ${
                            sIdx < service.processSteps.length - 1
                              ? 'border-b-2 sm:border-b-0 sm:border-r-2 border-[#F4F1EA]/30'
                              : ''
                          }`}
                        >
                          <span className="font-mono text-[10px] text-[#C41E1E] font-bold block">
                            STEP {step.step}
                          </span>
                          <span className="font-display uppercase text-lg block mt-1">
                            {step.title}
                          </span>
                          <p className="font-sans text-xs text-[#B8B5AE] mt-1.5 leading-relaxed">
                            {step.desc}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                      <div className="flex flex-wrap gap-2">
                        {service.substrateSuitability.map((sub) => (
                          <span
                            key={sub}
                            className="border border-[#F4F1EA]/35 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em]"
                          >
                            {sub}
                          </span>
                        ))}
                      </div>

                      <Link
                        href={`/services/${service.slug}`}
                        className="inline-flex items-center gap-2 bg-[#F4F1EA] text-[#141513] hover:bg-[#C9B28F] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.22em] font-bold"
                      >
                        <span>FULL SPECIFICATION</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Right Structural Plate */}
                  <div className="lg:col-span-4 relative min-h-[260px] border-t-2 lg:border-t-0 border-[#F4F1EA]/30">
                    <Image
                      src={service.heroImage}
                      alt={service.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      className="object-cover object-center"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* =====================================================================
          BLOCK 03: CHECKERBOARD CRAFTSMANSHIP PROTOCOL + PIGMENT RIG
          ===================================================================== */}
      <section
        id="brutalist-protocol"
        aria-label="Four-Stage Governance Protocol and Pigment Rig"
        className="border-b-2 border-[#141513] dark:border-[#F4F1EA]/45"
      >
        {/* 4-Cell High-Contrast Structural Checkerboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {PROTOCOL_CELLS.map((cell, idx) => (
            <div
              key={cell.num}
              className={`p-6 sm:p-8 flex flex-col justify-between min-h-[300px] ${cell.surface} ${
                idx < 3 ? 'lg:border-r-2 border-[#141513] dark:border-[#F4F1EA]/45' : ''
              } border-b-2 lg:border-b-0 border-[#141513] dark:border-[#F4F1EA]/45`}
            >
              <div className="flex items-start justify-between">
                <span
                  className="font-display text-6xl leading-none"
                  style={{
                    WebkitTextStroke: '1.5px currentColor',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {cell.num}
                </span>
                <span className={`font-mono text-[10px] uppercase tracking-[0.22em] font-bold ${cell.accent}`}>
                  {cell.code}
                </span>
              </div>

              <div className="space-y-3 pt-10">
                <h3 className="font-display uppercase text-2xl sm:text-3xl leading-[0.95]">
                  {cell.title}
                </h3>
                <p className="font-sans text-xs sm:text-sm opacity-90 leading-relaxed">
                  {cell.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Industrial Pigment Testbed Bar */}
        <div className="border-t-2 border-[#141513] dark:border-[#F4F1EA]/45 grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-5 p-6 sm:p-8 lg:border-r-2 border-[#141513] dark:border-[#F4F1EA]/45 flex flex-col justify-between gap-6">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#C41E1E] dark:text-[#C9B28F] font-bold block mb-2">
                OPTICAL COLOUR RIG // BROWSER SIMULATION
              </span>
              <h3 className="font-display uppercase text-3xl sm:text-4xl leading-[0.94]">
                TEST MINERAL PIGMENTS ON YOUR OWN WALL ELEVATION.
              </h3>
            </div>

            <div className="grid grid-cols-12 border-2 border-[#141513] dark:border-[#F4F1EA]/45">
              <div
                className="col-span-4 min-h-[88px] border-r-2 border-[#141513] dark:border-[#F4F1EA]/45"
                style={{ backgroundColor: selectedRigColour.hex }}
              />
              <div className="col-span-8 p-3.5 bg-[#EAE6DC] dark:bg-[#1A1B19]">
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] block text-[#7E6340] dark:text-[#C9B28F]">
                  {selectedRigColour.family} &middot; {selectedRigColour.hex}
                </span>
                <span className="font-display uppercase text-xl block">
                  {selectedRigColour.name}
                </span>
                <span className="font-sans text-xs text-[#4A4945] dark:text-[#B8B5AE] line-clamp-2 mt-0.5">
                  {selectedRigColour.description}
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-4 border-t-2 lg:border-t-0 border-[#141513] dark:border-[#F4F1EA]/45">
            {rigSwatches.map((swatch, idx) => {
              const active = swatch.id === selectedRigColour.id;
              return (
                <button
                  key={swatch.id}
                  type="button"
                  onClick={() => setSelectedRigColour(swatch)}
                  className={`p-4 flex flex-col justify-between min-h-[132px] text-left cursor-pointer border-[#141513] dark:border-[#F4F1EA]/45 ${
                    idx % 4 !== 3 ? 'border-r-2' : ''
                  } ${idx < 4 ? 'border-b-2' : ''} ${
                    active ? 'ring-2 ring-inset ring-[#C41E1E]' : ''
                  }`}
                  style={{ backgroundColor: swatch.hex }}
                >
                  <span className="inline-block self-start bg-[#141513] text-[#F4F1EA] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em]">
                    {swatch.hex}
                  </span>
                  <span className="inline-block bg-[#F4F1EA] text-[#141513] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.15em] font-bold truncate max-w-full">
                    {swatch.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================================
          BLOCK 04: ARCHITECTURAL CONTACT-SHEET PLATES & TECHNICAL BULLETINS
          ===================================================================== */}
      <section
        id="brutalist-plates"
        aria-label="Verified Commission Contact Sheet"
        className="border-b-2 border-[#141513] dark:border-[#F4F1EA]/45"
      >
        <div className="p-5 sm:p-8 border-b-2 border-[#141513] dark:border-[#F4F1EA]/45 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#7E6340] dark:text-[#C9B28F] font-bold block mb-1">
              SECTION 04 // COMMISSION EVIDENCE
            </span>
            <h2 className="font-display uppercase text-4xl sm:text-6xl leading-[0.92]">
              ARCHITECTURAL CONTACT SHEET.
            </h2>
          </div>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 border-2 border-[#141513] dark:border-[#F4F1EA]/60 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.22em] font-bold hover:bg-[#141513] hover:text-[#F4F1EA] dark:hover:bg-[#F4F1EA] dark:hover:text-[#121311]"
          >
            <span>FULL COMMISSION INDEX</span>
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {primaryProject ? (
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Primary Contact Plate */}
            <Link
              href={`/projects/${primaryProject.slug}`}
              className="group lg:col-span-7 lg:border-r-2 border-[#141513] dark:border-[#F4F1EA]/45 block"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-[#141513]">
                <Image
                  src={primaryProject.heroImage}
                  alt={primaryProject.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 58vw"
                  className="object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <span className="absolute top-4 left-4 bg-[#C41E1E] text-[#F4F1EA] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] font-bold">
                  PLATE 01 // {primaryProject.location}
                </span>
              </div>
            </Link>

            {/* Exposed Spec Data Block */}
            <div className="lg:col-span-5 flex flex-col justify-between border-t-2 lg:border-t-0 border-[#141513] dark:border-[#F4F1EA]/45">
              <div className="p-6 sm:p-8 space-y-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#7E6340] dark:text-[#C9B28F] font-bold">
                  {primaryProject.category} &middot; {primaryProject.lifecycle}
                </span>
                <h3 className="font-display uppercase text-3xl sm:text-5xl leading-[0.94]">
                  {primaryProject.title}
                </h3>
                <p className="font-sans text-sm text-[#3A3936] dark:text-[#C8C5BE] leading-relaxed">
                  {primaryProject.description}
                </p>
              </div>

              <div className="border-t-2 border-[#141513] dark:border-[#F4F1EA]/45 grid grid-cols-2">
                <div className="p-4 border-r-2 border-[#141513] dark:border-[#F4F1EA]/45">
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#7E6340] dark:text-[#C9B28F] block">
                    FINISH SYSTEM
                  </span>
                  <span className="font-mono text-xs font-bold block mt-1 truncate">
                    {primaryProject.finishes || 'LEVEL 5 MATTE'}
                  </span>
                </div>
                <Link
                  href={`/projects/${primaryProject.slug}`}
                  className="p-4 bg-[#141513] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#121311] hover:bg-[#C41E1E] dark:hover:bg-[#C41E1E] dark:hover:text-[#F4F1EA] flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] font-bold"
                >
                  <span>INSPECT CASE</span>
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 font-mono text-xs uppercase tracking-[0.2em]">
            [ ARCHIVE NOTICE: VERIFIED CASE PLATES IN PREPARATION &mdash; VISIT /PROJECTS ]
          </div>
        )}

        {/* 3-Cell Technical Bulletins (CMS Articles) */}
        {articles.length > 0 && (
          <div className="border-t-2 border-[#141513] dark:border-[#F4F1EA]/45 grid grid-cols-1 md:grid-cols-3">
            {articles.map((article, idx) => (
              <Link
                key={article.id}
                href={`/insights/${article.slug}`}
                className={`p-6 sm:p-8 flex flex-col justify-between gap-6 hover:bg-[#141513] hover:text-[#F4F1EA] dark:hover:bg-[#F4F1EA] dark:hover:text-[#121311] transition-colors duration-150 ${
                  idx < articles.length - 1
                    ? 'border-b-2 md:border-b-0 md:border-r-2 border-[#141513] dark:border-[#F4F1EA]/45'
                    : ''
                }`}
              >
                <div className="space-y-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#C41E1E] font-bold block">
                    BULLETIN 0{idx + 1} {'//'} {article.category}
                  </span>
                  <h3 className="font-display uppercase text-2xl leading-tight">
                    {article.title}
                  </h3>
                  <p className="font-sans text-xs opacity-80 line-clamp-2 leading-relaxed">
                    {article.excerpt}
                  </p>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] font-bold inline-flex items-center gap-2">
                  <span>READ BULLETIN</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* =====================================================================
          BLOCK 05: 50/50 SIGNAL-RED & CARBON DISPATCH TERMINAL + COLOPHON
          ===================================================================== */}
      <section
        id="brutalist-terminal"
        aria-label="Consultation Dispatch Terminal"
        className="grid grid-cols-1 lg:grid-cols-12 border-b-2 border-[#141513] dark:border-[#F4F1EA]/45"
      >
        {/* Left Signal-Red Structural Command Block */}
        <div className="lg:col-span-6 bg-[#C41E1E] text-[#F4F1EA] p-6 sm:p-12 lg:border-r-2 border-[#141513] dark:border-[#F4F1EA]/45 flex flex-col justify-between gap-10">
          <div className="space-y-4">
            <span className="inline-block bg-[#141513] text-[#F4F1EA] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.24em] font-bold">
              SECTION 05 // DIRECT DISPATCH
            </span>
            <h2 className="font-display uppercase text-5xl sm:text-7xl leading-[0.88]">
              SPECIFY YOUR NEXT ELEVATION.
            </h2>
            <p className="font-sans text-sm sm:text-base text-white/90 max-w-md leading-relaxed">
              Submit architectural drawings or schedule an on-site moisture and raking-light
              diagnostic anywhere across metropolitan Adelaide and the Adelaide Hills.
            </p>
          </div>

          <div className="border-t-2 border-white/30 pt-5 flex flex-wrap items-center justify-between gap-4 font-mono text-xs uppercase tracking-[0.2em]">
            <span>DIRECT LINE // {WHATSAPP_DETAILS.displayNumber}</span>
            <a
              href={WHATSAPP_DETAILS.chatUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#141513] text-[#F4F1EA] px-4 py-2.5 font-bold inline-flex items-center gap-2"
            >
              <span>WHATSAPP DESK</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Right Carbon Intake Form */}
        <div className="lg:col-span-6 bg-[#141513] text-[#F4F1EA] p-6 sm:p-12 flex flex-col justify-between">
          <form action="/contact" method="GET" className="space-y-5">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#C9B28F] block mb-2">
                01 // CLIENT OR ARCHITECTURAL PRACTICE
              </label>
              <input
                type="text"
                name="name"
                placeholder="ENTER NAME OR STUDIO"
                className="w-full bg-[#1C1D1B] border-2 border-[#F4F1EA]/35 px-4 py-3.5 font-mono text-xs text-[#F4F1EA] placeholder:text-[#7A7872] focus:outline-none focus:border-[#C41E1E]"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#C9B28F] block mb-2">
                02 // PRIMARY COATING DISCIPLINE
              </label>
              <select
                name="service"
                defaultValue="Interior Architectural Painting"
                className="w-full bg-[#1C1D1B] border-2 border-[#F4F1EA]/35 px-4 py-3.5 font-mono text-xs text-[#F4F1EA] focus:outline-none focus:border-[#C41E1E]"
              >
                {SERVICES_DATA.map((s) => (
                  <option key={s.slug} value={s.title} className="bg-[#141513] text-[#F4F1EA]">
                    {s.number} — {s.title.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-[#F4F1EA] hover:bg-[#C9B28F] text-[#141513] py-4 px-6 font-mono text-xs uppercase tracking-[0.24em] font-bold flex items-center justify-between transition-colors duration-150 cursor-pointer"
            >
              <span>OPEN FULL TECHNICAL INTAKE</span>
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </form>

          <div className="pt-8 mt-8 border-t border-[#F4F1EA]/20 font-mono text-[10px] uppercase tracking-[0.2em] text-[#9E9B93] flex flex-wrap justify-between gap-4">
            <span>STROVYN PAINTING CO. &middot; ADELAIDE SA</span>
            <div className="flex flex-wrap gap-4">
              <Link href="/privacy" className="hover:text-[#F4F1EA]">
                PRIVACY
              </Link>
              <Link href="/terms" className="hover:text-[#F4F1EA]">
                TERMS
              </Link>
              <Link href="/careers" className="hover:text-[#F4F1EA]">
                CAREERS
              </Link>
              <Link href="/admin/login" className="hover:text-[#F4F1EA]">
                STAFF CMS
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Clearance for Floating Structural Dock */}
      <div className="h-16 bg-[#141513]" />
    </div>
  );
};
