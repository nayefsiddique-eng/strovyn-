'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';

export interface EditorialStatementProps {
  className?: string;
}

export const EditorialStatement: React.FC<EditorialStatementProps> = ({ className = '' }) => {
  return (
    <section
      id="editorial-statement"
      aria-label="Editorial Brand Statement"
      className={`relative w-full bg-ivory text-charcoal py-24 md:py-36 border-b border-warm-grey/30 overflow-hidden ${className}`}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        {/* Editorial Index Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-between border-b border-warm-grey/30 pb-4 mb-16 md:mb-20"
        >
          <span className="font-sans text-xs sm:text-sm uppercase tracking-[0.2em] text-bronze font-medium">
            [ 01 / PHILOSOPHY &amp; APPROACH ]
          </span>
          <span className="font-mono text-[11px] text-warm-grey-dark uppercase tracking-widest hidden sm:inline-block">
            ARCHITECTURAL FINISHES // PREPARATION DISCIPLINE
          </span>
        </motion.div>

        {/* Split Editorial Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Oversized Typography & Narrative */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 flex flex-col justify-between"
          >
            <div>
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-brand-red font-semibold block mb-4">
                THE STROVYN PRINCIPLE
              </span>
              
              <h2 className="type-section-title text-4xl sm:text-5xl md:text-6xl text-charcoal mb-8">
                More Than A Coat Of Paint.
              </h2>

              <p className="font-sans text-lg sm:text-xl text-charcoal-muted leading-relaxed font-light mb-8">
                Great finishes begin long before the first brushstroke. Preparation, attention to detail and the right finishing approach shape the result.
              </p>

              <div className="space-y-4 font-sans text-base text-charcoal/80 leading-relaxed border-l-2 border-bronze pl-6 my-8">
                <p>
                  At Strovyn Painting Co., we treat architectural coatings not as cosmetic coverage, but as the critical tactile skin of a built environment. Our craftsmen execute exacting premium finishes with zero substrate deflection, laser-straight shadow lines, and dust-controlled HEPA extraction on-site.
                </p>
                <p className="text-sm text-warm-grey-dark italic">
                  Calibrated against natural South Australian northern and southern light transitions to preserve visual depth throughout changing hours.
                </p>
              </div>
            </div>

            <div className="pt-4">
              <Button
                variant="outline"
                size="md"
                href="/about"
                rightIcon={
                  <svg
                    className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 8H13M13 8L8.5 3.5M13 8L8.5 12.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="square"
                      strokeLinejoin="miter"
                    />
                  </svg>
                }
              >
                Learn More About Our Standards
              </Button>
            </div>
          </motion.div>

          {/* Right Column: Large Close-Up of Finished Architectural Wall / Texture */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 relative aspect-[4/5] sm:aspect-[1/1] lg:aspect-[4/5] w-full overflow-hidden bg-charcoal border border-warm-grey/40 group shadow-xl"
          >
            <Image
              src="/images/painted-texture-detail.jpg"
              alt="Refined architectural wall finish and paint texture detail by Strovyn Painting Co."
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center filter contrast-[1.06] transition-transform duration-1000 ease-out group-hover:scale-105"
            />
            {/* Subtle Vignette Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

            {/* Architectural Spec Stamp */}
            <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between text-white font-mono text-xs z-10">
              <span className="uppercase tracking-widest font-medium">
                SURFACE DETAIL // ARCHITECTURAL FINISH
              </span>
              <span className="border border-white/40 bg-black/40 px-2 py-0.5 text-[10px]">
                ADELAIDE SA
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default EditorialStatement;
