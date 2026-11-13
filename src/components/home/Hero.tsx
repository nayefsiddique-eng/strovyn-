'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useSpring, useTransform, AnimatePresence, useReducedMotion } from 'framer-motion';

export interface HeroProps {
  quoteHref?: string;
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// STROVYN PAINT DROP SVG (extracted from brand mark)
// The teardrop shape that forms the top of the Strovyn logo mark
// ─────────────────────────────────────────────────────────────────────────────
const StrovynDrop: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 80 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Paint drop / teardrop shape */}
    <path
      d="M40 4 C40 4, 76 44, 76 64 C76 84 60 96 40 96 C20 96 4 84 4 64 C4 44 40 4 40 4 Z"
      fill="#C41E1E"
    />
    {/* Inner highlight — gives depth, like a real paint drop catching light */}
    <ellipse
      cx="31"
      cy="55"
      rx="8"
      ry="12"
      fill="rgba(255,255,255,0.18)"
      transform="rotate(-15 31 55)"
    />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 3D PIGMENT CARD — interactive mouse-tilt card with paint texture
// ─────────────────────────────────────────────────────────────────────────────
export const PigmentCard: React.FC = () => {
  const cardRef = useRef<HTMLDivElement>(null);

  const rawX = useSpring(0, { stiffness: 180, damping: 28 });
  const rawY = useSpring(0, { stiffness: 180, damping: 28 });

  const rotateY = useTransform(rawX, [-0.5, 0.5], [-14, 14]);
  const rotateX = useTransform(rawY, [-0.5, 0.5], [10, -10]);
  const shineX = useTransform(rawX, [-0.5, 0.5], ['0%', '100%']);
  const shineY = useTransform(rawY, [-0.5, 0.5], ['0%', '100%']);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    rawX.set((e.clientX - rect.left) / rect.width - 0.5);
    rawY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    rawX.set(0);
    rawY.set(0);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect || !e.touches[0]) return;
    rawX.set((e.touches[0].clientX - rect.left) / rect.width - 0.5);
    rawY.set((e.touches[0].clientY - rect.top) / rect.height - 0.5);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
        perspective: 900,
      }}
      className="relative w-full h-full cursor-pointer select-none"
    >
      {/* Card face */}
      <div className="w-full h-full overflow-hidden relative bg-[#1a1816] border border-white/10 shadow-2xl">
        {/* Paint texture background */}
        <Image
          src="/images/painted-texture-detail.jpg"
          alt="Fine architectural paint texture"
          fill
          sizes="400px"
          className="object-cover object-center opacity-70 mix-blend-luminosity"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#C41E1E]/30 via-[#A78B65]/20 to-[#20211F]/90" />

        {/* Specular shine layer — moves with tilt */}
        <motion.div
          style={{
            background: `radial-gradient(ellipse at ${shineX} ${shineY}, rgba(255,255,255,0.18) 0%, transparent 60%)`,
          }}
          className="absolute inset-0 pointer-events-none"
        />

        {/* Card content */}
        <div className="absolute inset-0 p-6 flex flex-col justify-between" style={{ transform: 'translateZ(24px)' }}>
          <div className="flex items-start justify-between">
            <StrovynDrop className="w-8 h-10 drop-shadow-xl" />
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/50 text-right leading-relaxed">
              ARCHITECTURAL<br />FINISHES
            </span>
          </div>

          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#A78B65] mb-2">
              Surface Pigment
            </div>
            <div className="font-serif text-2xl text-white leading-tight mb-3">
              Venetian<br /><span className="italic text-[#A78B65]">Plaster</span>
            </div>
            <div className="flex gap-2 items-center">
              <div className="w-3 h-3 rounded-full bg-[#C41E1E] shadow-lg" />
              <div className="w-3 h-3 rounded-full bg-[#A78B65] shadow-lg" />
              <div className="w-3 h-3 rounded-full bg-[#F4F1EA] shadow-lg" />
              <span className="font-mono text-[9px] text-white/40 tracking-widest ml-1">PALETTE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating shadow beneath card */}
      <motion.div
        style={{ rotateX, rotateY }}
        className="absolute inset-x-4 -bottom-4 h-8 bg-black/40 blur-xl rounded-full -z-10"
      />
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HERO — Cinematic Drop Animation → Full Hero
// ─────────────────────────────────────────────────────────────────────────────
export const Hero: React.FC<HeroProps> = ({
  quoteHref = '/contact',
  className = '',
}) => {
  const shouldReduce = useReducedMotion();

  // Phase 0: Drop falls into frame
  // Phase 1: Drop morphs / expands
  // Phase 2: Logo reveals
  // Phase 3: Curtain dissolves, hero beneath
  // Phase 4: Hero content enters
  // Phase 5: Complete (curtain gone)
  const [phase, setPhase] = useState<number>(shouldReduce ? 5 : 0);

  useEffect(() => {
    // Check if URL has ?settled=true or ?preview=hero
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('settled') === 'true' || params.get('preview') === 'hero') {
        setPhase(5);
        return;
      }
    }

    if (shouldReduce) return;

    const timers = [
      setTimeout(() => setPhase(1), 600),   // drop settles
      setTimeout(() => setPhase(2), 1200),  // logo appears
      setTimeout(() => setPhase(3), 1900),  // curtain begins dissolving
      setTimeout(() => setPhase(4), 2400),  // hero content enters
      setTimeout(() => setPhase(5), 3200),  // curtain gone
    ];

    return () => timers.forEach(clearTimeout);
  }, [shouldReduce]);

  const handleScrollClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target =
      document.getElementById('editorial-statement') ||
      document.querySelector('main > section:nth-of-type(2)');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
    }
  };

  return (
    <section
      aria-label="Strovyn Painting Co. — Cinematic Brand Introduction"
      className={`relative w-full min-h-[100dvh] overflow-hidden selection:bg-brand-red selection:text-white ${className}`}
    >
      {/* ═══════════════════════════════════════════════════════════════════
          LAYER 0: BACKGROUND ARCHITECTURAL PHOTOGRAPH — always in DOM
          ═══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ scale: 1.08 }}
        animate={{ scale: 1 }}
        transition={{ duration: 2.8, ease: [0.19, 1, 0.22, 1] }}
        className="absolute inset-0 w-full h-full z-0 bg-charcoal"
      >
        <Image
          src="/images/architectural-pavilion.jpg"
          alt="Strovyn Painting Co. — architectural residential project, Adelaide"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center brightness-[0.78] contrast-[1.08]"
        />
        {/* Deep cinematic gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0c0b]/90 via-[#0d0c0b]/30 to-[#0d0c0b]/55" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d0c0b]/70 via-transparent to-[#0d0c0b]/45" />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)`,
            backgroundSize: '80px 80px',
          }}
          aria-hidden="true"
        />
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════
          LAYER 1: CINEMATIC INTRO CURTAIN — ivory bg with drop animation
          Sits above photo, dissolves when phase ≥ 3
          ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {phase < 5 && !shouldReduce && (
          <motion.div
            key="intro-curtain"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#F4F1EA]"
          >
            {/* ── PAINT DROP ANIMATION ── */}
            <div className="relative flex flex-col items-center">

              {/* Phase 0–1: Drop falls from above */}
              <AnimatePresence mode="wait">
                {phase < 2 && (
                  <motion.div
                    key="drop-falling"
                    initial={{ y: -120, opacity: 0, scale: 0.6 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.6, filter: 'blur(8px)' }}
                    transition={{
                      y: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
                      opacity: { duration: 0.3 },
                      scale: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
                    }}
                    className="relative"
                  >
                    <StrovynDrop className="w-20 h-24 drop-shadow-2xl" />
                    {/* Ripple on landing */}
                    {phase >= 1 && (
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0.6 }}
                        animate={{ scale: 3, opacity: 0 }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-6 bg-[#C41E1E]/25 rounded-full blur-sm"
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Phase 2+: Full logo with elegant entrance */}
              <AnimatePresence>
                {phase >= 2 && (
                  <motion.div
                    key="full-logo"
                    initial={{ opacity: 0, y: 12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col items-center"
                  >
                    <Image
                      src="/images/strovyn-logo.png"
                      alt="Strovyn Painting Co."
                      width={260}
                      height={86}
                      priority
                      className="w-[200px] sm:w-[260px] h-auto drop-shadow-xl"
                    />
                    <motion.span
                      initial={{ opacity: 0, letterSpacing: '0.1em' }}
                      animate={{ opacity: 1, letterSpacing: '0.3em' }}
                      transition={{ duration: 0.8, delay: 0.15 }}
                      className="font-mono text-[9px] sm:text-[10px] uppercase text-[#A78B65] mt-4 tracking-[0.3em] font-medium"
                    >
                      PAINTING CO. — ADELAIDE
                    </motion.span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Thin horizontal lines — architectural framing device */}
              {phase >= 2 && (
                <motion.div
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={{ scaleX: 1, opacity: 1 }}
                  transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute left-1/2 -translate-x-1/2 flex items-center gap-6 mt-2"
                  style={{ top: '-28px' }}
                >
                  <div className="w-16 h-px bg-[#A78B65]/50" />
                  <div className="w-16 h-px bg-[#A78B65]/50" />
                </motion.div>
              )}
            </div>

            {/* Border frame — architectural device */}
            <div className="absolute inset-6 border border-[#A78B65]/20 pointer-events-none" />
            <div className="absolute inset-10 border border-[#20211F]/8 pointer-events-none" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════
          LAYER 2: HERO CONTENT — always in DOM, fades in
          ═══════════════════════════════════════════════════════════════════ */}

      {/* Top context bar */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pt-32 sm:pt-36">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: phase >= 4 || shouldReduce ? 1 : 0, y: phase >= 4 || shouldReduce ? 0 : -10 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/20 pb-4 gap-3 text-white/80 font-mono text-xs uppercase tracking-[0.22em]"
        >
          <div className="flex items-center gap-3">
            <StrovynDrop className="w-4 h-5 opacity-80" />
            <span className="text-white font-medium">STROVYN PAINTING CO.</span>
            <span className="text-white/40">//</span>
            <span className="text-white/80 font-medium tracking-widest">ADELAIDE, SOUTH AUSTRALIA</span>
          </div>
          <div className="flex items-center gap-4 text-white/50 text-[11px]">
            <span>LEVEL 5 AS/NZS 2311</span>
            <span>&bull;</span>
            <span>EST. SOUTH AUSTRALIA</span>
          </div>
        </motion.div>
      </div>

      {/* Main editorial content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-10 sm:py-16 flex flex-col justify-end grow">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-end">

          {/* Headline column — 8/12 */}
          <div className="lg:col-span-8">
            <div className="overflow-hidden mb-3">
              <motion.span
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: phase >= 4 || shouldReduce ? 0 : 24, opacity: phase >= 4 || shouldReduce ? 1 : 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="font-mono text-xs sm:text-sm uppercase tracking-[0.24em] text-bronze block font-medium"
              >
                [ ARCHITECTURAL FINISHES &amp; RESTORATION ]
              </motion.span>
            </div>

            <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl lg:text-[5.25rem] font-normal leading-[1.05] tracking-tight text-white mb-6">
              <motion.span
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: phase >= 4 || shouldReduce ? 1 : 0, y: phase >= 4 || shouldReduce ? 0 : 28 }}
                transition={{ duration: 0.85, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="block"
              >
                Transforming Spaces.
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: phase >= 4 || shouldReduce ? 1 : 0, y: phase >= 4 || shouldReduce ? 0 : 28 }}
                transition={{ duration: 0.85, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="block text-white/90 italic font-light"
              >
                Perfecting Every Finish.
              </motion.span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: phase >= 4 || shouldReduce ? 1 : 0, y: phase >= 4 || shouldReduce ? 0 : 20 }}
              transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="font-sans text-base sm:text-lg md:text-xl text-white/70 font-light max-w-2xl leading-relaxed mb-8 sm:mb-10"
            >
              Thoughtful preparation, refined finishes and professional painting for spaces that deserve a higher standard.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: phase >= 4 || shouldReduce ? 1 : 0, y: phase >= 4 || shouldReduce ? 0 : 20 }}
              transition={{ duration: 0.8, delay: 0.65, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-wrap items-center gap-5 sm:gap-7"
            >
              <Link
                href="/projects"
                className="group relative inline-flex items-center gap-5 bg-brand-red hover:bg-brand-red-dark text-white px-8 sm:px-10 py-4 font-mono text-xs uppercase tracking-[0.2em] font-medium transition-all duration-300 shadow-xl"
              >
                <span>Explore Our Work</span>
                <span className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-0.5">↗</span>
              </Link>

              <Link
                href={quoteHref}
                className="font-mono text-xs uppercase tracking-[0.2em] text-white/85 hover:text-white transition-colors py-4 px-2 border-b border-white/35 hover:border-white inline-flex items-center gap-2"
              >
                <span>Request a Quote</span>
                <span>&rarr;</span>
              </Link>
            </motion.div>
          </div>

          {/* Right column: 3D Pigment Card — 4/12 */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: phase >= 4 || shouldReduce ? 1 : 0, y: phase >= 4 || shouldReduce ? 0 : 32 }}
            transition={{ duration: 1, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-4 hidden lg:block h-[220px]"
            style={{ perspective: '900px' }}
          >
            <PigmentCard />
          </motion.div>
        </div>
      </div>

      {/* Bottom metrics bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: phase >= 4 || shouldReduce ? 1 : 0 }}
        transition={{ duration: 0.8, delay: 0.9 }}
        className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pb-8 sm:pb-12 pt-4 border-t border-white/15 flex items-center justify-between font-mono text-[10px] sm:text-xs uppercase tracking-[0.2em] text-white/60"
      >
        <Link
          href="#editorial-statement"
          onClick={handleScrollClick}
          className="group inline-flex items-center gap-3 hover:text-white transition-colors"
        >
          <span className="w-1.5 h-1.5 bg-bronze group-hover:scale-125 transition-transform" />
          <span>Scroll to Discover Craftsmanship</span>
          <span className="transition-transform group-hover:translate-y-1">&darr;</span>
        </Link>
        <div className="hidden md:flex items-center gap-6">
          <span>0406 646 061</span>
          <span className="text-white/25">&bull;</span>
          <span>contact@strovyn.com</span>
          <span className="text-white/25">&bull;</span>
          <span>Mon&ndash;Sat 7:00 AM &ndash; 5:00 PM ACST</span>
        </div>
      </motion.div>
    </section>
  );
};

export default Hero;
