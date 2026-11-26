'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { PublicProjectDetail } from '@/lib/cms/publicProjects';

const CATEGORIES = [
  'All',
  'Architectural Residential',
  'Heritage Restoration',
  'Artisanal Plasters',
  'Commercial & Hospitality',
] as const;

const STAGES = ['All', 'Completed', 'Active On-Site', 'Handover Phase'] as const;

export const V3ProjectsCatalog: React.FC<{ initialProjects: PublicProjectDetail[] }> = ({
  initialProjects,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStage, setSelectedStage] = useState<string>('All');

  const filtered = initialProjects.filter((p) => {
    const okCat = selectedCategory === 'All' || p.category === selectedCategory;
    const okStage = selectedStage === 'All' || p.lifecycle === selectedStage;
    return okCat && okStage;
  });

  const leadProject = filtered[0] ?? null;
  const archiveProjects = filtered.slice(1);

  return (
    <div
      role="main"
      className="w-full bg-[#F4F1EA] dark:bg-[#181917] text-[#20211F] dark:text-[#F4F1EA]"
    >
      {/* Editorial Portfolio Header & Filter Ledger */}
      <section className="px-5 sm:px-10 lg:px-16 pt-8 sm:pt-12 pb-12 sm:pb-16 border-b border-[#B8B5AE]/70 dark:border-white/15">
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[#20211F]/25 dark:border-white/20 py-2.5 mb-10 font-mono text-[10px] uppercase tracking-[0.22em] text-[#5C5A55] dark:text-[#B8B5AE]">
          <span>COMMISSION ARCHIVE &mdash; SOUTH AUSTRALIA</span>
          <span>VERIFIED ARCHITECTURAL CASE MONOGRAPHS</span>
        </div>

        <div className="max-w-3xl space-y-5 mb-12">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F] block">
            § III &middot; PORTFOLIO MONOGRAPH
          </span>
          <h1 className="font-display uppercase text-[clamp(2.8rem,5.8vw,5.6rem)] leading-[0.92]">
            Documented Commissions.
          </h1>
          <p className="font-sans text-base sm:text-lg text-[#42413D] dark:text-[#D5D2CA] font-light leading-[1.75]">
            Selected residential villas, contemporary architectural interiors, and surface
            conservation works across Greater Adelaide.
          </p>
        </div>

        {/* Tactile Filter Controls */}
        <div className="pt-6 border-t border-[#B8B5AE]/60 dark:border-white/15 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.18em] border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#20211F] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#181917] border-[#20211F] dark:border-[#F4F1EA] font-semibold'
                      : 'bg-[#FAF8F4] dark:bg-[#1C1D1A] text-[#4A4945] dark:text-[#C8C5BE] border-[#B8B5AE]/80 dark:border-white/20 hover:border-[#7E6340]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by stage">
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#7E6340] dark:text-[#C9B28F] mr-1">
              STAGE:
            </span>
            {STAGES.map((st) => {
              const active = selectedStage === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStage(st)}
                  className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#C41E1E] text-[#F4F1EA] border-[#C41E1E] font-semibold'
                      : 'bg-transparent text-[#5C5A55] dark:text-[#B8B5AE] border-[#B8B5AE]/70 dark:border-white/20 hover:border-[#7E6340]'
                  }`}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Commissions Showcase */}
      <section className="px-5 sm:px-10 lg:px-16 py-16 sm:py-24">
        {initialProjects.length === 0 ? (
          <div className="border border-[#B8B5AE] dark:border-white/20 bg-[#FAF8F4] dark:bg-[#1C1D1A] p-8 sm:p-12 space-y-4 max-w-3xl">
            <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F] block">
              CURATORIAL ARCHIVE NOTICE
            </span>
            <h2 className="font-display uppercase text-3xl">
              Commission Photography In Final Client Sign-Off.
            </h2>
            <p className="font-sans text-sm text-[#4A4945] dark:text-[#B8B5AE] font-light leading-relaxed">
              We publish residential case studies only once formal homeowner photography release is
              granted. Contact our Adelaide desk to inspect reference specifications or test
              pigments in our Wall Colour Visualiser.
            </p>
            <div className="pt-2 flex flex-wrap gap-4">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 bg-[#20211F] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#181917] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.2em] font-semibold"
              >
                <span>Request Reference Walkthrough</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/visualiser"
                className="inline-flex items-center gap-2 border border-[#20211F]/40 dark:border-white/30 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.2em]"
              >
                <span>Open Visualiser</span>
              </Link>
            </div>
          </div>
        ) : !leadProject ? (
          <div className="border border-[#B8B5AE] dark:border-white/20 bg-[#FAF8F4] dark:bg-[#1C1D1A] p-10 text-center space-y-4">
            <p className="font-sans text-sm text-[#4A4945] dark:text-[#C8C5BE]">
              No published commissions match the active category and stage filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('All');
                setSelectedStage('All');
              }}
              className="px-5 py-2.5 bg-[#20211F] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#181917] font-mono text-[10px] uppercase tracking-[0.2em] cursor-pointer"
            >
              Reset Archive Filters
            </button>
          </div>
        ) : (
          <div className="space-y-20">
            {/* Lead Commission: Widescreen 21:9 Cinema Spread */}
            <article className="space-y-8">
              <Link
                href={`/projects/${leadProject.slug}`}
                className="group block relative aspect-[4/3] sm:aspect-[16/9] lg:aspect-[21/9] w-full overflow-hidden bg-[#141513] border border-[#B8B5AE]/70 dark:border-white/15"
              >
                <Image
                  src={leadProject.heroImage}
                  alt={leadProject.title}
                  fill
                  priority
                  sizes="100vw"
                  className="object-cover object-center transition-transform duration-1000 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0E0F0E]/90 via-transparent to-transparent" />
                <div className="absolute top-5 left-5 bg-[#141513]/90 text-[#C9B28F] border border-white/20 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em]">
                  {leadProject.isDemonstrationSpec ? 'DEMONSTRATION STUDY' : leadProject.lifecycle}
                </div>
              </Link>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-7 space-y-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#7E6340] dark:text-[#C9B28F] block">
                    {leadProject.category} &middot; {leadProject.location} &middot; {leadProject.year}
                  </span>
                  <h2 className="font-display uppercase text-3xl sm:text-5xl leading-[0.94]">
                    <Link
                      href={`/projects/${leadProject.slug}`}
                      className="hover:text-[#C41E1E] dark:hover:text-[#C9B28F] transition-colors"
                    >
                      {leadProject.title}
                    </Link>
                  </h2>
                  <p className="font-sans text-sm sm:text-base text-[#42413D] dark:text-[#D5D2CA] font-light leading-relaxed max-w-2xl">
                    {leadProject.description}
                  </p>
                </div>

                <div className="lg:col-span-5 bg-[#FAF8F4] dark:bg-[#1C1D1A] border border-[#B8B5AE]/70 dark:border-white/15 p-6 space-y-4">
                  <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#7E6340] dark:text-[#C9B28F] block">
                    MATERIAL SPECIFICATION
                  </span>
                  <p className="font-mono text-xs text-[#20211F] dark:text-[#F4F1EA] leading-relaxed">
                    {leadProject.finishes || 'AS/NZS 2311 Level 5 Interior & Joinery System'}
                  </p>
                  <Link
                    href={`/projects/${leadProject.slug}`}
                    className="inline-flex items-center gap-2 bg-[#20211F] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#181917] hover:bg-[#C41E1E] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.2em] font-semibold transition-colors"
                  >
                    <span>Open Case Monograph</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </article>

            {/* Staggered Two-Column Archive Grid for Additional Projects */}
            {archiveProjects.length > 0 && (
              <div className="pt-12 border-t border-[#B8B5AE]/70 dark:border-white/15 grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16">
                {archiveProjects.map((proj, idx) => (
                  <article
                    key={proj.slug}
                    className={`group space-y-4 ${idx % 2 === 1 ? 'md:mt-16' : ''}`}
                  >
                    <Link
                      href={`/projects/${proj.slug}`}
                      className="block relative aspect-[16/11] overflow-hidden bg-[#141513] border border-[#B8B5AE]/70 dark:border-white/15"
                    >
                      <Image
                        src={proj.heroImage}
                        alt={proj.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 42vw"
                        className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                      />
                    </Link>
                    <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-[#7E6340] dark:text-[#C9B28F]">
                      <span>
                        {proj.category} &middot; {proj.location}
                      </span>
                      <span>{proj.isDemonstrationSpec ? 'DEMO SPEC' : proj.lifecycle}</span>
                    </div>
                    <h3 className="font-display uppercase text-2xl sm:text-3xl leading-tight">
                      <Link
                        href={`/projects/${proj.slug}`}
                        className="hover:text-[#C41E1E] dark:hover:text-[#C9B28F]"
                      >
                        {proj.title}
                      </Link>
                    </h3>
                    <p className="font-sans text-sm text-[#4A4945] dark:text-[#B8B5AE] font-light leading-relaxed line-clamp-3">
                      {proj.description}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
