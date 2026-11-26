import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { SERVICES_DATA, type ServiceDetail } from '@/data/servicesData';
import { WHATSAPP_DETAILS } from '@/lib/constants';

export const V3ServiceDetail: React.FC<{ service: ServiceDetail }> = ({ service }) => {
  const otherServices = SERVICES_DATA.filter((s) => s.slug !== service.slug);

  return (
    <div
      role="main"
      className="w-full bg-[#F4F1EA] dark:bg-[#181917] text-[#20211F] dark:text-[#F4F1EA]"
    >
      {/* Monograph Breadcrumb & Asymmetric Header */}
      <section className="px-5 sm:px-10 lg:px-16 pt-8 sm:pt-12 pb-12 sm:pb-16">
        <nav
          aria-label="Breadcrumb"
          className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#5C5A55] dark:text-[#B8B5AE] mb-8 flex flex-wrap items-center gap-2 border-b border-[#B8B5AE]/60 dark:border-white/15 pb-3"
        >
          <Link href="/" className="hover:text-[#20211F] dark:hover:text-[#F4F1EA]">
            Frontispiece
          </Link>
          <span>/</span>
          <Link href="/services" className="hover:text-[#20211F] dark:hover:text-[#F4F1EA]">
            Six Disciplines
          </Link>
          <span>/</span>
          <span className="text-[#7E6340] dark:text-[#C9B28F]">{service.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-8 space-y-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F] block">
              DISCIPLINE {service.number} &mdash; {service.category}
            </span>
            <h1 className="font-display uppercase text-[clamp(2.6rem,5.5vw,5.2rem)] leading-[0.92]">
              {service.title}
            </h1>
            <p className="font-sans text-base sm:text-lg text-[#42413D] dark:text-[#D5D2CA] font-light leading-relaxed max-w-2xl">
              {service.shortDescription}
            </p>
          </div>

          <div className="lg:col-span-4 lg:text-right">
            <Link
              href={`/contact?service=${encodeURIComponent(service.title)}`}
              className="inline-flex items-center gap-3 bg-[#C41E1E] hover:bg-[#20211F] text-[#F4F1EA] px-6 py-4 font-mono text-[11px] uppercase tracking-[0.22em] font-semibold transition-colors"
            >
              <span>Specify This Discipline</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Widescreen 21:9 Cinema Plate (Adapted from Concept A) */}
      <section className="px-5 sm:px-10 lg:px-16 pb-16">
        <div className="relative aspect-[16/10] sm:aspect-[16/9] lg:aspect-[21/9] w-full overflow-hidden bg-[#141513] border border-[#B8B5AE]/70 dark:border-white/15">
          <Image
            src={service.heroImage}
            alt={service.title}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0E0F0E]/85 via-transparent to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 sm:bottom-8 sm:left-8 sm:right-8 flex flex-wrap items-end justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F4F1EA]">
            <span className="text-[#C9B28F]">AS/NZS 2311 SPECIFICATION DOSSIER</span>
            <span>GREATER ADELAIDE, SA</span>
          </div>
        </div>
      </section>

      {/* 7 / 5 Dossier Split: Narrative & 4-Step Protocol vs Sticky Benchmark Card */}
      <section className="px-5 sm:px-10 lg:px-16 pb-20 sm:pb-28 border-t border-[#B8B5AE]/70 dark:border-white/15 pt-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-start">
          {/* Left 7 Columns */}
          <div className="lg:col-span-7 space-y-14">
            <div className="space-y-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F] block">
                § I &middot; ARCHITECTURAL SCOPE
              </span>
              <h2 className="font-display uppercase text-3xl sm:text-4xl leading-[0.96]">
                Engineered For Long-Term Substrate Calm.
              </h2>
              <p className="font-sans text-base text-[#3A3936] dark:text-[#D5D2CA] font-light leading-[1.85]">
                {service.fullDescription}
              </p>
            </div>

            {/* Core Deliverables */}
            <div className="space-y-5 border-t border-[#B8B5AE]/70 dark:border-white/15 pt-10">
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F] block">
                § II &middot; INCLUDED DELIVERABLES
              </span>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {service.features.map((feat) => (
                  <li
                    key={feat}
                    className="p-4 bg-[#FAF8F4] dark:bg-[#1C1D1A] border border-[#B8B5AE]/65 dark:border-white/15 font-sans text-xs sm:text-sm text-[#20211F] dark:text-[#F4F1EA] flex items-start gap-3"
                  >
                    <span className="h-1.5 w-1.5 bg-[#C41E1E] mt-2 shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 4-Step Sequential Application Protocol */}
            <div className="space-y-6 border-t border-[#B8B5AE]/70 dark:border-white/15 pt-10">
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F] block">
                § III &middot; SEQUENTIAL APPLICATION PROTOCOL
              </span>
              <div className="divide-y divide-[#B8B5AE]/70 dark:divide-white/15 border-y border-[#B8B5AE]/70 dark:border-white/15">
                {service.processSteps.map((step) => (
                  <div key={step.step} className="py-5 flex items-start gap-5">
                    <span className="font-display text-3xl text-[#C41E1E] leading-none w-10 shrink-0">
                      {step.step}
                    </span>
                    <div>
                      <h3 className="font-display uppercase text-xl sm:text-2xl leading-tight">
                        {step.title}
                      </h3>
                      <p className="font-sans text-xs sm:text-sm text-[#4A4945] dark:text-[#B8B5AE] mt-1 font-light leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right 5 Columns: Sticky Technical Benchmark Folio */}
          <aside className="lg:col-span-5 lg:sticky lg:top-10 space-y-6">
            <div className="bg-[#FAF8F4] dark:bg-[#1B1C19] border border-[#20211F]/25 dark:border-white/20 p-6 sm:p-8 space-y-6">
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F] block border-b border-[#B8B5AE]/60 dark:border-white/15 pb-3">
                TECHNICAL BENCHMARK SCHEDULE
              </span>

              <div className="space-y-4">
                <div>
                  <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#5C5A55] dark:text-[#B8B5AE] block mb-1">
                    TOLERANCE &amp; PLANAR STANDARD
                  </span>
                  <p className="font-sans text-sm font-medium leading-relaxed">
                    {service.tolerances}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#B8B5AE]/50 dark:border-white/12">
                  <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#5C5A55] dark:text-[#B8B5AE] block mb-1">
                    MATERIAL CHEMISTRY
                  </span>
                  <p className="font-sans text-sm font-medium leading-relaxed">
                    {service.chemistry}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#B8B5AE]/50 dark:border-white/12">
                  <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#5C5A55] dark:text-[#B8B5AE] block mb-2">
                    APPROVED SUBSTRATES
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {service.substrateSuitability.map((sub) => (
                      <span
                        key={sub}
                        className="px-2.5 py-1 border border-[#B8B5AE] dark:border-white/20 bg-[#F4F1EA] dark:bg-[#141513] font-mono text-[10px] uppercase tracking-[0.15em]"
                      >
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#B8B5AE]/60 dark:border-white/15 space-y-3">
                <Link
                  href={`/contact?service=${encodeURIComponent(service.title)}`}
                  className="w-full inline-flex items-center justify-between bg-[#20211F] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#181917] hover:bg-[#C41E1E] dark:hover:bg-[#C9B28F] px-5 py-3.5 font-mono text-[10px] uppercase tracking-[0.22em] font-semibold transition-colors"
                >
                  <span>Request Site Assessment</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>

                <a
                  href={`https://wa.me/61406646061?text=${encodeURIComponent(`Hello Strovyn Painting Co. I would like to enquire about ${service.title} in Adelaide.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-between border border-[#20211F]/35 dark:border-white/25 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.2em] hover:border-[#7E6340]"
                >
                  <span>WhatsApp {WHATSAPP_DETAILS.displayNumber}</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* Companion Disciplines */}
            <div className="bg-[#141513] text-[#F4F1EA] p-6 sm:p-7 space-y-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#C9B28F] block">
                COMPANION DISCIPLINES
              </span>
              <ul className="divide-y divide-white/12">
                {otherServices.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={`/services/${s.slug}`}
                      className="py-2.5 flex items-center justify-between font-sans text-xs text-[#D5D2CA] hover:text-[#C9B28F] transition-colors"
                    >
                      <span>{s.title}</span>
                      <span className="font-mono text-[10px] text-[#C9B28F]">{s.number}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
};
