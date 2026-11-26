'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight, MapPin } from 'lucide-react';
import type { PublicProjectDetail } from '@/lib/cms/publicProjects';
import { VERIFIED_PROJECT } from '@/components/home/FeaturedProjects';

export interface StrovynV2PortfolioProps {
  projects: PublicProjectDetail[];
  isLoading?: boolean;
}

export const StrovynV2Portfolio: React.FC<StrovynV2PortfolioProps> = ({
  projects,
  isLoading = false,
}) => {
  if (!isLoading && projects.length === 0) {
    return (
      <section
        id="v2-portfolio"
        aria-label="Selected Architectural Commissions"
        className="w-full bg-ivory text-charcoal border-b border-warm-grey/35 py-20 md:py-28"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12 text-center space-y-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-bronze font-semibold block">
            [ 04 / SELECTED COMMISSIONS ]
          </span>
          <p className="font-sans text-sm text-charcoal-muted">
            Architectural commission case studies are currently being updated.
          </p>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 border border-charcoal/35 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.18em] text-charcoal hover:border-bronze hover:text-bronze transition-colors"
          >
            <span>View Portfolio</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </section>
    );
  }

  const primary =
    projects.find((p) => p.isFeatured) ??
    projects.find((p) => p.slug === VERIFIED_PROJECT.slug) ??
    projects[0] ??
    null;

  const secondaryProjects = projects
    .filter((p) => !primary || p.slug !== primary.slug)
    .slice(0, 2);

  const primaryTitle =
    primary?.slug === VERIFIED_PROJECT.slug || !primary
      ? VERIFIED_PROJECT.title
      : primary.title;
  const primarySlug = primary?.slug ?? VERIFIED_PROJECT.slug;
  const primaryLocation = primary?.location ?? VERIFIED_PROJECT.location;
  const primaryCategory = primary?.category ?? VERIFIED_PROJECT.category;
  const primaryDescription = primary?.description ?? VERIFIED_PROJECT.overview;
  const primaryHero = primary?.heroImage ?? VERIFIED_PROJECT.views[0].image;

  return (
    <section
      id="v2-portfolio"
      aria-label="Selected Architectural Commissions"
      className="w-full bg-ivory text-charcoal border-b border-warm-grey/35 py-20 md:py-28 lg:py-32"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12 space-y-14">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-warm-grey/35 pb-8">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-bronze font-semibold block mb-3">
              [ 04 / SELECTED COMMISSIONS ]
            </span>
            <h2 className="type-section-title text-3xl sm:text-5xl uppercase text-charcoal">
              Documented Adelaide Work.
            </h2>
          </div>

          <Link
            href="/projects"
            className="inline-flex items-center gap-2 self-start md:self-auto bg-[#20211F] text-[#F4F1EA] hover:bg-[#7E6340] px-5 py-3 font-mono text-xs uppercase tracking-[0.18em] transition-colors"
          >
            <span>Explore Full Archive</span>
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {/* Primary Featured Commission Plate */}
        <motion.article
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-1 lg:grid-cols-12 border border-warm-grey/45 bg-white"
        >
          <Link
            href={`/projects/${primarySlug}`}
            className="lg:col-span-7 relative min-h-[300px] sm:min-h-[420px] overflow-hidden bg-[#181917] group block"
          >
            <Image
              src={primaryHero}
              alt={`${primaryTitle} — completed architectural painting by Strovyn Painting Co.`}
              fill
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
            />
            <span className="absolute top-4 left-4 bg-[#141513]/90 text-[#F4F1EA] border border-white/20 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]">
              {primaryCategory}
            </span>
          </Link>

          <div className="lg:col-span-5 p-6 sm:p-9 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-bronze">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{primaryLocation}</span>
              </div>

              <h3 className="type-section-title text-3xl sm:text-4xl uppercase text-charcoal">
                <Link href={`/projects/${primarySlug}`} className="hover:text-bronze transition-colors">
                  {primaryTitle}
                </Link>
              </h3>

              <p className="font-sans text-sm text-charcoal-muted leading-relaxed">
                {primaryDescription}
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-warm-grey/30 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-warm-grey-dark">
                VERIFIED CASE STUDY
              </span>
              <Link
                href={`/projects/${primarySlug}`}
                className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.18em] text-charcoal hover:text-bronze font-semibold transition-colors"
              >
                <span>View Commission</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </motion.article>

        {/* Secondary Views / Published CMS Projects */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {secondaryProjects.length >= 2
            ? secondaryProjects.map((proj) => (
                <article
                  key={proj.slug}
                  className="group border border-warm-grey/45 bg-white flex flex-col justify-between"
                >
                  <Link
                    href={`/projects/${proj.slug}`}
                    className="relative aspect-[16/10] w-full overflow-hidden bg-[#181917] block"
                  >
                    <Image
                      src={proj.heroImage}
                      alt={proj.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 48vw"
                      className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                  </Link>
                  <div className="p-6 space-y-2.5">
                    <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-bronze">
                      <span>{proj.category}</span>
                      <span>{proj.location}</span>
                    </div>
                    <h4 className="type-card-title text-2xl uppercase text-charcoal group-hover:text-bronze transition-colors">
                      <Link href={`/projects/${proj.slug}`}>{proj.title}</Link>
                    </h4>
                    <p className="font-sans text-xs sm:text-sm text-charcoal-muted line-clamp-2 leading-relaxed">
                      {proj.description}
                    </p>
                  </div>
                </article>
              ))
            : VERIFIED_PROJECT.views.slice(1, 3).map((view) => (
                <article
                  key={view.id}
                  className="group border border-warm-grey/45 bg-white flex flex-col justify-between"
                >
                  <Link
                    href={`/projects/${VERIFIED_PROJECT.slug}`}
                    className="relative aspect-[16/10] w-full overflow-hidden bg-[#181917] block"
                  >
                    <Image
                      src={view.image}
                      alt={view.alt}
                      fill
                      sizes="(max-width: 768px) 100vw, 48vw"
                      className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                  </Link>
                  <div className="p-6 space-y-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-bronze block">
                      {view.aspectLabel}
                    </span>
                    <h4 className="type-card-title text-2xl uppercase text-charcoal group-hover:text-bronze transition-colors">
                      <Link href={`/projects/${VERIFIED_PROJECT.slug}`}>{view.viewTitle}</Link>
                    </h4>
                  </div>
                </article>
              ))}
        </div>
      </div>
    </section>
  );
};
