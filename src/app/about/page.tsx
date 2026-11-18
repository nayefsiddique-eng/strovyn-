import React from 'react';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'About | Strovyn Painting Co.',
  description:
    'Learn about our dedication to architectural coatings, Level 5 surface preparation, and the philosophy of quiet luxury in contemporary finishes.',
};

export default function AboutPage() {
  return (
    <main className="w-full min-h-screen bg-ivory text-charcoal">
      {/* Editorial Hero Header */}
      <section className="relative pt-36 pb-20 md:pt-44 md:pb-28 border-b border-warm-grey/30 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-4">
          [ 01 / PHILOSOPHY & CRAFTSMANSHIP ]
        </span>
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-normal leading-[1.1] text-charcoal max-w-4xl mb-8">
          Quiet luxury achieved through unrelenting surface discipline.
        </h1>
        <p className="font-sans text-lg sm:text-xl text-charcoal/80 max-w-2xl leading-relaxed">
          At Strovyn Painting Co., we reject the concept of paint as merely cosmetic. Coatings are the definitive tactile skin that defines architectural light, edge sharpness, and spatial perception.
        </p>
      </section>

      {/* Split Editorial Story */}
      <section className="py-20 md:py-28 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto border-b border-warm-grey/30">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          <div className="lg:col-span-5">
            <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-3">
              [ THE FOUNDATION ]
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-charcoal mb-6">
              Where construction tolerances end, our precision begins.
            </h2>
            <div className="w-12 h-[2px] bg-bronze mb-8" />
            <p className="font-sans text-sm text-warm-grey-dark leading-relaxed">
              [ESTABLISHED FINISHING TRADITIONS — ARCHITECTURAL DISCIPLINE]
            </p>
          </div>

          <div className="lg:col-span-7 space-y-6 font-sans text-base text-charcoal/85 leading-relaxed">
            <p>
              Strovyn Painting Co. delivers premium residential and commercial painting across greater Adelaide, South Australia. We treat colour and coatings as craft rather than commodity.
            </p>
            <p>
              Founded on the principle that over 70% of finish quality is won in substrate diagnostics and zero-tolerance surface preparation, our painters combine dust-controlled machine sanding, hand-cut precision lines, and low-VOC formulations with a formal daylight sign-off before completion.
            </p>
            <p>
              From character villas in Norwood and North Adelaide to contemporary coastal and Adelaide Hills residences, we provide transparent on-site consultations, structured timelines, and respectful site discipline.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-6 border-t border-warm-grey/30">
              <div>
                <span className="font-serif text-3xl sm:text-4xl text-charcoal block mb-1">Level 5</span>
                <span className="font-sans text-xs uppercase tracking-wider text-warm-grey-dark">Standard Surface Spec</span>
              </div>
              <div>
                <span className="font-serif text-3xl sm:text-4xl text-charcoal block mb-1">99.97%</span>
                <span className="font-sans text-xs uppercase tracking-wider text-warm-grey-dark">HEPA Dust Extraction</span>
              </div>
              <div>
                <span className="font-serif text-3xl sm:text-4xl text-charcoal block mb-1">&lt; 12%</span>
                <span className="font-sans text-xs uppercase tracking-wider text-warm-grey-dark">Moisture WME Protocol</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The 4-Stage Surface Protocol */}
      <section className="py-20 md:py-28 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto border-b border-warm-grey/30">
        <div className="mb-14">
          <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-3">
            [ 02 / EXECUTION PROTOCOL ]
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl text-charcoal">
            The 4-Stage Architectural Protocol
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="border border-warm-grey/40 p-8 bg-white flex flex-col justify-between">
            <div>
              <span className="font-mono text-xs text-bronze uppercase tracking-widest block mb-4">PHASE 01</span>
              <h3 className="font-serif text-xl text-charcoal mb-3">Diagnostic &amp; Specification</h3>
              <p className="font-sans text-sm text-charcoal/75 leading-relaxed">
                Non-destructive moisture testing, substrate alkalinity checks, and on-site illumination audits to formulate exact tint and sheen balances.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-warm-grey/20 text-xs text-warm-grey-dark">
              Drawdown sample sign-off
            </div>
          </div>

          <div className="border border-warm-grey/40 p-8 bg-white flex flex-col justify-between">
            <div>
              <span className="font-mono text-xs text-bronze uppercase tracking-widest block mb-4">PHASE 02</span>
              <h3 className="font-serif text-xl text-charcoal mb-3">Substrate Rectification</h3>
              <p className="font-sans text-sm text-charcoal/75 leading-relaxed">
                Full-surface skim passes, hairline crack bridging, and HEPA-ducted dual-axis orbital sanding to ensure zero deflection across raking light.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-warm-grey/20 text-xs text-warm-grey-dark">
              Tolerances under 2mm / 2m
            </div>
          </div>

          <div className="border border-warm-grey/40 p-8 bg-white flex flex-col justify-between">
            <div>
              <span className="font-mono text-xs text-bronze uppercase tracking-widest block mb-4">PHASE 03</span>
              <h3 className="font-serif text-xl text-charcoal mb-3">Controlled Application</h3>
              <p className="font-sans text-sm text-charcoal/75 leading-relaxed">
                Micro-climate monitored application of pure mineral silicates, hand-burnished plasters, or automated low-pressure spray finishes.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-warm-grey/20 text-xs text-warm-grey-dark">
              Micron-calibrated film thickness
            </div>
          </div>

          <div className="border border-warm-grey/40 p-8 bg-white flex flex-col justify-between">
            <div>
              <span className="font-mono text-xs text-bronze uppercase tracking-widest block mb-4">PHASE 04</span>
              <h3 className="font-serif text-xl text-charcoal mb-3">Quality Audit &amp; Handover</h3>
              <p className="font-sans text-sm text-charcoal/75 leading-relaxed">
                500-lumen raking light verification, documented defect logging, and white-glove archival touch-up kit delivery.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-warm-grey/20 text-xs text-warm-grey-dark">
              Formula archive records
            </div>
          </div>
        </div>
      </section>

      {/* For Architects & Trade Partners */}
      <section className="py-20 md:py-28 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        <div className="bg-charcoal text-white p-8 sm:p-12 lg:p-16 border border-charcoal">
          <div className="max-w-3xl">
            <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-4">
              [ 03 / TRADE COLLABORATION ]
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-tight mb-6">
              Partnering with architects, interior designers, and master builders.
            </h2>
            <p className="font-sans text-base sm:text-lg text-warm-grey leading-relaxed mb-8">
              We provide formal specification schedules, 600×600mm physical brush-out sample panels, SWMS documentation, and seamless integration with complex construction timelines.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button href="/contact" variant="primary" size="lg">
                Schedule Architectural Consultation
              </Button>
              <Button href="/projects" variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-charcoal">
                Examine Portfolio
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
