'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';

export interface VerifiedProjectGalleryItem {
  id: string;
  viewTitle: string;
  aspectLabel: string;
  image: string;
  alt: string;
}

export const VERIFIED_PROJECT = {
  id: 'adelaide-residence',
  title: 'Adelaide Residence',
  subtitle: 'Comprehensive Interior Architectural Painting',
  slug: 'the-north-adelaide-residence',
  category: 'Architectural Residential',
  location: 'Adelaide, South Australia',
  overview:
    'A completed private residential commission executed across open-plan living, kitchen, and dining spaces. Built around meticulous substrate preparation, dust-controlled surface sanding, and clean planar finishes capturing natural light without flash or raking defects.',
  views: [
    {
      id: 'view-living-dining',
      viewTitle: 'Living & Dining Gallery',
      aspectLabel: 'VIEW 01 // OPEN-PLAN LIVING & DINING',
      image: '/images/projects/adelaide-luxury-residence/living-dining-2.jpg',
      alt: 'Adelaide Residence — Living and dining view showcasing finished walls and ceilings by Strovyn Painting Co.',
    },
    {
      id: 'view-living-kitchen',
      viewTitle: 'Living Suite & Transition',
      aspectLabel: 'VIEW 02 // LIVING SUITE & KITCHEN TRANSITION',
      image: '/images/projects/adelaide-luxury-residence/living-kitchen-1.jpg',
      alt: 'Adelaide Residence — Living suite and kitchen junction with precision ceiling cut-in lines by Strovyn Painting Co.',
    },
    {
      id: 'view-kitchen-patio',
      viewTitle: 'Kitchen Island & Patio Aspect',
      aspectLabel: 'VIEW 03 // KITCHEN ISLAND & PATIO ASPECT',
      image: '/images/projects/adelaide-luxury-residence/kitchen-island-patio-3.jpg',
      alt: 'Adelaide Residence — Kitchen island looking toward sliding patio doors with seamless daylight reflection by Strovyn Painting Co.',
    },
  ] as VerifiedProjectGalleryItem[],
};

export interface FeaturedProjectsProps {
  className?: string;
}

