'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

export const StrovynV2Craftsmanship: React.FC = () => {
  return (
    <section
      id="v2-craft"
      aria-label="Strovyn Craftsmanship and Surface Philosophy"
      className="w-full bg-ivory text-charcoal border-b border-warm-grey/35 py-20 md:py-28 lg:py-32"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12 space-y-16 md:space-y-20">
        {/* Structura-Inspired Editorial Statement Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start border-b border-warm-grey/35 pb-12"
        >
          <div className="lg:col-span-4 space-y-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-bronze font-semibold block">
              [ 01 / CRAFTSMANSHIP &amp; PRINCIPLE ]
            </span>
            <p className="font-sans text-xs text-warm-grey-dark uppercase tracking-[0.16em]">
              Preparation Before Pigment
            </p>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <h2 className="type-section-title text-3xl sm:text-5xl lg:text-[3.35rem] uppercase text-charcoal leading-[1.03]">
              Great finishes begin long before the first coat —{' '}
              <span className="text-bronze">
                engineered in substrate discipline and verified under raking Adelaide daylight.
              </span>
            </h2>
            <p className="font-sans text-base sm:text-lg text-charcoal-muted font-light leading-relaxed max-w-3xl">
              At Strovyn Painting Co., we treat architectural coatings as the permanent tactile envelope
              of a residence or commercial space. Every project commences with moisture equilibrium checks,
              planar skimming, HEPA-extracted orbital sanding, and bespoke physical sample verification.
            </p>
          </div>
        </motion.div>

        {/* Asymmetric Dual-Plate Material & Texture Study */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-7 relative min-h-[340px] sm:min-h-[440px] overflow-hidden border border-warm-grey/40 bg-[#181917]"
          >
            <Image
              src="/images/painted-texture-detail.jpg"
              alt="Precision architectural surface preparation and coating application by Strovyn Painting Co."
              fill
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover object-center"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#141513]/85 via-transparent to-transparent"
            />
            <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-center justify-between gap-2 text-[#F4F1EA] font-mono text-[11px] uppercase tracking-[0.18em]">
              <span>FIELD STUDY // ZERO-DEFLECTION PREPARATION</span>
              <span className="border border-white/30 bg-[#141513]/75 px-2.5 py-1 text-[10px] text-[#C9B28F]">
                HEPA EXTRACTION
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-5 flex flex-col justify-between bg-white border border-warm-grey/40 p-6 sm:p-8"
          >
            <div className="space-y-5">
              <div className="relative aspect-[16/10] w-full overflow-hidden border border-warm-grey/30 bg-charcoal">
                <Image
                  src="/images/architectural-paint-swatch.jpg"
                  alt="Architectural colour and mineral finish swatches curated by Strovyn Painting Co."
                  fill
                  sizes="(max-width: 1024px) 100vw, 38vw"
                  className="object-cover object-center"
                />
              </div>

              <div className="space-y-2.5 pt-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bronze font-semibold block">
                  INTERACTIVE STUDIO TOOL
                </span>
                <h3 className="type-card-title text-2xl sm:text-3xl uppercase text-charcoal">
                  Preview Tones On Your Own Walls.
                </h3>
                <p className="font-sans text-sm text-charcoal-muted leading-relaxed">
                  Upload a room photograph into our browser-based Wall Colour Visualiser to test warm
                  mineral neutrals, velvet mattes, and architectural trim contrasts privately on your
                  device before requesting on-site drawdown samples.
                </p>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-warm-grey/30 flex flex-wrap items-center justify-between gap-3">
              <Link
                href="/visualiser"
                className="inline-flex items-center gap-2 bg-[#20211F] text-[#F4F1EA] hover:bg-[#7E6340] px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors"
              >
                <span>Launch Visualiser</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
              <Link
                href="/about"
                className="font-mono text-[11px] uppercase tracking-[0.16em] text-bronze hover:underline underline-offset-4"
              >
                Read Studio Standards &rarr;
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
