import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { SERVICES_DATA, type ServiceDetail } from '@/data/servicesData';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'] as const;

export const V3ServicesOverview: React.FC = () => {
  return (
    <div
      role="main"
      className="w-full bg-[#F4F1EA] dark:bg-[#181917] text-[#20211F] dark:text-[#F4F1EA]"
    >
      {/* Editorial Capabilities Frontispiece */}
      <section className="px-5 sm:px-10 lg:px-16 pt-8 sm:pt-12 pb-16 sm:pb-20 border-b border-[#B8B5AE]/70 dark:border-white/15">
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[#20211F]/25 dark:border-white/20 py-2.5 mb-10 font-mono text-[10px] uppercase tracking-[0.22em] text-[#5C5A55] dark:text-[#B8B5AE]">
          <span>CAPABILITIES FOLIO &mdash; SIX SPECIALIST COATING DISCIPLINES</span>
          <span>AS/NZS 2311 &middot; ADELAIDE SA</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-8 space-y-5">
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F] block">
              § II &middot; ARCHITECTURAL CAPABILITIES
            </span>
            <h1 className="font-display uppercase text-[clamp(2.8rem,5.8vw,5.6rem)] leading-[0.92]">
              Six Engineered Surface Disciplines.
            </h1>
            <p className="font-sans text-base sm:text-lg text-[#42413D] dark:text-[#D5D2CA] font-light leading-[1.75] max-w-2xl">
              From micro-calibrated Level 5 interior finishes to breathable mineral facade
              petrification and sealed 2K joinery lacquering, each discipline operates under
              written substrate tolerances.
            </p>
          </div>

          {/* Quick-Jump Folio Strip */}
          <div className="lg:col-span-4 border-l border-[#B8B5AE]/70 dark:border-white/15 pl-5 space-y-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#7E6340] dark:text-[#C9B28F] block">
              DIRECT SPECIFICATION JUMP
            </span>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.16em]">
              {SERVICES_DATA.map((s, i) => (
                <a
                  key={s.slug}
                  href={`#discipline-${s.slug}`}
                  className="hover:text-[#C41E1E] dark:hover:text-[#C9B28F] truncate py-0.5"
                >
                  {ROMAN[i]} &middot; {s.title.split(' ')[0]}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Alternating Monograph Sequence (Odd: Left Plate; Even: Right Plate) */}
      <section className="px-5 sm:px-10 lg:px-16 divide-y divide-[#B8B5AE]/70 dark:divide-white/15">
        {SERVICES_DATA.map((service: ServiceDetail, idx: number) => {
          const isEven = idx % 2 === 1;
          return (
            <article
              key={service.slug}
              id={`discipline-${service.slug}`}
              className="py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start"
            >
              {/* Photographic Plate */}
              <div className={`lg:col-span-5 ${isEven ? 'lg:order-2' : 'lg:order-1'}`}>
                <Link
                  href={`/services/${service.slug}`}
                  className="group block overflow-hidden border border-[#B8B5AE]/70 dark:border-white/15 bg-[#141513]"
                >
                  <div
                    className={`relative ${
                      isEven ? 'aspect-[16/11]' : 'aspect-[4/5]'
                    } overflow-hidden`}
                  >
                    <Image
                      src={service.heroImage}
                      alt={service.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 42vw"
                      className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                  </div>
                </Link>
                <div className="mt-2.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-[#5C5A55] dark:text-[#B8B5AE]">
                  <span>
                    FOLIO {ROMAN[idx]} &mdash; DISCIPLINE {service.number}
                  </span>
                  <span>{service.substrateSuitability[0]}</span>
                </div>
              </div>

              {/* Technical Monograph Sheet */}
              <div
                className={`lg:col-span-7 space-y-6 ${
                  isEven ? 'lg:order-1' : 'lg:order-2'
                }`}
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F] block">
                  {service.category}
                </span>

                <h2 className="font-display uppercase text-3xl sm:text-5xl leading-[0.95]">
                  <Link
                    href={`/services/${service.slug}`}
                    className="hover:text-[#C41E1E] dark:hover:text-[#C9B28F] transition-colors"
                  >
                    {service.title}
                  </Link>
                </h2>

                <p className="font-sans text-sm sm:text-base text-[#3A3936] dark:text-[#D5D2CA] font-light leading-relaxed max-w-2xl">
                  {service.fullDescription}
                </p>

                {/* Tolerance & Chemistry Split Box */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#FAF8F4] dark:bg-[#1D1E1B] border border-[#B8B5AE]/75 dark:border-white/15 p-5">
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#7E6340] dark:text-[#C9B28F] block mb-1">
                      PLANAR &amp; FILM TOLERANCE
                    </span>
                    <p className="font-sans text-xs text-[#20211F] dark:text-[#F4F1EA] leading-relaxed">
                      {service.tolerances}
                    </p>
                  </div>
                  <div className="sm:border-l border-[#B8B5AE]/60 dark:border-white/15 sm:pl-4">
                    <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#7E6340] dark:text-[#C9B28F] block mb-1">
                      COATING CHEMISTRY
                    </span>
                    <p className="font-sans text-xs text-[#20211F] dark:text-[#F4F1EA] leading-relaxed">
                      {service.chemistry}
                    </p>
                  </div>
                </div>

                {/* Key Deliverables */}
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 font-sans text-xs sm:text-sm text-[#42413D] dark:text-[#C8C5BE]">
                  {service.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <span className="h-1.5 w-1.5 bg-[#C41E1E] mt-2 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-3 flex flex-wrap items-center gap-5">
                  <Link
                    href={`/services/${service.slug}`}
                    className="inline-flex items-center gap-2.5 bg-[#20211F] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#181917] hover:bg-[#C41E1E] dark:hover:bg-[#C9B28F] px-6 py-3.5 font-mono text-[10px] uppercase tracking-[0.22em] font-semibold transition-colors"
                  >
                    <span>Open Specification Sheet</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    href={`/contact?service=${encodeURIComponent(service.title)}`}
                    className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#7E6340] dark:text-[#C9B28F] border-b border-[#7E6340] dark:border-[#C9B28F] pb-1"
                  >
                    Enquire On Discipline &rarr;
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {/* Studio Drawdown Sample Panel Callout */}
      <section className="bg-[#141513] text-[#F4F1EA] px-5 sm:px-10 lg:px-16 py-16 sm:py-20 border-t border-white/15">
        <div className="max-w-4xl space-y-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#C9B28F] block">
            PHYSICAL DRAWDOWN BOARDS &middot; 600&times;600MM
          </span>
          <h2 className="font-display uppercase text-3xl sm:text-5xl leading-[0.94]">
            Require Project-Specific Sample Panels?
          </h2>
          <p className="font-sans text-sm sm:text-base text-[#D5D2CA] font-light leading-relaxed max-w-2xl">
            For architectural practices and full-residence repaints, we prepare physical substrate
            test boards so sheen levels and undertones can be evaluated in your room&rsquo;s actual
            diurnal light prior to commencement.
          </p>
          <div className="pt-2">
            <Link
              href="/contact"
              className="inline-flex items-center gap-3 bg-[#C41E1E] hover:bg-[#F4F1EA] hover:text-[#141513] text-[#F4F1EA] px-6 py-4 font-mono text-[11px] uppercase tracking-[0.22em] font-semibold transition-colors"
            >
              <span>Request Sample Review &amp; Consultation</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
