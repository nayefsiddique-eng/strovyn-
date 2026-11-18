'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import {
  ensureGsapRegistered,
  gsap,
  prefersReducedMotion,
  attachMagneticInteraction,
} from '@/lib/motion/gsapConfig';
import {
  HERO_FINISH_PRESETS,
  type HeroFinishPreset,
} from '@/components/three/HeroArchitecturalScene';

const HeroArchitecturalScene = dynamic(
  () => import('@/components/three/HeroArchitecturalScene'),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden="true"
        className="w-full h-full bg-gradient-to-br from-[#FAF8F5] via-[#EBE7DF] to-[#DFD9CE] dark:from-[#242523] dark:via-[#1E1F1D] dark:to-[#161715]"
      />
    ),
  }
);

export interface HeroProps {
  quoteHref?: string;
  className?: string;
}

export const Hero: React.FC<HeroProps> = ({
  quoteHref = '/contact',
  className = '',
}) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const wordmarkRef = useRef<HTMLSpanElement | null>(null);
  const primaryBtnRef = useRef<HTMLAnchorElement | null>(null);
  const secondaryBtnRef = useRef<HTMLAnchorElement | null>(null);
  const primaryPhotoWrapRef = useRef<HTMLDivElement | null>(null);
  const primaryPhotoInnerRef = useRef<HTMLDivElement | null>(null);
  const alcoveCardRef = useRef<HTMLDivElement | null>(null);
  const pavilionCardRef = useRef<HTMLDivElement | null>(null);

  const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activePreset, setActivePreset] = useState<HeroFinishPreset>(
    HERO_FINISH_PRESETS[0]
  );
  const [isDark, setIsDark] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  // Sync Dark mode class from <html> and prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setReducedMotion(prefersReducedMotion());

    const root = document.documentElement;
    const syncTheme = () => setIsDark(root.classList.contains('dark'));
    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Coordinated GSAP Entrance Timeline, ScrollTrigger Depth & Magnetic CTAs
  useEffect(() => {
    ensureGsapRegistered();
    const section = sectionRef.current;
    if (!section) return;

    const isReduced = prefersReducedMotion();
    const cleanupPrimaryMagnetic = attachMagneticInteraction(primaryBtnRef.current, 0.2);
    const cleanupSecondaryMagnetic = attachMagneticInteraction(secondaryBtnRef.current, 0.16);

    const ctx = gsap.context(() => {
      if (isReduced) {
        gsap.set(
          [
            '.hero-rule-line',
            '.hero-meta-reveal',
            '.hero-copy-item',
            '.hero-visual-plane',
          ],
          { clearProps: 'all', opacity: 1 }
        );
        return;
      }

      // 1. Crisp, Restrained Entrance Choreography (~0.9s total)
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo(
        '.hero-rule-line',
        { scaleX: 0, transformOrigin: 'left center' },
        { scaleX: 1, duration: 0.65, stagger: 0.07 },
        0
      )
        .fromTo(
          '.hero-meta-reveal',
          { y: 10, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, stagger: 0.05 },
          0.04
        )
        .fromTo(
          wordmarkRef.current,
          { yPercent: 16, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.7, ease: 'power4.out' },
          0.06
        )
        .fromTo(
          '.hero-copy-item',
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, stagger: 0.06 },
          0.14
        )
        .fromTo(
          '.hero-visual-plane',
          { y: 20, opacity: 0, clipPath: 'inset(6% 0% 6% 0%)' },
          {
            y: 0,
            opacity: 1,
            clipPath: 'inset(0% 0% 0% 0%)',
            duration: 0.8,
            stagger: 0.09,
            ease: 'power3.out',
          },
          0.14
        );

      // 2. Scroll-Linked Multi-Plane Parallax into Section 01
      if (primaryPhotoInnerRef.current) {
        gsap.to(primaryPhotoInnerRef.current, {
          yPercent: 8,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.5,
          },
        });
      }

      if (alcoveCardRef.current) {
        gsap.to(alcoveCardRef.current, {
          yPercent: -5,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.6,
          },
        });
      }

      if (pavilionCardRef.current) {
        gsap.to(pavilionCardRef.current, {
          yPercent: -9,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.5,
          },
        });
      }
    }, section);

    // 3. Subtle Pointer Tracking for 3D Raking Light & Multi-Plane Depth
    const xQuick = primaryPhotoWrapRef.current
      ? gsap.quickTo(primaryPhotoWrapRef.current, 'x', { duration: 0.6, ease: 'power3.out' })
      : null;
    const yQuick = primaryPhotoWrapRef.current
      ? gsap.quickTo(primaryPhotoWrapRef.current, 'y', { duration: 0.6, ease: 'power3.out' })
      : null;

    const handlePointerMove = (e: PointerEvent) => {
      if (isReduced) return;
      const rect = section.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
      pointerRef.current.x = Math.max(-1, Math.min(1, nx));
      pointerRef.current.y = Math.max(-1, Math.min(1, -ny));

      xQuick?.(nx * -6);
      yQuick?.(ny * -4);
    };

    const handlePointerLeave = () => {
      pointerRef.current.x = 0;
      pointerRef.current.y = 0;
      xQuick?.(0);
      yQuick?.(0);
    };

    section.addEventListener('pointermove', handlePointerMove, { passive: true });
    section.addEventListener('pointerleave', handlePointerLeave, { passive: true });

    return () => {
      section.removeEventListener('pointermove', handlePointerMove);
      section.removeEventListener('pointerleave', handlePointerLeave);
      cleanupPrimaryMagnetic();
      cleanupSecondaryMagnetic();
      ctx.revert();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-label="Strovyn Brand Opening & Introduction"
      className={`relative w-full min-h-screen bg-ivory dark:bg-[#181917] text-charcoal dark:text-[#F4F1EA] flex flex-col justify-between pt-20 sm:pt-24 pb-20 sm:pb-16 px-6 sm:px-8 lg:px-12 xl:px-16 overflow-hidden selection:bg-brand-red selection:text-white transition-colors duration-300 ${className}`}
    >
      {/* Background Architectural Drafting Grid & Subtle Raking Daylight Wash */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035] dark:opacity-[0.025]"
        aria-hidden="true"
      >
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(to right, #20211F 1px, transparent 1px),
              linear-gradient(to bottom, #20211F 1px, transparent 1px)
            `,
            backgroundSize: '88px 88px',
          }}
        />
      </div>

      <div
        aria-hidden="true"
        className="absolute -top-32 right-0 w-[65vw] h-[65vh] pointer-events-none opacity-45 dark:opacity-20"
        style={{
          background:
            'radial-gradient(ellipse at 70% 25%, rgba(167, 139, 101, 0.22) 0%, transparent 70%)',
        }}
      />

      {/* ── TOP EDITORIAL STRIP: Framing Bar ── */}
      <div className="relative z-10 w-full max-w-7xl mx-auto">
        <div className="hero-meta-reveal flex flex-col sm:flex-row sm:items-center justify-between pb-3 pt-1 gap-2 font-mono text-[11px] sm:text-xs uppercase tracking-[0.24em] text-bronze dark:text-[#C2AB89]">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-1.5 bg-brand-red inline-block" />
            <span className="text-charcoal dark:text-white font-semibold">
              STROVYN PAINTING CO.
            </span>
            <span className="text-warm-grey-dark dark:text-[#A8A59E] hidden sm:inline">
              &mdash;
            </span>
            <span className="text-warm-grey-dark dark:text-[#A8A59E]">
              ADELAIDE, SOUTH AUSTRALIA
            </span>
          </div>
          <div className="flex items-center gap-3 text-warm-grey-dark dark:text-[#A8A59E] text-[11px]">
            <span>GREATER ADELAIDE SPECIALISTS</span>
          </div>
        </div>
        <div className="hero-rule-line h-px w-full bg-warm-grey/35 dark:bg-white/15" />
      </div>

      {/* ── CENTER AREA: ARCHITECTURAL WORDMARK + MULTI-PLANE STUDIO COMPOSITION ── */}
      <div className="relative z-10 w-full max-w-7xl mx-auto my-auto py-4 sm:py-6 flex flex-col justify-center">
        {/* Supporting Narrative Header Strip */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-12 items-end mb-3 sm:mb-4">
          <div className="lg:col-span-7">
            <div className="hero-meta-reveal flex items-center gap-3">
              <span className="w-6 h-px bg-brand-red" />
              <span className="font-mono text-xs sm:text-[13px] uppercase tracking-[0.28em] text-brand-red font-semibold">
                A NEW STANDARD IN INNOVATION
              </span>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col sm:flex-row sm:items-center justify-between lg:justify-end gap-4 text-left">
            <p className="hero-meta-reveal font-sans text-xs sm:text-sm text-charcoal/80 dark:text-[#F4F1EA]/80 max-w-sm leading-relaxed font-light">
              <span className="inline-block w-2 h-2 bg-brand-red mr-2 align-middle" />
              Coatings engineered as enduring architectural surfaces. Uncompromising substrate discipline across South Australia.
            </p>
          </div>
        </div>

        {/* ── MONUMENTAL BRAND WORDMARK ── */}
        <div className="w-full tracking-tighter select-none py-3 sm:py-4 my-1 relative">
          <div className="hero-rule-line absolute top-0 left-0 right-0 h-px bg-warm-grey/35 dark:bg-white/15" />
          <div className="flex items-baseline justify-between overflow-hidden">
            <span
              ref={wordmarkRef}
              className="font-display font-bold uppercase tracking-tight text-charcoal dark:text-white leading-[0.82] text-[16.5vw] sm:text-[17vw] lg:text-[13.5vw] xl:text-[176px] block"
              style={{ letterSpacing: '-0.035em' }}
            >
              STROVYN<span className="text-brand-red">.</span>
            </span>
          </div>
          <div className="hero-rule-line absolute bottom-0 left-0 right-0 h-px bg-warm-grey/35 dark:bg-white/15" />
        </div>

        {/* ── LOWER SECTION: APPROVED H1 + LAYERED 3D & PHOTOGRAPHIC COMPOSITION ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-12 items-start mt-5 sm:mt-6">
          {/* Left Column (5 Cols): Approved Homepage H1, Craft Narrative & Magnetic CTAs (Clear above STRO) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-5">
            <div>
              <span className="hero-copy-item font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.24em] text-bronze dark:text-[#C9B28F] font-semibold block mb-2.5">
                [ ARCHITECTURAL COATINGS &middot; SPECIFICATION STANDARD ]
              </span>

              {/* Verified Approved Homepage H1 */}
              <h1 className="hero-copy-item font-serif text-3xl sm:text-4xl md:text-5xl xl:text-[3.35rem] text-charcoal dark:text-white leading-[1.06] tracking-tight mb-4 font-normal">
                Transforming Spaces. Perfecting Every Finish.
              </h1>

              <p className="hero-copy-item font-sans text-sm sm:text-base text-charcoal-muted dark:text-[#B8B5AE] max-w-lg leading-relaxed font-light">
                Strovyn Painting Co. operates at the intersection of material discipline and contemporary architectural consciousness. Every project begins with substrate preparation and ends in quiet visual clarity.
              </p>
            </div>

            {/* Action Buttons (Positioned with generous clearance from viewport edges) */}
            <div className="hero-copy-item flex flex-wrap items-center gap-4 sm:gap-5 pt-1">
              <Link
                ref={primaryBtnRef}
                href="/about"
                className="group inline-flex items-center gap-3 bg-charcoal hover:bg-black dark:bg-[#F4F1EA] dark:hover:bg-white text-white dark:text-charcoal px-6 sm:px-7 py-3.5 font-mono text-xs uppercase tracking-[0.2em] font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red"
              >
                <span>OUR PHILOSOPHY</span>
                <span className="transition-transform duration-300 group-hover:translate-x-1">
                  &rarr;
                </span>
              </Link>

              <Link
                ref={secondaryBtnRef}
                href={quoteHref}
                className="font-mono text-xs uppercase tracking-[0.18em] text-charcoal dark:text-white hover:text-brand-red dark:hover:text-brand-red font-medium transition-colors inline-flex items-center gap-1.5 py-2 group cursor-pointer"
              >
                <span>Initiate Consultation</span>
                <span
                  className="transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden="true"
                >
                  &rarr;
                </span>
              </Link>
            </div>
          </div>

          {/* Right Column (7 Cols): Cohesive Multi-Plane Photography + 3D Raking-Light Alcove + Finish Calibration Bar */}
          <div className="lg:col-span-7 relative space-y-3">
            <div
              ref={primaryPhotoWrapRef}
              className="relative grid grid-cols-12 gap-3 sm:gap-4 items-stretch"
            >
              {/* Plane 1 (7 Cols): Verified Completed Adelaide Residence Photography */}
              <div className="hero-visual-plane col-span-12 sm:col-span-7 min-w-0 w-full min-h-[220px] sm:min-h-[290px] sm:h-full relative overflow-hidden border border-warm-grey/50 dark:border-white/15 bg-charcoal shadow-xl group">
                <div
                  ref={primaryPhotoInnerRef}
                  className="absolute inset-[-8%] w-[116%] h-[116%]"
                >
                  <Image
                    src="/images/projects/adelaide-luxury-residence/living-dining-2.jpg"
                    alt="Completed Adelaide Residence interior walls and ceilings finished to Level 5 standard by Strovyn Painting Co."
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-cover object-center transition-transform duration-1000 ease-out group-hover:scale-[1.03]"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent pointer-events-none" />

                <div
                  aria-hidden="true"
                  className="absolute top-3 left-3 right-3 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-white/90 z-10 pointer-events-none"
                >
                  <span className="bg-black/55 backdrop-blur-xs px-2.5 py-1 border border-white/15">
                    COMPLETED WORK &middot; ADELAIDE
                  </span>
                </div>

                <div className="absolute bottom-3 left-3 right-3 flex flex-col items-start gap-1.5 text-white font-mono text-[10px] uppercase tracking-[0.14em] z-10 select-none">
                  <span className="bg-charcoal/90 backdrop-blur-xs px-2 py-0.5 text-[9.5px] leading-tight text-white/95 border border-white/25 whitespace-nowrap">
                    LEVEL 5 FINISH
                  </span>
                  <span className="font-medium drop-shadow-sm leading-tight">
                    ADELAIDE RESIDENCE
                  </span>
                </div>
              </div>

              {/* Plane 2 & 3 (5 Cols Stack): Interactive 3D Raking-Light Plaster Alcove + Pavilion Visualiser Handoff */}
              <div className="col-span-12 sm:col-span-5 min-w-0 flex flex-col justify-between gap-3">
                {/* Plane 2: Live 3D Architectural Plaster & Shadow-Line Reveal Study */}
                <div
                  ref={alcoveCardRef}
                  className="hero-visual-plane relative flex-1 min-h-[165px] sm:min-h-[175px] border border-warm-grey/50 dark:border-white/15 overflow-hidden shadow-lg"
                >
                  <HeroArchitecturalScene
                    activePreset={activePreset}
                    isDark={isDark}
                    pointerRef={pointerRef}
                    reducedMotion={reducedMotion}
                  />

                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
                    <span className="font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 bg-white/90 dark:bg-[#141513]/90 text-charcoal dark:text-[#F4F1EA] border border-warm-grey/40 dark:border-white/15">
                      3D RAKING LIGHT ALCOVE
                    </span>
                    <span
                      className="w-3.5 h-3.5 border border-black/30 shadow-xs transition-colors duration-300"
                      style={{ backgroundColor: activePreset.hex }}
                    />
                  </div>

                  <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10 font-mono text-[9px] uppercase tracking-wider text-charcoal dark:text-[#F4F1EA] bg-white/90 dark:bg-[#141513]/90 px-2.5 py-1 border border-warm-grey/30 dark:border-white/10">
                    <span className="truncate">{activePreset.name}</span>
                    <span className="text-bronze dark:text-[#C9B28F] ml-1 shrink-0">
                      {activePreset.hex}
                    </span>
                  </div>
                </div>

                {/* Plane 3: Architectural Pavilion Form & Direct Visualiser Entry */}
                <div
                  ref={pavilionCardRef}
                  className="hero-visual-plane relative h-28 sm:h-32 border border-warm-grey/50 dark:border-white/15 bg-charcoal overflow-hidden group"
                >
                  <Image
                    src="/images/architectural-pavilion.jpg"
                    alt="Contemporary architectural pavilion highlighting natural light and surface planes"
                    fill
                    sizes="(max-width: 1024px) 100vw, 22vw"
                    className="object-cover object-center filter contrast-[1.04] transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />
                  <div className="absolute inset-0 p-2.5 flex flex-col justify-between z-10">
                    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/85">
                      DAYLIGHT GEOMETRY
                    </span>
                    <Link
                      href={`/visualiser?finish=${encodeURIComponent(activePreset.name)}`}
                      className="inline-flex items-center justify-between gap-2 w-full bg-white/95 hover:bg-white dark:bg-[#181917]/95 dark:hover:bg-black text-charcoal dark:text-white px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] border border-white/20 transition-colors"
                    >
                      <span>Test On Your Wall</span>
                      <span aria-hidden="true">&rarr;</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Integrated 4-Finish Calibration Console directly beneath the 3D & Photographic Showcase */}
            <div className="hero-visual-plane bg-white/85 dark:bg-[#20211F]/90 border border-warm-grey/40 dark:border-white/15 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-warm-grey-dark dark:text-[#A8A59E]">
                  CALIBRATE 3D ALCOVE FINISH (ILLUSTRATIVE):
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-bronze dark:text-[#C9B28F] font-semibold">
                  {activePreset.sheenLabel}
                </span>
              </div>
              <div
                role="group"
                aria-label="Calibrate Hero architectural finish study"
                className="grid grid-cols-2 sm:grid-cols-4 gap-2"
              >
                {HERO_FINISH_PRESETS.map((preset) => {
                  const isSelected = preset.id === activePreset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setActivePreset(preset)}
                      aria-pressed={isSelected}
                      className={`flex items-center gap-2 px-2.5 py-1.5 border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-charcoal dark:bg-[#F4F1EA] text-white dark:text-charcoal border-charcoal dark:border-[#F4F1EA]'
                          : 'bg-ivory/80 dark:bg-[#181917] text-charcoal dark:text-[#F4F1EA] border-warm-grey/40 dark:border-white/15 hover:border-bronze'
                      }`}
                    >
                      <span
                        className="w-3 h-3 shrink-0 border border-black/25"
                        style={{ backgroundColor: preset.hex }}
                        aria-hidden="true"
                      />
                      <span className="font-mono text-[10px] uppercase tracking-wider truncate">
                        {preset.name.split(' ').slice(0, 2).join(' ')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM EDITORIAL FOOTER STRIP: Haven Corner Anchors ── */}
      <div className="relative z-10 w-full max-w-7xl mx-auto pt-4">
        <div className="hero-rule-line h-px w-full bg-warm-grey/25 dark:bg-white/10 mb-4" />
        <div className="hero-meta-reveal flex items-center justify-between font-mono text-[10px] sm:text-xs uppercase tracking-[0.24em] text-charcoal/60 dark:text-white/50 select-none">
          <div className="flex items-center gap-3">
            <span className="text-bronze dark:text-[#C2AB89] font-semibold">
              STROVYN PAINTING CO.
            </span>
            <span className="hidden sm:inline">&mdash;</span>
            <span className="hidden sm:inline">ARCHITECTURAL PRACTICE</span>
          </div>

          <div className="flex items-center gap-2">
            <span>&darr;</span>
            <span>EXPLORE SPECIFICATION</span>
          </div>

          <div>
            <span>SOUTH AUSTRALIA</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
