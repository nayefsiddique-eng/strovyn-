'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, BookOpen, Lock, Moon, Plus, Sun, X } from 'lucide-react';
import { WHATSAPP_DETAILS } from '@/lib/constants';
import { SERVICES_DATA } from '@/data/servicesData';

export interface MonographNavEntry {
  roman: string;
  label: string;
  subtitle: string;
  href: string;
  previewImage: string;
}

export const V3_MONOGRAPH_NAV: MonographNavEntry[] = [
  {
    roman: 'I',
    label: 'Frontispiece',
    subtitle: 'Architectural overview, finish studio & selected works',
    href: '/',
    previewImage: '/images/projects/adelaide-luxury-residence/living-kitchen-1.jpg',
  },
  {
    roman: 'II',
    label: 'Six Disciplines',
    subtitle: 'Interior Level 5, facades, 2K joinery, lime plaster & heritage',
    href: '/services',
    previewImage: '/images/architectural-pavilion.jpg',
  },
  {
    roman: 'III',
    label: 'Commissions',
    subtitle: 'Documented residential & architectural case monographs',
    href: '/projects',
    previewImage: '/images/projects/adelaide-luxury-residence/living-dining-2.jpg',
  },
  {
    roman: 'IV',
    label: 'Colour Visualiser',
    subtitle: 'Private browser-based wall pigment & daylight preview tool',
    href: '/visualiser',
    previewImage: '/images/architectural-paint-swatch.jpg',
  },
  {
    roman: 'V',
    label: 'Field Journal',
    subtitle: 'Technical papers on substrate moisture, sheen & raking light',
    href: '/insights',
    previewImage: '/images/painted-texture-detail.jpg',
  },
  {
    roman: 'VI',
    label: 'Atelier & Protocol',
    subtitle: 'Preparation philosophy, 4-stage governance & trade partnerships',
    href: '/about',
    previewImage: '/images/projects/adelaide-luxury-residence/kitchen-island-patio-3.jpg',
  },
  {
    roman: 'VII',
    label: 'Guild Careers',
    subtitle: 'Master finisher openings & expressions of interest',
    href: '/careers',
    previewImage: '/images/painted-texture-detail.jpg',
  },
  {
    roman: 'VIII',
    label: 'Client Reflections',
    subtitle: 'Project evaluations & verified client governance',
    href: '/feedback',
    previewImage: '/images/projects/adelaide-luxury-residence/living-kitchen-1.jpg',
  },
  {
    roman: 'IX',
    label: 'Consultation',
    subtitle: 'Free Adelaide on-site diagnostics & written scope schedules',
    href: '/contact',
    previewImage: '/images/architectural-pavilion.jpg',
  },
];

function isRouteActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const V3LuxuryShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);
  const [curtainOpen, setCurtainOpen] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(0);
  const [legalNotice, setLegalNotice] = useState<'privacy' | 'terms' | 'cookies' | null>(null);

  const isBypassedRoute =
    pathname?.startsWith('/admin') || pathname?.startsWith('/prototype');

  useEffect(() => {
    const sync = () => setIsDark(document.documentElement.classList.contains('dark'));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    setCurtainOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!curtainOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setCurtainOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [curtainOpen]);

  const toggleTheme = useCallback(() => {
    const willBeDark = !document.documentElement.classList.contains('dark');
    if (willBeDark) {
      document.documentElement.classList.add('dark');
      try {
        localStorage.setItem('strovyn-theme', 'dark');
      } catch {}
    } else {
      document.documentElement.classList.remove('dark');
      try {
        localStorage.setItem('strovyn-theme', 'light');
      } catch {}
    }
    setIsDark(willBeDark);
  }, []);

  if (isBypassedRoute) {
    return <>{children}</>;
  }

  const activeEntryIndex = Math.max(
    0,
    V3_MONOGRAPH_NAV.findIndex((item) => isRouteActive(pathname, item.href)),
  );
  const previewItem = V3_MONOGRAPH_NAV[hoveredIdx] || V3_MONOGRAPH_NAV[activeEntryIndex];

  return (
    <div className="min-h-screen bg-[#F4F1EA] dark:bg-[#181917] text-[#20211F] dark:text-[#F4F1EA] selection:bg-[#A78B65] selection:text-[#181917] transition-colors duration-300">
      {/* =====================================================================
          PERSISTENT LEFT VERTICAL BOOK-SPINE RAIL (DESKTOP lg+)
          ===================================================================== */}
      <aside
        aria-label="Strovyn Monograph Spine Navigation"
        className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-[248px] flex-col justify-between border-r border-[#B8B5AE]/70 dark:border-white/15 bg-[#EFECE4] dark:bg-[#141513] px-7 py-7 select-none"
      >
        {/* Top Masthead */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#B8B5AE]/60 dark:border-white/15 pb-3">
            <span className="font-mono text-[9px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F]">
              ATELIER EDITION
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#5C5A55] dark:text-[#B8B5AE]">
              ADELAIDE SA
            </span>
          </div>

          <Link
            href="/"
            aria-label="Strovyn Painting Co. — Return to homepage"
            className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78B65]"
          >
            <span className="font-display text-3xl tracking-[0.06em] uppercase text-[#20211F] dark:text-[#F4F1EA] block leading-none">
              STROVYN
            </span>
            <span className="font-sans text-[11px] text-[#5C5A55] dark:text-[#B8B5AE] mt-1.5 block leading-snug">
              Architectural Coating &amp; Plaster Atelier
            </span>
          </Link>
        </div>

        {/* Middle Roman-Numeral Monograph Index */}
        <nav aria-label="Primary Monograph Directory" className="space-y-4 my-auto py-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F]">
              DIRECTORY
            </span>
            <button
              type="button"
              onClick={() => {
                setHoveredIdx(activeEntryIndex);
                setCurtainOpen(true);
              }}
              aria-expanded={curtainOpen}
              aria-controls="v3-cinema-curtain-index"
              data-testid="v3-curtain-trigger-desktop"
              className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE] hover:text-[#C41E1E] dark:hover:text-[#C9B28F] cursor-pointer transition-colors"
            >
              <span>Index</span>
              <Plus className="h-3 w-3" />
            </button>
          </div>

          <ul className="space-y-2 border-l border-[#B8B5AE]/65 dark:border-white/15 pl-4">
            {V3_MONOGRAPH_NAV.map((item) => {
              const active = isRouteActive(pathname, item.href);
              return (
                <li key={item.href} className="relative">
                  {active && (
                    <motion.span
                      layoutId="v3-luxury-spine-indicator"
                      className="absolute -left-[17px] top-1 bottom-1 w-[2px] bg-[#C41E1E]"
                    />
                  )}
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-baseline gap-2.5 py-0.5 transition-colors ${
                      active
                        ? 'text-[#20211F] dark:text-[#F4F1EA] font-semibold'
                        : 'text-[#62605A] dark:text-[#A29F97] hover:text-[#20211F] dark:hover:text-[#F4F1EA]'
                    }`}
                  >
                    <span className="font-mono text-[9px] tracking-[0.16em] w-6 shrink-0 text-[#7E6340] dark:text-[#C9B28F]">
                      §{item.roman}
                    </span>
                    <span className="font-sans text-xs tracking-wide truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom Edition & Consultation Controls */}
        <div className="space-y-2.5 pt-4 border-t border-[#B8B5AE]/60 dark:border-white/15">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              data-testid="v3-theme-toggle"
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              className="flex-1 flex items-center justify-between px-3 py-2.5 border border-[#B8B5AE]/80 dark:border-white/20 text-[10px] font-mono uppercase tracking-[0.18em] text-[#20211F] dark:text-[#F4F1EA] hover:border-[#20211F] dark:hover:border-[#C9B28F] transition-colors cursor-pointer"
            >
              <span>{isDark ? 'Nocturne' : 'Paper'}</span>
              {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>

            <Link
              href="/admin"
              aria-label="Staff Sign In Portal"
              title="Staff Portal"
              className="inline-flex h-[38px] w-[38px] items-center justify-center border border-[#B8B5AE]/80 dark:border-white/20 text-[#5C5A55] dark:text-[#B8B5AE] hover:text-[#20211F] dark:hover:text-[#F4F1EA] hover:border-[#20211F] dark:hover:border-[#C9B28F] transition-colors"
            >
              <Lock className="h-3.5 w-3.5" />
            </Link>
          </div>

          <Link
            href="/contact"
            className="w-full inline-flex items-center justify-between bg-[#20211F] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#181917] hover:bg-[#C41E1E] dark:hover:bg-[#C9B28F] px-3.5 py-3 font-mono text-[10px] uppercase tracking-[0.22em] font-semibold transition-colors"
          >
            <span>Request Quote</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </aside>

      {/* =====================================================================
          PRINT BROADSHEET MOBILE / TABLET MASTHEAD (<lg)
          ===================================================================== */}
      <header className="lg:hidden sticky top-0 z-40 bg-[#F4F1EA]/96 dark:bg-[#181917]/96 backdrop-blur-md border-b border-[#B8B5AE]/80 dark:border-white/15">
        <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link
            href="/"
            aria-label="Strovyn Painting Co. — Return to homepage"
            className="flex items-baseline gap-2"
          >
            <span className="font-display text-2xl sm:text-3xl tracking-[0.05em] uppercase text-[#20211F] dark:text-[#F4F1EA] leading-none">
              STROVYN
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#7E6340] dark:text-[#C9B28F]">
              ADELAIDE
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              data-testid="v3-mobile-theme-toggle"
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              className="inline-flex h-11 w-11 items-center justify-center border border-[#B8B5AE]/80 dark:border-white/20 text-[#20211F] dark:text-[#F4F1EA] cursor-pointer"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={() => {
                setHoveredIdx(activeEntryIndex);
                setCurtainOpen(true);
              }}
              aria-label="Open navigation menu"
              aria-expanded={curtainOpen}
              aria-controls="v3-cinema-curtain-index"
              data-testid="v3-mobile-menu-trigger"
              className="inline-flex h-11 items-center gap-2 px-3.5 border border-[#20211F] dark:border-[#F4F1EA]/40 bg-[#20211F] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#181917] font-mono text-[10px] uppercase tracking-[0.2em] font-semibold cursor-pointer"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Contents</span>
            </button>
          </div>
        </div>
      </header>

      {/* =====================================================================
          HYBRID ARCHITECTURAL CINEMA FULL-SCREEN CURTAIN DIRECTORY OVERLAY
          ===================================================================== */}
      <AnimatePresence>
        {curtainOpen && (
          <motion.div
            id="v3-cinema-curtain-index"
            role="dialog"
            aria-modal="true"
            aria-label="Strovyn Monograph Studio Index"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="fixed inset-0 z-[90] grid grid-cols-1 lg:grid-cols-12 bg-[#141513] text-[#F4F1EA] overflow-y-auto"
          >
            {/* Left Photographic Preview Plate (Adapted from Concept A — Architectural Cinema) */}
            <div className="hidden lg:block lg:col-span-5 relative overflow-hidden bg-[#0E0F0E] border-r border-white/12">
              <Image
                key={previewItem.previewImage}
                src={previewItem.previewImage}
                alt={previewItem.label}
                fill
                sizes="42vw"
                className="object-cover object-center opacity-80 transition-all duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0E0F0E] via-[#0E0F0E]/25 to-transparent" />
              <div className="absolute bottom-10 left-10 right-10 space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#C9B28F] block">
                  CHAPTER §{previewItem.roman}
                </span>
                <p className="font-display uppercase text-3xl text-[#F4F1EA] leading-none">
                  {previewItem.label}
                </p>
                <p className="font-sans text-xs text-[#D5D2CA] font-light leading-relaxed">
                  {previewItem.subtitle}
                </p>
              </div>
            </div>

            {/* Right Editorial Index Column */}
            <div className="lg:col-span-7 p-6 sm:p-10 lg:p-14 flex flex-col justify-between min-h-full">
              <div className="flex items-center justify-between border-b border-white/15 pb-5">
                <div>
                  <span className="font-display text-2xl tracking-[0.06em] uppercase text-[#F4F1EA]">
                    STROVYN
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#C9B28F] ml-3">
                    STUDIO INDEX
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setCurtainOpen(false)}
                  aria-label="Close navigation menu"
                  className="inline-flex h-11 items-center gap-2 border border-white/25 hover:border-[#C9B28F] px-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F4F1EA] cursor-pointer"
                >
                  <span>Close</span>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav aria-label="Full-Screen Studio Directory" className="my-8 divide-y divide-white/12 border-y border-white/12">
                {V3_MONOGRAPH_NAV.map((entry, idx) => {
                  const active = isRouteActive(pathname, entry.href);
                  return (
                    <Link
                      key={entry.href}
                      href={entry.href}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onFocus={() => setHoveredIdx(idx)}
                      onClick={() => setCurtainOpen(false)}
                      className="group py-3.5 sm:py-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-baseline gap-4 min-w-0">
                        <span className="font-mono text-xs text-[#C9B28F] w-7 shrink-0">
                          §{entry.roman}
                        </span>
                        <div className="min-w-0">
                          <span
                            className={`font-display uppercase text-2xl sm:text-3xl tracking-wide block leading-none transition-colors ${
                              active
                                ? 'text-[#C41E1E]'
                                : 'text-[#F4F1EA] group-hover:text-[#C9B28F]'
                            }`}
                          >
                            {entry.label}
                          </span>
                          <span className="font-sans text-xs text-[#B8B5AE] block truncate mt-1">
                            {entry.subtitle}
                          </span>
                        </div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-[#B8B5AE] group-hover:text-[#C9B28F] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </Link>
                  );
                })}
              </nav>

              {/* Bottom Direct Consultation + Staff Sign In Bar */}
              <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="/contact"
                    onClick={() => setCurtainOpen(false)}
                    className="inline-flex items-center gap-2.5 bg-[#C41E1E] hover:bg-[#A31818] text-white px-5 py-3 font-mono text-[10px] uppercase tracking-[0.22em] font-semibold"
                  >
                    <span>Book Free Consultation</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                  <a
                    href={WHATSAPP_DETAILS.chatUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 border border-white/25 hover:border-[#C9B28F] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#F4F1EA]"
                  >
                    <span>WhatsApp {WHATSAPP_DETAILS.displayNumber}</span>
                  </a>
                </div>

                <Link
                  href="/admin"
                  onClick={() => setCurtainOpen(false)}
                  className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#B8B5AE] hover:text-[#F4F1EA] py-2"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Staff Sign In</span>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          MAIN PUBLIC CONTENT CANVAS (OFFSET BY 248PX SPINE ON DESKTOP)
          ===================================================================== */}
      <div className="lg:pl-[248px] flex flex-col min-h-screen">
        <div className="flex-1">{children}</div>

        {/* ===================================================================
            COHESIVE EDITORIAL ATELIER COLOPHON FOOTER
            =================================================================== */}
        <footer
          aria-label="Studio Colophon and Directory"
          className="border-t border-[#B8B5AE]/75 dark:border-white/15 bg-[#EAE5DA] dark:bg-[#131412] text-[#20211F] dark:text-[#F4F1EA] px-5 sm:px-10 lg:px-16 pt-16 pb-28 md:pb-14"
        >
          {/* Secondary Route Consultation Ribbon (omitted on /contact and / to avoid redundant CTA blocks) */}
          {pathname !== '/' && pathname !== '/contact' && (
            <div className="mb-14 pb-12 border-b border-[#B8B5AE]/70 dark:border-white/15 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
              <div className="max-w-2xl space-y-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F] block">
                  PRIVATE SITE WALKTHROUGH &middot; ADELAIDE SA
                </span>
                <h2 className="font-display uppercase text-3xl sm:text-5xl leading-[0.94]">
                  Discuss Your Architectural Surfaces.
                </h2>
                <p className="font-sans text-sm text-[#4A4945] dark:text-[#C8C5BE] font-light leading-relaxed">
                  Complimentary on-site moisture diagnostics, grazing-light assessment, and
                  itemised written schedules across metropolitan Adelaide and the Adelaide Hills.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4 shrink-0">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2.5 bg-[#C41E1E] hover:bg-[#20211F] text-[#F4F1EA] px-6 py-3.5 font-mono text-[11px] uppercase tracking-[0.22em] font-semibold transition-colors"
                >
                  <span>Request Site Consultation</span>
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <a
                  href={WHATSAPP_DETAILS.chatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border border-[#20211F]/35 dark:border-white/25 px-5 py-3.5 font-mono text-[11px] uppercase tracking-[0.2em] hover:border-[#7E6340]"
                >
                  <span>WhatsApp {WHATSAPP_DETAILS.displayNumber}</span>
                </a>
              </div>
            </div>
          )}

          {/* 4-Column Monograph Directory */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-10 pb-12 border-b border-[#B8B5AE]/70 dark:border-white/15">
            <div className="xl:col-span-4 space-y-4">
              <Link href="/" className="inline-block">
                <span className="font-display text-3xl tracking-[0.06em] uppercase block leading-none">
                  STROVYN
                </span>
              </Link>
              <p className="font-sans text-xs sm:text-sm text-[#4A4945] dark:text-[#B8B5AE] font-light leading-relaxed max-w-xs">
                Specialist architectural painting, Level 5 surface preparation, heritage
                conservation, and bespoke 2K &amp; mineral finishes across Greater Adelaide, South
                Australia.
              </p>
              <div className="pt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#7E6340] dark:text-[#C9B28F]">
                GLENELG TO ADELAIDE HILLS &middot; NORTH ADELAIDE &middot; UNLEY &middot; NORWOOD
              </div>
            </div>

            <div className="xl:col-span-4 space-y-3">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F]">
                Six Coating Disciplines
              </h3>
              <ul className="space-y-2 font-sans text-xs sm:text-sm text-[#3A3936] dark:text-[#D5D2CA]">
                {SERVICES_DATA.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={`/services/${s.slug}`}
                      className="hover:text-[#C41E1E] dark:hover:text-[#C9B28F] transition-colors"
                    >
                      {s.title}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/visualiser"
                    className="text-[#7E6340] dark:text-[#C9B28F] font-medium hover:underline"
                  >
                    Wall Colour Visualiser &rarr;
                  </Link>
                </li>
              </ul>
            </div>

            <div className="xl:col-span-2 space-y-3">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F]">
                Atelier Index
              </h3>
              <ul className="space-y-2 font-sans text-xs sm:text-sm text-[#3A3936] dark:text-[#D5D2CA]">
                <li>
                  <Link href="/about" className="hover:text-[#C41E1E] dark:hover:text-[#C9B28F]">
                    About &amp; Protocol
                  </Link>
                </li>
                <li>
                  <Link href="/projects" className="hover:text-[#C41E1E] dark:hover:text-[#C9B28F]">
                    Commission Archive
                  </Link>
                </li>
                <li>
                  <Link href="/insights" className="hover:text-[#C41E1E] dark:hover:text-[#C9B28F]">
                    Field Journal
                  </Link>
                </li>
                <li>
                  <Link href="/careers" className="hover:text-[#C41E1E] dark:hover:text-[#C9B28F]">
                    Guild Careers
                  </Link>
                </li>
                <li>
                  <Link href="/feedback" className="hover:text-[#C41E1E] dark:hover:text-[#C9B28F]">
                    Client Reflections
                  </Link>
                </li>
                <li>
                  <Link href="/admin" className="hover:text-[#C41E1E] dark:hover:text-[#C9B28F]">
                    Staff Portal
                  </Link>
                </li>
              </ul>
            </div>

            <div className="xl:col-span-2 space-y-3">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F]">
                Direct Desk
              </h3>
              <div className="space-y-3 font-sans text-xs text-[#4A4945] dark:text-[#B8B5AE]">
                <p>
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] block text-[#7E6340] dark:text-[#C9B28F]">
                    WHATSAPP BUSINESS
                  </span>
                  <a
                    href={WHATSAPP_DETAILS.chatUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-[#20211F] dark:text-[#F4F1EA] underline"
                  >
                    {WHATSAPP_DETAILS.internationalDisplay}
                  </a>
                </p>
                <p>
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] block text-[#7E6340] dark:text-[#C9B28F]">
                    ESTIMATING
                  </span>
                  <Link href="/contact" className="underline text-[#20211F] dark:text-[#F4F1EA]">
                    Submit Scope Brief &rarr;
                  </Link>
                </p>
              </div>
            </div>
          </div>

          {/* Honest Inline Legal Disclosure Notice */}
          {legalNotice && (
            <div
              id="v3-footer-legal-notice"
              role="region"
              aria-label="Legal policy status notice"
              className="mt-6 p-5 border border-[#B8B5AE] dark:border-white/20 bg-[#FAF8F4] dark:bg-[#1B1C19] text-xs flex flex-col sm:flex-row sm:items-start justify-between gap-4"
            >
              <div className="space-y-1.5 max-w-3xl leading-relaxed text-[#3A3936] dark:text-[#D5D2CA]">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#7E6340] dark:text-[#C9B28F] font-semibold">
                  {legalNotice === 'privacy' && 'Privacy Policy — Formal Document Pending Publication'}
                  {legalNotice === 'terms' && 'Terms of Service — Formal Document Pending Publication'}
                  {legalNotice === 'cookies' && 'Browser Storage & Visualiser Privacy Notice'}
                </p>
                {legalNotice === 'privacy' && (
                  <p>
                    Strovyn Painting Co. uses contact, career, and feedback details solely to
                    respond to your Adelaide project enquiry or application. Contact our team via{' '}
                    <Link href="/contact" className="underline">
                      /contact
                    </Link>{' '}
                    for written privacy details prior to engagement.
                  </p>
                )}
                {legalNotice === 'terms' && (
                  <p>
                    All coatings scopes, substrate preparation tolerances, and pricing are defined
                    exclusively in written Strovyn Painting Co. quotations following on-site
                    Adelaide inspection. Digital visualiser renders are illustrative previews only.
                  </p>
                )}
                {legalNotice === 'cookies' && (
                  <p>
                    This website stores your display edition preference (<code>strovyn-theme</code>)
                    in local browser storage and processes Wall Colour Visualiser room photos
                    privately in your browser without automatic server uploads.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setLegalNotice(null)}
                className="self-start px-3 py-1.5 border border-[#B8B5AE] dark:border-white/25 font-mono text-[10px] uppercase tracking-[0.2em] cursor-pointer"
              >
                Close
              </button>
            </div>
          )}

          {/* Bottom Colophon Line */}
          <div className="pt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
            <span>&copy; 2026 STROVYN PAINTING CO. &mdash; ADELAIDE, SOUTH AUSTRALIA</span>
            <nav aria-label="Legal disclosures" className="flex flex-wrap gap-5">
              <button
                type="button"
                onClick={() => setLegalNotice((p) => (p === 'privacy' ? null : 'privacy'))}
                aria-expanded={legalNotice === 'privacy'}
                className="hover:text-[#20211F] dark:hover:text-[#F4F1EA] cursor-pointer uppercase"
              >
                Privacy
              </button>
              <button
                type="button"
                onClick={() => setLegalNotice((p) => (p === 'terms' ? null : 'terms'))}
                aria-expanded={legalNotice === 'terms'}
                className="hover:text-[#20211F] dark:hover:text-[#F4F1EA] cursor-pointer uppercase"
              >
                Terms
              </button>
              <button
                type="button"
                onClick={() => setLegalNotice((p) => (p === 'cookies' ? null : 'cookies'))}
                aria-expanded={legalNotice === 'cookies'}
                className="hover:text-[#20211F] dark:hover:text-[#F4F1EA] cursor-pointer uppercase"
              >
                Browser Storage
              </button>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
};
