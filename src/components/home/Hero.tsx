'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useSpring, useTransform } from 'framer-motion';

export interface HeroProps {
  quoteHref?: string;
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// STROVYN FLUID ARTWORK CARD (Interactive tilt card showcasing Pigment & Motion)
// ─────────────────────────────────────────────────────────────────────────────
export const FluidPigmentCard: React.FC = () => {
  const cardRef = useRef<HTMLDivElement>(null);

  const rawX = useSpring(0, { stiffness: 180, damping: 28 });
  const rawY = useSpring(0, { stiffness: 180, damping: 28 });

  const rotateY = useTransform(rawX, [-0.5, 0.5], [-10, 10]);
  const rotateX = useTransform(rawY, [-0.5, 0.5], [8, -8]);

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

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
        perspective: 1000,
      }}
      className="relative w-full max-w-[420px] aspect-[4/5] mx-auto shadow-2xl cursor-pointer select-none group"
    >
      <div className="relative w-full h-full overflow-hidden border border-black/10 bg-black">
        <Image
          src="/images/red-fluid-paint.jpg"
          alt="Strovyn signature pigment in motion"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 420px"
          className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
        />

        {/* Bottom subtle metadata label as seen in brand design reference */}
        <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between font-mono text-[10px] tracking-[0.25em] text-white/80 uppercase pointer-events-none drop-shadow">
          <span>PIGMENT / MOTION</span>
          <span className="font-semibold text-white">N&deg;01</span>
        </div>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HERO — Strovyn Authentic Brand Architecture: Crisp White, Oversized Headline, Fluid Artwork
// ─────────────────────────────────────────────────────────────────────────────
export const Hero: React.FC<HeroProps> = ({
  quoteHref = '/contact',
  className = '',
}) => {
  return (
    <section
      aria-label="Strovyn Painting Co. Hero"
      className={`relative w-full min-h-[92vh] bg-white text-charcoal pt-28 sm:pt-36 lg:pt-40 pb-16 lg:pb-24 flex flex-col justify-between overflow-hidden selection:bg-brand-red selection:text-white ${className}`}
    >
      <div className="max-w-7xl w-full mx-auto px-6 sm:px-8 lg:px-12 grow flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Bold Typography & Content */}
          <div className="lg:col-span-7 xl:col-span-7 flex flex-col">
            
            {/* Top Subtitle with Red Accent */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-3 mb-6 sm:mb-8 font-mono text-[11px] sm:text-xs uppercase tracking-[0.26em] text-brand-red font-medium"
            >
              <span>STROVYN PAINTING CO. &mdash; EST. 2026</span>
            </motion.div>

            {/* Oversized Brand Headline: Solid Black + Outline Black + Solid Brand Red */}
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="font-display uppercase tracking-tight text-6xl sm:text-7xl md:text-8xl lg:text-[6.5rem] xl:text-[7.5rem] leading-[0.88] select-none mb-8"
            >
              {/* Row 1: Solid Black */}
              <span className="block text-[#111110]">
                A NEW
              </span>
              
              {/* Row 2: Hollow Outlined Text */}
              <span className="block text-stroke-charcoal">
                STANDARD
              </span>

              {/* Row 3: Solid Black */}
              <span className="block text-[#111110]">
                IN EVERY
              </span>

              {/* Row 4: Signature Strovyn Red */}
              <span className="block text-brand-red">
                STROKE.
              </span>
            </motion.h1>

            {/* Description Subtext */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="font-sans text-sm sm:text-base text-charcoal/70 max-w-md leading-relaxed mb-8 font-normal"
            >
              Premium residential and commercial painting. Precision prep, flawless finish, and colour treated as craft &mdash; not commodity.
            </motion.p>

            {/* Primary Action Button (Start a Project / Request a Quote) */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-6"
            >
              <Link
                href={quoteHref}
                className="group inline-flex items-center gap-4 bg-brand-red hover:bg-brand-red-dark text-white px-8 sm:px-10 py-4 font-mono text-xs uppercase tracking-[0.22em] font-medium transition-colors shadow-lg cursor-pointer"
              >
                <span>START A PROJECT</span>
                <span className="text-white transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-0.5">
                  &nearr;
                </span>
              </Link>
            </motion.div>
          </div>

          {/* Right Column: Fluid Red Artwork Card (Exact Reference Matching) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 xl:col-span-5 flex justify-center lg:justify-end"
          >
            <FluidPigmentCard />
          </motion.div>
        </div>
      </div>

      {/* Bottom Scroll Indicator Bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.5 }}
        className="max-w-7xl w-full mx-auto px-6 sm:px-8 lg:px-12 pt-8 flex items-center font-mono text-[10px] uppercase tracking-[0.24em] text-charcoal/40"
      >
        <div className="flex items-center gap-2">
          <span>&darr;</span>
          <span>SCROLL</span>
        </div>
      </motion.div>
    </section>
  );
};

export default Hero;
