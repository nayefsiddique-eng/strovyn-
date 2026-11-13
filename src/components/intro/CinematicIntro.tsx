'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';

export interface CinematicIntroProps {
  onEnter: () => void;
}

export const CinematicIntro: React.FC<CinematicIntroProps> = ({ onEnter }) => {
  const [isExiting, setIsExiting] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Escape key triggers entrance
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        handleTriggerEnter();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleTriggerEnter = () => {
    if (isExiting) return;
    setIsExiting(true);
    // Smooth transition window before unmounting overlay
    const exitDuration = shouldReduceMotion ? 100 : 700;
    setTimeout(() => {
      onEnter();
    }, exitDuration);
  };

  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEnter();
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Strovyn brand introduction"
      initial={{ opacity: 1 }}
      animate={{
        opacity: isExiting ? 0 : 1,
        scale: isExiting ? 1.04 : 1,
      }}
      exit={{ opacity: 0 }}
      transition={{
        duration: shouldReduceMotion ? 0.1 : 0.7,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="fixed inset-0 z-[200] bg-[#141513] text-white flex flex-col justify-between items-center select-none overflow-hidden"
    >
      {/* =========================================================================
          ATMOSPHERIC LIGHTING & SUBTLE DEPTH
          ========================================================================= */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Deep architectural radial glows */}
        <div
          className="absolute inset-0 transition-opacity duration-1000"
          style={{
            background: `
              radial-gradient(ellipse 70% 50% at 50% 45%, rgba(196, 30, 30, 0.14) 0%, rgba(20, 21, 19, 0) 70%),
              radial-gradient(ellipse 60% 40% at 85% 15%, rgba(167, 139, 101, 0.12) 0%, rgba(20, 21, 19, 0) 60%),
              radial-gradient(ellipse 80% 50% at 20% 85%, rgba(45, 46, 42, 0.25) 0%, rgba(20, 21, 19, 0) 70%),
              linear-gradient(180deg, #111210 0%, #161715 50%, #111210 100%)
            `,
          }}
        />

        {/* Architectural drafting grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #B8B5AE 1px, transparent 1px),
              linear-gradient(to bottom, #B8B5AE 1px, transparent 1px)
            `,
            backgroundSize: '64px 64px',
          }}
        />

        {/* Subtle breathing ambient radial highlight */}
        {!shouldReduceMotion && (
          <motion.div
            className="absolute inset-0"
            animate={{
              opacity: [0.6, 0.9, 0.6],
              scale: [1, 1.03, 1],
            }}
            transition={{
              duration: 7,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{
              background:
                'radial-gradient(circle at 50% 50%, rgba(196, 30, 30, 0.08) 0%, transparent 60%)',
            }}
          />
        )}

        {/* Perimeter fine lines */}
        <div className="absolute top-0 left-0 right-0 h-px bg-white/[0.08]" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/[0.08]" />
      </div>

      {/* =========================================================================
          TOP BAR (Location & Year context)
          ========================================================================= */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 py-6 sm:py-8 flex items-center justify-between text-[10px] sm:text-xs font-sans tracking-[0.24em] uppercase text-warm-grey/60">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: shouldReduceMotion ? 0 : 0.2 }}
          className="flex items-center gap-2.5"
        >
          <span className="w-1.5 h-1.5 bg-brand-red rounded-none inline-block" />
          <span>Adelaide, South Australia</span>
        </motion.div>

        <motion.button
          type="button"
          onClick={handleSkip}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: shouldReduceMotion ? 0 : 0.3 }}
          className="hover:text-white transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-red py-1 px-2"
          aria-label="Skip introduction and proceed directly to website"
        >
          Skip Intro →
        </motion.button>
      </div>

      {/* =========================================================================
          CENTRAL LOGO REVEAL & ENTER STROVYN INTERACTION
          ========================================================================= */}
      <div className="relative z-10 w-full max-w-3xl mx-auto px-6 flex flex-col items-center justify-center text-center my-auto py-8">
        {/* Subtle decorative architectural framing line */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{
            duration: shouldReduceMotion ? 0.2 : 0.9,
            delay: shouldReduceMotion ? 0 : 0.3,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="w-12 h-px bg-brand-red mb-8 sm:mb-10"
        />

        {/* The Strovyn Logo (Exact image provided) */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: shouldReduceMotion ? 0.2 : 1,
            delay: shouldReduceMotion ? 0 : 0.5,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="relative max-w-[280px] sm:max-w-[340px] md:max-w-[380px] w-full mx-auto"
        >
          {/* Subtle logo back-glow */}
          <div
            className="absolute -inset-4 opacity-40 blur-xl pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(196, 30, 30, 0.6) 0%, transparent 70%)',
            }}
          />
          <div className="relative border border-white/10 shadow-2xl">
            <Image
              src="/images/strovyn-logo.png"
              alt="Strovyn — A New Standard in Innovation"
              width={760}
              height={380}
              priority
              className="w-full h-auto block"
            />
          </div>
        </motion.div>

        {/* Brand Statement / Craftsmanship Headline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0.2 : 0.8,
            delay: shouldReduceMotion ? 0 : 1.1,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="mt-8 sm:mt-10 max-w-lg"
        >
          <p className="font-serif italic text-lg sm:text-xl md:text-2xl text-warm-grey-light font-normal tracking-wide">
            Architectural Precision &amp; Master Surface Craft
          </p>
          <p className="mt-2 text-xs sm:text-sm font-sans font-light text-warm-grey/70 tracking-widest uppercase">
            Residential &bull; Heritage &bull; Commercial
          </p>
        </motion.div>

        {/* ENTER STROVYN CTA Interaction */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0.2 : 0.8,
            delay: shouldReduceMotion ? 0 : 1.6,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="mt-10 sm:mt-12"
        >
          <button
            type="button"
            onClick={handleTriggerEnter}
            autoFocus
            className="group relative inline-flex flex-col items-center px-10 sm:px-14 py-4 sm:py-5 border border-warm-grey/40 hover:border-white bg-[#1A1B18]/70 hover:bg-[#20211F] transition-all duration-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red"
            aria-label="Enter Strovyn Painting Co. website"
          >
            {/* Corner accents */}
            <span className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-brand-red pointer-events-none" />
            <span className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-brand-red pointer-events-none" />

            <div className="flex items-center gap-3">
              <span className="font-sans text-xs sm:text-sm uppercase tracking-[0.3em] font-medium text-white group-hover:tracking-[0.34em] transition-all duration-300">
                Enter Strovyn
              </span>
              <span className="text-brand-red font-sans text-sm transition-transform duration-300 group-hover:translate-x-1">
                &rarr;
              </span>
            </div>

            {/* Bottom active red indicator line */}
            <span className="absolute -bottom-px left-1/4 right-1/4 h-[2px] bg-brand-red transition-all duration-300 group-hover:left-0 group-hover:right-0" />
          </button>
        </motion.div>
      </div>

      {/* =========================================================================
          BOTTOM METADATA BAR
          ========================================================================= */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 py-6 sm:py-8 flex items-center justify-between text-[10px] sm:text-xs font-sans tracking-[0.2em] uppercase text-warm-grey/50 border-t border-white/[0.06]">
        <span>Strovyn Painting Co.</span>
        <span>A New Standard in Innovation</span>
      </div>
    </motion.div>
  );
};

export default CinematicIntro;
