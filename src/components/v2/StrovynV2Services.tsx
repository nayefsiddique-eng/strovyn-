'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { SERVICES_DATA } from '@/data/servicesData';
import { cn } from '@/lib/utils';

export const StrovynV2Services: React.FC = () => {
  const [activeSlug, setActiveSlug] = useState<string>(SERVICES_DATA[0].slug);
  const activeService =
    SERVICES_DATA.find((s) => s.slug === activeSlug) ?? SERVICES_DATA[0];

  return (
    <section
      id="v2-services"
      aria-label="Architectural Painting Services"
      className="w-full bg-ivory-light text-charcoal border-b border-warm-grey/35 py-20 md:py-28 lg:py-32"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        {/* Section Heading */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-warm-grey/35 pb-8 mb-12 lg:mb-16">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-bronze font-semibold block mb-3">
              [ 02 / ARCHITECTURAL DISCIPLINES ]
            </span>
            <h2 className="type-section-title text-3xl sm:text-5xl uppercase text-charcoal">
              Six Specialist Coating Systems.
            </h2>
          </div>

          <Link
            href="/services"
            className="inline-flex items-center gap-2 self-start md:self-auto border border-charcoal/30 px-5 py-3 font-mono text-xs uppercase tracking-[0.18em] text-charcoal hover:border-bronze hover:text-bronze transition-colors"
          >
            <span>All Service Specifications</span>
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {/* 12-Column Interactive Discipline Index + Live Specification Dossier */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* Left 7 Columns: Structured Architectural Ledger */}
          <div className="lg:col-span-7 border-t border-warm-grey/35">
            {SERVICES_DATA.map((service) => {
              const isSelected = service.slug === activeService.slug;
              return (
                <div
                  key={service.slug}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isSelected}
                  onMouseEnter={() => setActiveSlug(service.slug)}
                  onClick={() => setActiveSlug(service.slug)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveSlug(service.slug);
                    }
                  }}
                  className={cn(
                    'group relative border-b border-warm-grey/35 py-6 px-4 sm:px-5 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-bronze',
                    isSelected ? 'bg-white' : 'hover:bg-white/60'
                  )}
                >
                  {isSelected && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-0 bottom-0 w-1 bg-[#C41E1E]"
                    />
                  )}

                  <div className="flex items-baseline justify-between gap-4">
                    <div className="flex items-baseline gap-4 sm:gap-5 min-w-0">
                      <span
                        className={cn(
                          'font-mono text-xs tracking-[0.2em] shrink-0',
                          isSelected ? 'text-[#C41E1E] font-semibold' : 'text-warm-grey-dark'
                        )}
                      >
                        {service.number}
                      </span>
                      <div className="min-w-0">
                        <h3 className="type-card-title text-xl sm:text-2xl uppercase text-charcoal group-hover:text-bronze transition-colors">
                          {service.title}
                        </h3>
                        <p className="font-sans text-xs sm:text-sm text-charcoal-muted mt-1.5 leading-relaxed">
                          {service.shortDescription}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={`/services/${service.slug}`}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Open ${service.title} specification`}
                      className="shrink-0 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-bronze hover:underline underline-offset-4"
                    >
                      <span className="hidden sm:inline">Spec</span>
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right 5 Columns: Sticky Technical Specification Dossier */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 bg-white border border-warm-grey/45 p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between border-b border-warm-grey/30 pb-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-bronze font-semibold">
                DOSSIER // {activeService.number}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-warm-grey-dark">
                {activeService.category}
              </span>
            </div>

            <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#181917] border border-warm-grey/30">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeService.slug}
                  initial={{ opacity: 0.25, scale: 1.02 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0.25 }}
                  transition={{ duration: 0.35 }}
                  className="relative h-full w-full"
                >
                  <Image
                    src={activeService.heroImage}
                    alt={`${activeService.title} — Strovyn Painting Co.`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-cover object-center"
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="space-y-3">
              <h4 className="type-card-title text-2xl uppercase text-charcoal">
                {activeService.title}
              </h4>
              <p className="font-sans text-xs sm:text-sm text-charcoal-muted leading-relaxed">
                {activeService.fullDescription}
              </p>
            </div>

            <div className="border-t border-warm-grey/30 pt-4 space-y-2.5 text-xs font-sans">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-bronze font-semibold block">
                  Tolerance Standard
                </span>
                <p className="text-charcoal-muted mt-0.5">{activeService.tolerances}</p>
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-bronze font-semibold block">
                  Formulation Chemistry
                </span>
                <p className="text-charcoal-muted mt-0.5">{activeService.chemistry}</p>
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-bronze font-semibold block mb-1.5">
                  Compatible Substrates
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {activeService.substrateSuitability.map((sub) => (
                    <span
                      key={sub}
                      className="border border-warm-grey/45 bg-ivory px-2 py-0.5 font-mono text-[10px] text-charcoal"
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-warm-grey/30 flex items-center justify-between gap-3">
              <Link
                href={`/services/${activeService.slug}`}
                className="inline-flex items-center gap-2 bg-[#20211F] text-[#F4F1EA] hover:bg-[#7E6340] px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors"
              >
                <span>Full Discipline Page</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>

              <Link
                href={`/contact?service=${encodeURIComponent(activeService.title)}`}
                className="font-mono text-[11px] uppercase tracking-[0.16em] text-bronze hover:underline underline-offset-4"
              >
                Enquire &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
