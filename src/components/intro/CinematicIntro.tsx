'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import {
  attachMagneticInteraction,
  ensureGsapRegistered,
  gsap,
  prefersReducedMotion,
} from '@/lib/motion/gsapConfig';

const IntroArchitecturalBackdrop = dynamic(
  () =>
    import('@/components/three/IntroArchitecturalBackdrop').then(
      (mod) => mod.IntroArchitecturalBackdrop
    ),
  { ssr: false }
);

export interface CinematicIntroProps {
  onEnter: () => void;
}

export function CinematicIntro({ onEnter }: CinematicIntroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoStageRef = useRef<HTMLDivElement>(null);
  const logoBezelRef = useRef<HTMLDivElement>(null);
  const logoSheenRef = useRef<HTMLDivElement>(null);
  const act2CaptionRef = useRef<HTMLParagraphElement>(null);
  const draftingTopRef = useRef<HTMLDivElement>(null);
  const draftingBottomRef = useRef<HTMLDivElement>(null);
  const draftingAxisRef = useRef<HTMLDivElement>(null);
  const prologueTagRef = useRef<HTMLDivElement>(null);
  const act3ContentRef = useRef<HTMLDivElement>(null);
  const headlineLine1Ref = useRef<HTMLSpanElement>(null);
  const headlineLine2Ref = useRef<HTMLSpanElement>(null);
  const bodyCopyRef = useRef<HTMLParagraphElement>(null);
  const ctaWrapRef = useRef<HTMLDivElement>(null);
  const enterButtonRef = useRef<HTMLButtonElement>(null);
  const footerMetaRef = useRef<HTMLDivElement>(null);

  const pointerRef = useRef({ x: 0, y: 0 });
  const actProgressRef = useRef(0);
  const isExitingRef = useRef(false);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  const [isDark, setIsDark] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [actPhase, setActPhase] = useState<'I' | 'II' | 'III'>('I');

  // Sync dark/light theme reactively from root <html> class
  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDark(root.classList.contains('dark'));
    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    const rm = prefersReducedMotion();
    setReducedMotion(rm);
    if (rm) {
      actProgressRef.current = 2.2;
      setActPhase('III');
    }

    return () => observer.disconnect();
  }, []);

  // Lock page scrolling behind intro until dismissed
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handleDismiss = useCallback(
    (mode: 'enter' | 'skip' | 'instant' = 'enter') => {
      if (isExitingRef.current) return;
      isExitingRef.current = true;
      timelineRef.current?.kill();

      try {
        sessionStorage.setItem('strovyn_intro_seen', 'true');
      } catch {
        // Ignore private browsing storage blocks
      }

      if (mode === 'instant' || prefersReducedMotion()) {
        setIsActive(false);
        onEnter();
        return;
      }

      const container = containerRef.current;
      if (!container) {
        setIsActive(false);
        onEnter();
        return;
      }

      const dur = mode === 'skip' ? 0.24 : 0.56;
      const exitTl = gsap.timeline({
        onComplete: () => {
          setIsActive(false);
          onEnter();
        },
      });

      const progressProxy = { val: actProgressRef.current };
      exitTl.to(
        progressProxy,
        {
          val: 3.0,
          duration: dur,
          ease: 'power3.inOut',
          onUpdate: () => {
            actProgressRef.current = progressProxy.val;
          },
        },
        0
      );

      exitTl.to(
        container,
        {
          opacity: 0,
          scale: mode === 'skip' ? 1.015 : 1.035,
          duration: dur,
          ease: 'power3.inOut',
        },
        0.02
      );
    },
    [onEnter]
  );

  // Keyboard Escape dismissal (works immediately from frame 0)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDismiss('instant');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleDismiss]);

  // Subtle magnetic pull on ENTER WEBSITE platen
  useEffect(() => {
    if (reducedMotion) return;
    return attachMagneticInteraction(enterButtonRef.current, 0.16);
  }, [reducedMotion]);

  // Pointer parallax tracking for both R3F backdrop and architectural frame
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    pointerRef.current.x = Math.max(-1, Math.min(1, nx));
    pointerRef.current.y = Math.max(-1, Math.min(1, ny));
  }, []);

  // 3-Act GSAP Choreography (wall-clock exact pacing via lagSmoothing(0))
  useLayoutEffect(() => {
    ensureGsapRegistered();

    const container = containerRef.current;
    const logoStage = logoStageRef.current;
    if (!container || !logoStage) return;

    const rm = prefersReducedMotion();
    if (rm) {
      actProgressRef.current = 2.2;
      setActPhase('III');
      return;
    }

    // Keep real wall-clock pacing across all 3 acts; launch after first paint/shader warmup
    gsap.ticker.lagSmoothing(0);

    let raf1 = 0;
    let raf2 = 0;

    const ctx = gsap.context(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const rect = logoStage.getBoundingClientRect();
      const targetCenterX = vw / 2 - (rect.left + rect.width / 2);
      const targetCenterY = vh / 2 - (rect.top + rect.height / 2);

      const maxCenterWidth = Math.min(vw * 0.78, 430);
      const centerScale =
        rect.width > 0
          ? Math.min(1.5, Math.max(1.06, maxCenterWidth / rect.width))
          : 1.24;

      gsap.set([draftingTopRef.current, draftingBottomRef.current], {
        scaleX: 0,
        transformOrigin: 'left center',
      });
      gsap.set(draftingAxisRef.current, {
        scaleY: 0,
        transformOrigin: 'top center',
      });
      gsap.set(prologueTagRef.current, { opacity: 0, y: 10 });
      gsap.set(logoStage, {
        x: targetCenterX,
        y: targetCenterY,
        scale: centerScale * 1.07,
        opacity: 0,
      });
      gsap.set(logoBezelRef.current, { opacity: 0, scale: 0.94 });
      gsap.set(logoSheenRef.current, { xPercent: -135, opacity: 0 });
      gsap.set(act2CaptionRef.current, { opacity: 0, y: 8 });

      gsap.set(act3ContentRef.current, { opacity: 0 });
      gsap.set([headlineLine1Ref.current, headlineLine2Ref.current], {
        yPercent: 108,
        opacity: 0,
      });
      gsap.set(bodyCopyRef.current, { opacity: 0, y: 14 });
      gsap.set(ctaWrapRef.current, { opacity: 0, y: 12 });
      gsap.set(footerMetaRef.current, { opacity: 0, y: 8 });

      const actProxy = { value: 0 };
      const tl = gsap.timeline({
        paused: true,
        defaults: { ease: 'power3.out' },
      });
      timelineRef.current = tl;

      // ------------------------------------------------------------------
      // ACT I (0.00s -> 0.75s): ATMOSPHERE — ARCHITECTURAL SPACE AWAKENS
      // ------------------------------------------------------------------
      tl.addLabel('act1', 0)
        .to(
          actProxy,
          {
            value: 1.0,
            duration: 0.78,
            ease: 'power2.inOut',
            onUpdate: () => {
              actProgressRef.current = actProxy.value;
            },
          },
          'act1'
        )
        .to(
          [draftingTopRef.current, draftingBottomRef.current],
          { scaleX: 1, duration: 0.65, stagger: 0.06, ease: 'power3.inOut' },
          'act1+=0.05'
        )
        .to(
          draftingAxisRef.current,
          { scaleY: 1, duration: 0.6, ease: 'power3.inOut' },
          'act1+=0.1'
        )
        .to(
          prologueTagRef.current,
          { opacity: 1, y: 0, duration: 0.34 },
          'act1+=0.08'
        )
        .to(
          prologueTagRef.current,
          { opacity: 0, y: -6, duration: 0.22 },
          'act1+=0.54'
        );

      // ------------------------------------------------------------------
      // ACT II (0.76s -> 1.85s): THE STROVYN IDENTITY — CENTERPIECE LOCKUP
      // ------------------------------------------------------------------
      tl.addLabel('act2', 0.76)
        .call(() => setActPhase('II'), [], 'act2')
        .to(
          actProxy,
          {
            value: 2.0,
            duration: 1.05,
            ease: 'power2.out',
            onUpdate: () => {
              actProgressRef.current = actProxy.value;
            },
          },
          'act2'
        )
        .to(
          logoStage,
          {
            opacity: 1,
            scale: centerScale,
            duration: 0.72,
            ease: 'power3.out',
          },
          'act2'
        )
        .to(
          logoBezelRef.current,
          { opacity: 1, scale: 1, duration: 0.55, ease: 'power2.out' },
          'act2+=0.14'
        )
        .to(
          act2CaptionRef.current,
          { opacity: 1, y: 0, duration: 0.38 },
          'act2+=0.26'
        )
        .to(
          logoSheenRef.current,
          { opacity: 1, duration: 0.12 },
          'act2+=0.30'
        )
        .to(
          logoSheenRef.current,
          { xPercent: 140, duration: 0.68, ease: 'power2.inOut' },
          'act2+=0.32'
        )
        .to(
          logoSheenRef.current,
          { opacity: 0, duration: 0.16 },
          'act2+=0.86'
        );

      // ------------------------------------------------------------------
      // ACT III (1.86s -> 2.75s): ENTER THE STROVYN WORLD — HAVEN COMPOSITION
      // ------------------------------------------------------------------
      tl.addLabel('act3', 1.86)
        .call(() => setActPhase('III'), [], 'act3')
        .to(
          act2CaptionRef.current,
          { opacity: 0, y: -6, duration: 0.24 },
          'act3'
        )
        .to(
          actProxy,
          {
            value: 2.28,
            duration: 0.82,
            ease: 'power3.inOut',
            onUpdate: () => {
              actProgressRef.current = actProxy.value;
            },
          },
          'act3'
        )
        .to(
          logoStage,
          {
            x: 0,
            y: 0,
            scale: 1,
            duration: 0.7,
            ease: 'power3.inOut',
            clearProps: 'transform',
          },
          'act3+=0.04'
        )
        .to(
          act3ContentRef.current,
          { opacity: 1, duration: 0.3 },
          'act3+=0.20'
        )
        .to(
          [headlineLine1Ref.current, headlineLine2Ref.current],
          {
            yPercent: 0,
            opacity: 1,
            duration: 0.64,
            stagger: 0.1,
            ease: 'power4.out',
          },
          'act3+=0.24'
        )
        .to(
          bodyCopyRef.current,
          { opacity: 1, y: 0, duration: 0.5 },
          'act3+=0.40'
        )
        .to(
          ctaWrapRef.current,
          { opacity: 1, y: 0, duration: 0.46 },
          'act3+=0.50'
        )
        .to(
          footerMetaRef.current,
          { opacity: 1, y: 0, duration: 0.4 },
          'act3+=0.56'
        );
    }, container);

    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        if (!isExitingRef.current) {
          timelineRef.current?.play(0);
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      gsap.ticker.lagSmoothing(500, 33);
      ctx.revert();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      role="dialog"
      aria-modal="true"
      aria-label="Strovyn Painting Co. Brand Introduction"
      data-testid="cinematic-intro"
      data-act-phase={actPhase}
      className={`fixed inset-0 z-[100] flex h-[100dvh] w-full flex-col justify-between overflow-hidden select-none transition-colors duration-500 ${
        isDark ? 'bg-[#161715] text-[#FAF8F5]' : 'bg-[#EAE4D8] text-[#20211F]'
      }`}
    >
      {/* Dynamic R3F Sunlit Architectural Plaster Backdrop + Non-WebGL Fallback */}
      <IntroArchitecturalBackdrop
        isDark={isDark}
        isActive={isActive}
        pointerRef={pointerRef}
        actProgressRef={actProgressRef}
        reducedMotion={reducedMotion}
      />

      {/* Subtle architectural axis line (desktop grid split) */}
      <div
        ref={draftingAxisRef}
        aria-hidden="true"
        className={`pointer-events-none absolute top-0 bottom-0 left-[44%] hidden w-px lg:block ${
          isDark ? 'bg-[#FAF8F5]/10' : 'bg-[#20211F]/10'
        }`}
      />

      {/* Top Editorial Utility Rail — Interactive from frame 0, single-line on mobile */}
      <header className="relative z-20 mx-auto w-full max-w-[1440px] px-5 pt-4 sm:px-10 sm:pt-7 lg:px-14">
        <div className="flex items-center justify-between gap-3 pb-3 sm:pb-4">
          <div className="flex min-w-0 items-center gap-2.5 text-[10px] font-medium tracking-[0.2em] uppercase sm:text-[11px]">
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 bg-[#7E6340] dark:bg-[#C9B28F]"
              aria-hidden="true"
            />
            <span
              className={`truncate ${
                isDark ? 'text-[#EAE5DB]/85' : 'text-[#20211F]/80'
              }`}
            >
              Architectural Finishing
              <span className="hidden sm:inline"> &middot; Adelaide</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleDismiss('skip')}
            data-testid="intro-skip-btn"
            className={`group inline-flex min-h-[36px] shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xs px-3 py-1.5 text-[11px] font-medium tracking-[0.18em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7E6340] ${
              isDark
                ? 'bg-[#252623]/85 text-[#FAF8F5]/95 hover:bg-[#FAF8F5]/15 hover:text-white'
                : 'bg-[#FAF8F5]/85 text-[#20211F]/90 hover:bg-[#20211F]/10 hover:text-[#20211F]'
            }`}
          >
            <span>Skip Intro</span>
            <span
              aria-hidden="true"
              className="inline-block transition-transform duration-300 group-hover:translate-x-1"
            >
              &rarr;
            </span>
          </button>
        </div>

        <div
          ref={draftingTopRef}
          aria-hidden="true"
          className={`h-px w-full ${
            isDark ? 'bg-[#FAF8F5]/16' : 'bg-[#20211F]/14'
          }`}
        />
      </header>

      {/* Center Stage: Seamlessly bridges Act II Centerpiece Ident -> Act III Haven Editorial Split */}
      <main className="relative z-20 mx-auto flex w-full max-w-[1440px] flex-1 items-center px-5 py-2 sm:px-10 sm:py-6 lg:px-14">
        {/* Act I Prologue Subtle Caption — fades cleanly out before Act II logo appears */}
        <div
          ref={prologueTagRef}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
        >
          <p
            className={`text-[10px] font-medium tracking-[0.34em] uppercase whitespace-nowrap sm:text-[11px] ${
              isDark ? 'text-[#C9B28F]/90' : 'text-[#6B5335]/90'
            }`}
          >
            Prologue &mdash; Architecture In Light
          </p>
        </div>

        <div className="grid w-full grid-cols-1 items-center gap-5 sm:gap-7 lg:grid-cols-12 lg:gap-12">
          {/* Left Architectural Column (Origin & Settled Anchor of Official Strovyn Logo) */}
          <div className="flex flex-col items-start lg:col-span-5">
            <div
              ref={logoStageRef}
              className="relative flex w-fit flex-col items-center will-change-transform"
              data-testid="intro-logo-stage"
            >
              {/* Tight w-fit wrapper around ONLY the official 2:1 logo banner & corner frame */}
              <div className="relative inline-block w-fit">
                <div
                  ref={logoBezelRef}
                  aria-hidden="true"
                  className={`pointer-events-none absolute -inset-2.5 sm:-inset-3 border transition-colors ${
                    isDark ? 'border-[#C9B28F]/40' : 'border-[#7E6340]/40'
                  }`}
                >
                  <span
                    className={`absolute -top-0.5 -left-0.5 h-2 w-2 border-t border-l ${
                      isDark ? 'border-[#C9B28F]' : 'border-[#7E6340]'
                    }`}
                  />
                  <span
                    className={`absolute -top-0.5 -right-0.5 h-2 w-2 border-t border-r ${
                      isDark ? 'border-[#C9B28F]' : 'border-[#7E6340]'
                    }`}
                  />
                  <span
                    className={`absolute -bottom-0.5 -left-0.5 h-2 w-2 border-b border-l ${
                      isDark ? 'border-[#C9B28F]' : 'border-[#7E6340]'
                    }`}
                  />
                  <span
                    className={`absolute -right-0.5 -bottom-0.5 h-2 w-2 border-r border-b ${
                      isDark ? 'border-[#C9B28F]' : 'border-[#7E6340]'
                    }`}
                  />
                </div>

                {/* Official Strovyn Brand Banner — exact original proportions & colors */}
                <div className="relative w-fit overflow-hidden shadow-[0_24px_60px_-15px_rgba(0,0,0,0.45)]">
                  <Image
                    src="/images/strovyn-logo.png"
                    alt="Strovyn Painting Co. — A New Standard In Innovation"
                    width={760}
                    height={380}
                    priority
                    className="block h-auto w-[196px] object-contain sm:w-[250px] lg:w-[295px]"
                  />
                  {/* Controlled Specular Studio Sweep Across Plate */}
                  <div
                    ref={logoSheenRef}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(112deg, transparent 22%, rgba(255, 246, 232, 0.28) 49%, transparent 78%)',
                    }}
                  />
                </div>
              </div>

              {/* Act II Centerpiece Colophon — positioned outside tight bezel so box size is exact */}
              <p
                ref={act2CaptionRef}
                className={`mt-4 text-center text-[9px] font-medium tracking-[0.26em] uppercase whitespace-nowrap sm:text-[10px] ${
                  isDark ? 'text-[#C9B28F]' : 'text-[#6B5335]'
                }`}
              >
                Master Painters &middot; Adelaide SA
              </p>
            </div>
          </div>

          {/* Right Architectural Column: Act III Editorial Title, Copy & Enter Control */}
          <div
            ref={act3ContentRef}
            className="flex flex-col items-start lg:col-span-7 lg:pl-6"
          >
            <span
              className={`mb-2.5 inline-flex items-center gap-2 text-[10px] font-medium tracking-[0.24em] uppercase sm:mb-3.5 sm:text-[11px] ${
                isDark ? 'text-[#C9B28F]' : 'text-[#7E6340]'
              }`}
            >
              <span
                className="inline-block h-px w-6 bg-current"
                aria-hidden="true"
              />
              Bespoke Interiors &amp; Heritage Exteriors
            </span>

            <h1 className="font-serif text-[clamp(1.7rem,6.5vw,4.05rem)] leading-[1.03] font-normal tracking-[-0.02em] uppercase">
              <span className="block overflow-hidden pb-0.5">
                <span ref={headlineLine1Ref} className="block">
                  Transforming Spaces.
                </span>
              </span>
              <span className="block overflow-hidden pt-0.5">
                <span
                  ref={headlineLine2Ref}
                  className={`block ${
                    isDark ? 'text-[#C9B28F]' : 'text-[#6B5335]'
                  }`}
                >
                  Perfecting Every Finish.
                </span>
              </span>
            </h1>

            <p
              ref={bodyCopyRef}
              className={`mt-3 max-w-xl text-[13.5px] leading-[1.6] font-normal sm:mt-5 sm:text-[15.5px] lg:text-[16px] ${
                isDark ? 'text-[#D6D4CF]' : 'text-[#434440]'
              }`}
            >
              Strovyn Painting Co. elevates bespoke residences, heritage facades,
              and architectural interiors across Adelaide through disciplined
              preparation and refined surface finishes.
            </p>

            {/* Integrated Architectural Enter Control */}
            <div
              ref={ctaWrapRef}
              className="mt-5 flex w-full flex-col items-start gap-3 sm:mt-7 sm:w-auto sm:flex-row sm:items-center sm:gap-6"
            >
              <button
                ref={enterButtonRef}
                type="button"
                onClick={() => handleDismiss('enter')}
                data-testid="intro-enter-btn"
                className={`group relative inline-flex min-h-[48px] w-full cursor-pointer items-center justify-between gap-5 overflow-hidden border px-6 py-3.5 text-[11px] font-medium tracking-[0.24em] uppercase transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7E6340] sm:w-auto sm:justify-start ${
                  isDark
                    ? 'border-[#C9B28F]/60 bg-[#FAF8F5] text-[#141513] hover:border-[#FAF8F5] hover:bg-[#FFFFFF]'
                    : 'border-[#20211F] bg-[#20211F] text-[#FAF8F5] hover:border-[#6B5335] hover:bg-[#312D28]'
                }`}
              >
                <span>Enter Website</span>
                <span
                  aria-hidden="true"
                  className="inline-flex items-center gap-1.5 transition-transform duration-300 group-hover:translate-x-1"
                >
                  <span className="inline-block h-px w-4 bg-current transition-all duration-300 group-hover:w-6" />
                  <span>&rarr;</span>
                </span>
              </button>

              <span
                className={`text-[10px] font-medium tracking-[0.2em] uppercase sm:text-[11px] ${
                  isDark ? 'text-[#B8B5AE]/85' : 'text-[#595651]/85'
                }`}
              >
                Est. Adelaide, South Australia
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Haven-Inspired Architectural Datum Footer */}
      <footer className="relative z-20 mx-auto w-full max-w-[1440px] px-5 pb-4 sm:px-10 sm:pb-6 lg:px-14">
        <div
          ref={draftingBottomRef}
          aria-hidden="true"
          className={`mb-3 h-px w-full ${
            isDark ? 'bg-[#FAF8F5]/16' : 'bg-[#20211F]/14'
          }`}
        />
        <div
          ref={footerMetaRef}
          className={`flex flex-wrap items-center justify-between gap-2 text-[9px] font-medium tracking-[0.22em] uppercase sm:text-[10px] ${
            isDark ? 'text-[#B8B5AE]/80' : 'text-[#595651]/80'
          }`}
        >
          <span>Residential &middot; Heritage &middot; Commercial</span>
          <span className="hidden sm:inline">34.9285&deg; S &middot; 138.6007&deg; E</span>
          <span>A New Standard In Innovation</span>
        </div>
      </footer>
    </div>
  );
}
