import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { SERVICES_DATA } from '@/data/servicesData';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Services & Finishes',
  description:
    'Comprehensive architectural painting, Level 5 interior coatings, exterior facade restoration, artisanal Venetian plasters, and fine millwork lacquering.',
};

export default function ServicesPage() {
  return (
    <main className="w-full min-h-screen bg-ivory text-charcoal">
      {/* Hero Header */}
      <section className="relative pt-36 pb-20 md:pt-44 md:pb-28 border-b border-warm-grey/30 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-4">
          [ ARCHITECTURAL CAPABILITIES ]
        </span>
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-normal leading-[1.1] text-charcoal max-w-4xl mb-8">
          Architectural Finishing Disciplines
        </h1>
        <p className="font-sans text-lg sm:text-xl text-charcoal/80 max-w-2xl leading-relaxed">
          From micro-calibrated Level 5 spray applications to hand-burnished Venetian plasters, our six specialized disciplines are engineered to satisfy the most demanding architectural tolerances.
        </p>
      </section>

      {/* Services Grid */}
      <section className="py-20 md:py-28 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        <div className="space-y-16 lg:space-y-24">
          {SERVICES_DATA.map((service, index) => (
            <div
              key={service.slug}
              className={`grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 pb-16 lg:pb-24 ${
                index !== SERVICES_DATA.length - 1 ? 'border-b border-warm-grey/30' : ''
              }`}
            >
              {/* Image side */}
              <div className="lg:col-span-5 relative aspect-[4/3] bg-warm-grey/10 border border-warm-grey/30 overflow-hidden">
                <Image
                  src={service.heroImage}
                  alt={service.title}
                  fill
                  className="object-cover transition-transform duration-700 hover:scale-105"
                  sizes="(max-width: 1024px) 100vw, 40vw"
                />
                <span className="absolute top-4 left-4 font-mono text-xs bg-charcoal text-white px-3 py-1 tracking-widest">
                  DISCIPLINE {service.number}
                </span>
              </div>

              {/* Content side */}
              <div className="lg:col-span-7 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-sans text-xs uppercase tracking-[0.16em] text-bronze font-medium">
                      {service.category}
                    </span>
                  </div>
                  <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl text-charcoal mb-4">
                    <Link
                      href={`/services/${service.slug}`}
                      className="hover:text-bronze transition-colors"
                    >
                      {service.title}
                    </Link>
                  </h2>
                  <p className="font-sans text-base text-charcoal/80 leading-relaxed mb-6">
                    {service.fullDescription}
                  </p>

                  <div className="mb-6 bg-white p-5 border border-warm-grey/30">
                    <span className="font-sans text-xs uppercase tracking-wider text-warm-grey-dark block mb-2 font-medium">
                      Key Technical Deliverables:
                    </span>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-charcoal/85">
                      {service.features.map((feat) => (
                        <li key={feat} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-bronze flex-shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-4">
                  <Button href={`/services/${service.slug}`} variant="primary" size="md">
                    Explore Technical Specs
                  </Button>
                  <Button href="/contact" variant="outline" size="md">
                    Request Consultation
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 bg-charcoal text-white px-6 sm:px-8 lg:px-12 border-t border-charcoal">
        <div className="max-w-4xl mx-auto text-center">
          <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-4">
            [ BESPOKE SPECIFICATIONS ]
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-normal mb-6">
            Need custom chemistry or on-site drawdown samples?
          </h2>
          <p className="font-sans text-base sm:text-lg text-warm-grey leading-relaxed mb-8 max-w-2xl mx-auto">
            We deliver 600×600mm substrate test panels directly to your design studio for light-balancing and client sign-off.
          </p>
          <Button href="/contact" variant="primary" size="lg" className="max-w-full text-center">
            <span className="truncate sm:whitespace-normal">Order Sample Box &amp; Specification Review</span>
          </Button>
        </div>
      </section>
    </main>
  );
}
