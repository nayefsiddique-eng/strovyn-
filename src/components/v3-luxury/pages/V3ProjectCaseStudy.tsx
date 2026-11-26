import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { PublicProjectDetail } from '@/lib/cms/publicProjects';

export const V3ProjectCaseStudy: React.FC<{
  project: PublicProjectDetail;
  relatedProjects: PublicProjectDetail[];
}> = ({ project, relatedProjects }) => {
  return (
    <div
      role="main"
      className="w-full bg-[#F4F1EA] dark:bg-[#181917] text-[#20211F] dark:text-[#F4F1EA]"
    >
      {/* Monograph Breadcrumb & Case Title */}
      <section className="px-5 sm:px-10 lg:px-16 pt-8 sm:pt-12 pb-10">
        <nav
          aria-label="Breadcrumb"
          className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#5C5A55] dark:text-[#B8B5AE] mb-8 flex flex-wrap items-center gap-2 border-b border-[#B8B5AE]/60 dark:border-white/15 pb-3"
        >
          <Link href="/" className="hover:text-[#20211F] dark:hover:text-[#F4F1EA]">
            Frontispiece
          </Link>
          <span>/</span>
          <Link href="/projects" className="hover:text-[#20211F] dark:hover:text-[#F4F1EA]">
            Commissions
          </Link>
          <span>/</span>
          <span className="text-[#7E6340] dark:text-[#C9B28F]">{project.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-8 space-y-4">
            <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em]">
              <span className="bg-[#20211F] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#181917] px-2.5 py-1 font-semibold">
                {project.isDemonstrationSpec ? 'Demonstration Study' : project.lifecycle}
              </span>
              <span className="text-[#7E6340] dark:text-[#C9B28F]">
                {project.category} &mdash; {project.location}
              </span>
            </div>
            <h1 className="font-display uppercase text-[clamp(2.8rem,5.8vw,5.6rem)] leading-[0.92]">
              {project.title}
            </h1>
          </div>

          <div className="lg:col-span-4 lg:text-right">
            <Link
              href={`/contact?scope=${encodeURIComponent(`Similar finish enquiry: ${project.title}`)}`}
              className="inline-flex items-center gap-2.5 bg-[#C41E1E] hover:bg-[#20211F] text-[#F4F1EA] px-6 py-4 font-mono text-[11px] uppercase tracking-[0.22em] font-semibold transition-colors"
            >
              <span>Inquire About Similar Finish</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Widescreen 21:9 Case-Study Header (Adapted from Concept A — Architectural Cinema) */}
      <section className="px-5 sm:px-10 lg:px-16 pb-16">
        <div className="relative aspect-[4/3] sm:aspect-[16/9] lg:aspect-[21/9] w-full overflow-hidden bg-[#141513] border border-[#B8B5AE]/70 dark:border-white/15">
          <Image
            src={project.heroImage}
            alt={project.title}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0E0F0E]/75 via-transparent to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 sm:bottom-8 sm:left-8 sm:right-8 flex flex-wrap items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F4F1EA]">
            <span className="text-[#C9B28F]">PLATE 01 &mdash; {project.location}</span>
            <span>{project.year}</span>
          </div>
        </div>
      </section>

      {/* 4 / 8 Open-Book Monograph: Sticky Spec Schedule vs Narrative & Scope */}
      <section className="px-5 sm:px-10 lg:px-16 py-16 sm:py-24 border-t border-[#B8B5AE]/70 dark:border-white/15">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          <aside className="lg:col-span-4 lg:sticky lg:top-10 bg-[#FAF8F4] dark:bg-[#1B1C19] border border-[#B8B5AE] dark:border-white/20 p-6 sm:p-8 space-y-5">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F] border-b border-[#B8B5AE]/60 dark:border-white/15 pb-3">
              ARCHITECTURAL SPECIFICATION
            </h2>
            <dl className="space-y-4 font-sans text-sm">
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                  YEAR
                </dt>
                <dd className="font-medium mt-0.5">{project.year}</dd>
              </div>
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                  LOCATION
                </dt>
                <dd className="font-medium mt-0.5">{project.location}</dd>
              </div>
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                  ARCHITECT / SPECIFIER
                </dt>
                <dd className="font-medium mt-0.5">{project.architect}</dd>
              </div>
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                  BUILDER / PRINCIPAL
                </dt>
                <dd className="font-medium mt-0.5">{project.builder}</dd>
              </div>
              {project.sheenLevels && (
                <div>
                  <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                    SHEEN CALIBRATION
                  </dt>
                  <dd className="font-mono text-xs mt-0.5">{project.sheenLevels}</dd>
                </div>
              )}
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#5C5A55] dark:text-[#B8B5AE]">
                  MATERIAL SYSTEM
                </dt>
                <dd className="font-mono text-xs mt-0.5">{project.finishes}</dd>
              </div>
            </dl>
          </aside>

          <div className="lg:col-span-8 space-y-10">
            <div className="space-y-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F] block">
                § I &middot; COMMISSION OVERVIEW
              </span>
              <h2 className="font-display uppercase text-3xl sm:text-4xl leading-[0.96]">
                Surface Execution &amp; Daylight Response.
              </h2>
              <p className="font-sans text-base sm:text-lg text-[#3A3936] dark:text-[#D5D2CA] font-light leading-[1.85]">
                {project.description}
              </p>
            </div>

            {project.challenges && (
              <div className="space-y-3 border-t border-[#B8B5AE]/60 dark:border-white/15 pt-8">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F]">
                  § II &middot; SUBSTRATE CHALLENGES &amp; REMEDIATION
                </h3>
                <p className="font-sans text-sm sm:text-base text-[#42413D] dark:text-[#C8C5BE] font-light leading-[1.8]">
                  {project.challenges}
                </p>
              </div>
            )}

            {project.scope.length > 0 && (
              <div className="space-y-4 border-t border-[#B8B5AE]/60 dark:border-white/15 pt-8">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F]">
                  § III &middot; EXECUTED SCOPE OF WORKS
                </h3>
                <ul className="space-y-3 border-l-2 border-[#C41E1E] pl-5 font-sans text-sm sm:text-base text-[#3A3936] dark:text-[#D5D2CA]">
                  {project.scope.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Before & After Pairs (Preserving CMS Before/After Capability) */}
      {project.beforeAfterPairs.length > 0 && (
        <section className="px-5 sm:px-10 lg:px-16 py-16 sm:py-20 border-t border-[#B8B5AE]/70 dark:border-white/15 bg-[#EFECE4] dark:bg-[#141513] space-y-10">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F] block mb-2">
              SUBSTRATE TRANSFORMATION
            </span>
            <h2 className="font-display uppercase text-3xl sm:text-4xl">
              Before &amp; After Documentation.
            </h2>
          </div>

          <div className="space-y-8">
            {project.beforeAfterPairs.map((pair) => (
              <div
                key={pair.pairKey}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#FAF8F4] dark:bg-[#1B1C19] border border-[#B8B5AE] dark:border-white/20 p-5"
              >
                <figure className="space-y-2">
                  <div className="relative aspect-[16/10] bg-[#141513] overflow-hidden">
                    <Image
                      src={pair.beforeUrl}
                      alt={pair.beforeAlt}
                      fill
                      sizes="(max-width: 768px) 100vw, 45vw"
                      className="object-cover"
                    />
                  </div>
                  <figcaption className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5C5A55] dark:text-[#B8B5AE]">
                    BEFORE &middot; {pair.beforeAlt}
                  </figcaption>
                </figure>

                <figure className="space-y-2">
                  <div className="relative aspect-[16/10] bg-[#141513] overflow-hidden">
                    <Image
                      src={pair.afterUrl}
                      alt={pair.afterAlt}
                      fill
                      sizes="(max-width: 768px) 100vw, 45vw"
                      className="object-cover"
                    />
                  </div>
                  <figcaption className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7E6340] dark:text-[#C9B28F]">
                    AFTER &middot; {pair.afterAlt}
                  </figcaption>
                </figure>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Photographic Detail Plates */}
      {project.galleryImages.length > 0 && (
        <section className="px-5 sm:px-10 lg:px-16 py-16 sm:py-24 border-t border-[#B8B5AE]/70 dark:border-white/15 space-y-10">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F] block mb-2">
              PHOTOGRAPHIC ARCHIVE
            </span>
            <h2 className="font-display uppercase text-3xl sm:text-4xl">
              Surface &amp; Junction Plates.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {project.galleryImages.map((imgUrl, idx) => (
              <figure key={`${imgUrl}-${idx}`} className="space-y-2">
                <div className="relative aspect-[16/11] bg-[#141513] border border-[#B8B5AE]/70 dark:border-white/15 overflow-hidden">
                  <Image
                    src={imgUrl}
                    alt={`${project.title} — Plate 0${idx + 2}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 44vw"
                    className="object-cover object-center transition-transform duration-700 hover:scale-105"
                  />
                </div>
                <figcaption className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5C5A55] dark:text-[#B8B5AE]">
                  FIG. 0{idx + 2} &mdash; ARCHITECTURAL JUNCTION DETAIL
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* Related Commissions */}
      {relatedProjects.length > 0 && (
        <section className="px-5 sm:px-10 lg:px-16 py-16 border-t border-[#B8B5AE]/70 dark:border-white/15 space-y-8">
          <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F] block">
            OTHER PUBLISHED COMMISSIONS
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedProjects.map((p) => (
              <Link
                key={p.slug}
                href={`/projects/${p.slug}`}
                className="group block border border-[#B8B5AE]/70 dark:border-white/15 bg-[#FAF8F4] dark:bg-[#1B1C19]"
              >
                <div className="relative aspect-[16/10] bg-[#141513] overflow-hidden">
                  <Image
                    src={p.heroImage}
                    alt={p.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 28vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#7E6340] dark:text-[#C9B28F] block mb-1">
                    {p.category}
                  </span>
                  <h3 className="font-display uppercase text-xl group-hover:text-[#C41E1E] transition-colors">
                    {p.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
