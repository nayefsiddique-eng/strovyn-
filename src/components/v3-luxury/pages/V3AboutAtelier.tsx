import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

const PHASES = [
  {
    num: '01',
    title: 'Diagnostic & Specification',
    body: 'Non-destructive moisture equilibrium audits (< 12% WME), substrate alkalinity checks, and natural daylight evaluation to calibrate tint and sheen.',
    note: 'Drawdown sample sign-off',
  },
  {
    num: '02',
    title: 'Substrate Rectification',
    body: 'Full-surface skim passes, structural crack bridging, and Festool HEPA-ducted orbital sanding under 500-lumen oblique inspection beams.',
    note: 'Deviation < 1.5mm / 2m',
  },
  {
    num: '03',
    title: 'Controlled Application',
    body: 'Micro-climate monitored atomization of mineral silicates, low-VOC architectural mattes, slaked lime washes, or catalyzed 2K joinery lacquers.',
    note: 'Micron-calibrated film build',
  },
  {
    num: '04',
    title: 'Daylight Audit & Handover',
    body: 'Joint client walkthrough in ambient Adelaide daylight, shadowline inspection, and archival formula documentation for effortless future care.',
    note: 'Documented formula archive',
  },
] as const;

export const V3AboutAtelier: React.FC = () => {
  return (
    <div
      role="main"
      className="w-full bg-[#F4F1EA] dark:bg-[#181917] text-[#20211F] dark:text-[#F4F1EA]"
    >
      {/* Editorial Manifesto Frontispiece */}
      <section className="px-5 sm:px-10 lg:px-16 pt-8 sm:pt-12 pb-20 sm:pb-24 border-b border-[#B8B5AE]/70 dark:border-white/15">
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[#20211F]/25 dark:border-white/20 py-2.5 mb-12 font-mono text-[10px] uppercase tracking-[0.22em] text-[#5C5A55] dark:text-[#B8B5AE]">
          <span>ATELIER MANIFESTO &mdash; STROVYN PAINTING CO.</span>
          <span>ADELAIDE, SOUTH AUSTRALIA</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7 space-y-6">
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F] block">
              § VI &middot; PHILOSOPHY &amp; CRAFTSMANSHIP
            </span>
            <h1 className="font-display uppercase text-[clamp(2.8rem,5.8vw,5.6rem)] leading-[0.92]">
              Quiet Luxury Achieved Through Surface Discipline.
            </h1>
            <p className="font-sans text-base sm:text-lg text-[#42413D] dark:text-[#D5D2CA] font-light leading-[1.8] max-w-2xl">
              At Strovyn Painting Co., we reject the idea of paint as cosmetic trade cover.
              Coatings form the tactile skin that governs how South Australian light, shadowlines,
              and architectural volume are experienced every day.
            </p>
          </div>

          <figure className="lg:col-span-5 space-y-2.5">
            <div className="relative aspect-[4/3] overflow-hidden border border-[#B8B5AE]/70 dark:border-white/15 bg-[#141513]">
              <Image
                src="/images/painted-texture-detail.jpg"
                alt="Hand-applied mineral texture and brush study"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 38vw"
                className="object-cover object-center"
              />
            </div>
            <figcaption className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5C5A55] dark:text-[#B8B5AE]">
              PLATE &mdash; SURFACE PREPARATION &amp; MINERAL TEXTURE DISCIPLINE
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Literary Two-Column Foundation Essay */}
      <section className="px-5 sm:px-10 lg:px-16 py-20 sm:py-24 border-b border-[#B8B5AE]/70 dark:border-white/15 bg-[#EFECE4]/70 dark:bg-[#151614]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7E6340] dark:text-[#C9B28F] block">
              THE FOUNDATION
            </span>
            <h2 className="font-display uppercase text-3xl sm:text-5xl leading-[0.95]">
              Where Construction Tolerances End, Our Precision Begins.
            </h2>
          </div>

          <div className="lg:col-span-7 space-y-6 font-sans text-sm sm:text-base text-[#3A3936] dark:text-[#D5D2CA] font-light leading-[1.85]">
            <p>
              <span className="float-left font-display text-6xl leading-[0.82] pr-3.5 pt-1 text-[#C41E1E]">
                O
              </span>
              ver seventy percent of an architectural finish is won before the first topcoat is
              mixed. Across Norwood and North Adelaide heritage villas, Unley renovations, and
              contemporary Adelaide Hills residences, our finishers combine dust-controlled machine
              sanding, laser-crisp shadowline masking, and low-VOC mineral and polyurethane systems.
            </p>
            <p>
              Every project is managed with transparent written scope schedules, clean negative-air
              containment for occupied homes, and a formal daylight inspection alongside the client
              prior to handover.
            </p>

            <dl className="pt-6 border-t border-[#B8B5AE]/70 dark:border-white/15 grid grid-cols-3 gap-6">
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#7E6340] dark:text-[#C9B28F]">
                  SURFACE SPEC
                </dt>
                <dd className="font-display uppercase text-3xl sm:text-4xl mt-1">Level 5</dd>
              </div>
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#7E6340] dark:text-[#C9B28F]">
                  EXTRACTION
                </dt>
                <dd className="font-display uppercase text-3xl sm:text-4xl mt-1">99.97%</dd>
              </div>
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#7E6340] dark:text-[#C9B28F]">
                  MOISTURE WME
                </dt>
                <dd className="font-display uppercase text-3xl sm:text-4xl mt-1">&lt; 12%</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* 4-Stage Execution Protocol */}
      <section className="px-5 sm:px-10 lg:px-16 py-20 sm:py-24 border-b border-[#B8B5AE]/70 dark:border-white/15 space-y-12">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F] block mb-2">
            EXECUTION GOVERNANCE
          </span>
          <h2 className="font-display uppercase text-4xl sm:text-5xl leading-[0.94]">
            The Four-Stage Studio Protocol.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PHASES.map((phase) => (
            <article
              key={phase.num}
              className="bg-[#FAF8F4] dark:bg-[#1B1C19] border border-[#B8B5AE] dark:border-white/20 p-7 flex flex-col justify-between space-y-8"
            >
              <div className="space-y-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#C41E1E] font-semibold block">
                  PHASE {phase.num}
                </span>
                <h3 className="font-display uppercase text-2xl leading-tight">{phase.title}</h3>
                <p className="font-sans text-xs sm:text-sm text-[#4A4945] dark:text-[#B8B5AE] font-light leading-relaxed">
                  {phase.body}
                </p>
              </div>
              <div className="pt-4 border-t border-[#B8B5AE]/60 dark:border-white/15 font-mono text-[10px] uppercase tracking-[0.18em] text-[#7E6340] dark:text-[#C9B28F]">
                {phase.note}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Trade Collaboration Banner */}
      <section className="bg-[#141513] text-[#F4F1EA] px-5 sm:px-10 lg:px-16 py-16 sm:py-24">
        <div className="max-w-3xl space-y-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#C9B28F] block">
            ARCHITECTS, DESIGNERS &amp; MASTER BUILDERS
          </span>
          <h2 className="font-display uppercase text-3xl sm:text-5xl leading-[0.94]">
            Collaborative Specification &amp; On-Site Discipline.
          </h2>
          <p className="font-sans text-sm sm:text-base text-[#D5D2CA] font-light leading-relaxed">
            We partner with South Australian architectural studios, interior designers, and custom
            builders—supplying written coating schedules, 600&times;600mm physical brush-out
            panels, SWMS documentation, and reliable programme coordination.
          </p>
          <div className="pt-2 flex flex-wrap gap-4">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2.5 bg-[#C41E1E] hover:bg-[#F4F1EA] hover:text-[#141513] text-[#F4F1EA] px-6 py-4 font-mono text-[11px] uppercase tracking-[0.22em] font-semibold transition-colors"
            >
              <span>Schedule Trade Consultation</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 border border-white/25 hover:border-[#C9B28F] px-6 py-4 font-mono text-[11px] uppercase tracking-[0.2em]"
            >
              <span>Examine Commissions</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