export const FeaturedProjects: React.FC<FeaturedProjectsProps> = ({ className = '' }) => {
  return (
    <section
      id="projects"
      aria-label="Featured Architectural Projects"
      className={`relative w-full bg-ivory text-charcoal py-24 md:py-36 border-b border-warm-grey/30 overflow-hidden ${className}`}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col md:flex-row md:items-end justify-between border-b border-warm-grey/30 pb-6 mb-16 gap-6"
        >
          <div>
            <span className="font-sans text-xs sm:text-sm uppercase tracking-[0.2em] text-bronze font-medium block mb-3">
              [ 03 / PORTFOLIO &amp; COMMISSIONS ]
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl md:text-6xl text-charcoal tracking-tight max-w-2xl">
              Featured Architectural Commissions.
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-warm-grey-dark uppercase tracking-widest hidden sm:inline-block">
              [COMMISSION ARCHIVE // ADELAIDE]
            </span>
            <Button
              variant="outline"
              size="md"
              href="/projects"
              rightIcon={
                <svg
                  className="w-4 h-4 ml-1"
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
                  />
                </svg>
              }
            >
              View All Projects
            </Button>
          </div>
        </motion.div>

        {/* Editorial Notice on Verified Commission */}
        <div className="mb-10 p-3 bg-white/70 border border-warm-grey/30 text-xs font-mono text-warm-grey-dark flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>PROJECT ARCHIVE // VERIFIED RESIDENTIAL COMMISSION</span>
          <span className="text-bronze font-semibold uppercase">{VERIFIED_PROJECT.location}</span>
        </div>

        {/* Unified Project Showcase: 1 Verified Project Gallery */}
        <div className="border border-warm-grey/40 bg-white overflow-hidden shadow-md">
          {/* Top Hero Layout: Flagship Living & Dining View paired with Project Narrative */}
          <div className="grid grid-cols-1 lg:grid-cols-12 border-b border-warm-grey/30">
            {/* Primary View (Living & Dining) */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-7 relative aspect-[16/10] sm:aspect-[16/9] lg:aspect-auto lg:min-h-[420px] overflow-hidden bg-charcoal group"
            >
              <Link
                href={`/projects/${VERIFIED_PROJECT.slug}`}
                className="relative block w-full h-full cursor-pointer"
                aria-label={`${VERIFIED_PROJECT.title} - ${VERIFIED_PROJECT.views[0].viewTitle}`}
              >
                <Image
                  src={VERIFIED_PROJECT.views[0].image}
                  alt={VERIFIED_PROJECT.views[0].alt}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover object-center filter contrast-[1.04] transition-transform duration-1000 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-300" />

                {/* Identification Badges */}
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                  <span className="font-mono text-[10px] bg-charcoal text-white px-2.5 py-1 tracking-widest uppercase">
                    {VERIFIED_PROJECT.category}
                  </span>
                  <span className="font-mono text-[10px] bg-white text-charcoal border border-warm-grey/40 px-2 py-1 tracking-widest font-semibold uppercase">
                    Adelaide
                  </span>
                </div>

                {/* Corner Spec Stamp */}
                <div className="absolute bottom-4 left-4 right-4 z-10 font-mono text-[10px] text-white/90 uppercase tracking-widest bg-black/60 px-3 py-1.5 backdrop-blur-none flex items-center justify-between pointer-events-none">
                  <span>{VERIFIED_PROJECT.views[0].aspectLabel}</span>
                  <span className="text-white font-medium">STROVYN RESIDENTIAL</span>
                </div>
              </Link>
            </motion.div>

            {/* Project Narrative & Meta Column */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-5 p-6 sm:p-10 flex flex-col justify-between bg-white"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-mono text-warm-grey-dark uppercase tracking-wider mb-3">
                  <span>{VERIFIED_PROJECT.location}</span>
                  <span className="text-bronze font-medium">COMPLETED COMMISSION</span>
                </div>

                <h3 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-charcoal mb-2">
                  <Link
                    href={`/projects/${VERIFIED_PROJECT.slug}`}
                    className="hover:text-bronze transition-colors"
                  >
                    {VERIFIED_PROJECT.title}
                  </Link>
                </h3>

                <span className="font-mono text-xs uppercase tracking-wider text-brand-red font-medium block mb-4">
                  {VERIFIED_PROJECT.subtitle}
                </span>

                <p className="font-sans text-xs sm:text-sm text-charcoal-muted leading-relaxed font-light mb-6">
                  {VERIFIED_PROJECT.overview}
                </p>

                <div className="space-y-2 border-t border-warm-grey/25 pt-4 text-xs font-mono text-charcoal/80">
                  <div className="flex justify-between">
                    <span className="text-warm-grey-dark uppercase">Scope:</span>
                    <span className="font-medium text-right">Living, Dining &amp; Kitchen Interior</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-warm-grey-dark uppercase">Surface Prep:</span>
                    <span className="font-medium text-right">Planar Skim &amp; Dustless Sanding</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-warm-grey-dark uppercase">Finish Standard:</span>
                    <span className="font-medium text-right">Light-Responsive Wall &amp; Ceiling Finish</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-warm-grey/25 mt-6 flex items-center justify-between">
                <span className="font-mono text-xs text-warm-grey-dark uppercase tracking-widest">
                  3 GALLERY VIEWS BELOW
                </span>
                <Link
                  href={`/projects/${VERIFIED_PROJECT.slug}`}
                  className="font-mono text-xs uppercase tracking-[0.16em] text-charcoal hover:text-brand-red font-semibold transition-colors inline-flex items-center gap-2"
                >
                  <span>Explore Case Study</span>
                  <span className="transition-transform hover:translate-x-1">&rarr;</span>
                </Link>
              </div>
            </motion.div>
          </div>

          {/* Bottom Secondary Views: 2-Column Grid presenting remaining authentic perspectives */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-warm-grey/30 bg-ivory/20">
            {VERIFIED_PROJECT.views.slice(1).map((view, idx) => (
              <motion.div
                key={view.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.7, delay: 0.15 * (idx + 1), ease: [0.16, 1, 0.3, 1] }}
                className="group flex flex-col justify-between p-6 sm:p-8"
              >
                <Link
                  href={`/projects/${VERIFIED_PROJECT.slug}`}
                  className="relative aspect-[16/10] w-full overflow-hidden bg-charcoal block cursor-pointer mb-4"
                  aria-label={`${VERIFIED_PROJECT.title} - ${view.viewTitle}`}
                >
                  <Image
                    src={view.image}
                    alt={view.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover object-center filter contrast-[1.04] transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-300" />

                  <div className="absolute bottom-3 left-3 right-3 font-mono text-[9px] sm:text-[10px] text-white uppercase tracking-wider bg-black/60 px-2.5 py-1 pointer-events-none">
                    {view.aspectLabel}
                  </div>
                </Link>

                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-serif text-base text-charcoal font-medium">
                    {view.viewTitle}
                  </span>
                  <Link
                    href={`/projects/${VERIFIED_PROJECT.slug}`}
                    className="text-bronze hover:text-charcoal uppercase tracking-wider text-[11px] font-semibold transition-colors inline-flex items-center gap-1"
                  >
                    <span>View Detail</span>
                    <span>&rarr;</span>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturedProjects;
