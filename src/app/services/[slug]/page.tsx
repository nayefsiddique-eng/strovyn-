import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { SERVICES_DATA } from '@/data/servicesData';
import { Button } from '@/components/ui/Button';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return SERVICES_DATA.map((service) => ({
    slug: service.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = SERVICES_DATA.find((s) => s.slug === slug);
  if (!service) return { title: 'Service Not Found' };

  return {
    title: service.title,
    description: service.shortDescription,
  };
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params;
  const service = SERVICES_DATA.find((s) => s.slug === slug);

  if (!service) {
    notFound();
  }

  return (
    <main className="w-full min-h-screen bg-ivory text-charcoal">
      {/* Breadcrumb & Hero */}
      <section className="relative pt-36 pb-16 md:pt-44 md:pb-24 border-b border-warm-grey/30 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        <nav className="font-sans text-xs uppercase tracking-widest text-warm-grey-dark mb-6 flex items-center gap-2">
          <Link href="/" className="hover:text-charcoal transition-colors">Home</Link>
          <span>/</span>
          <Link href="/services" className="hover:text-charcoal transition-colors">Services</Link>
          <span>/</span>
          <span className="text-bronze font-medium">{service.title}</span>
        </nav>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-3xl">
            <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-3">
              [ DISCIPLINE {service.number} &mdash; {service.category} ]
            </span>
            <h1 className="type-page-title text-4xl sm:text-5xl md:text-6xl text-charcoal">
              {service.title}
            </h1>
          </div>
          <div className="flex-shrink-0">
            <Button href="/contact" variant="primary" size="lg">
              Inquire About This Finish
            </Button>
          </div>
        </div>
      </section>

      {/* Hero Image Showcase */}
      <section className="w-full h-[50vh] sm:h-[60vh] relative bg-charcoal border-b border-warm-grey/30">
        <Image
          src={service.heroImage}
          alt={service.title}
          fill
          priority
          className="object-cover opacity-90"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 via-transparent to-transparent" />
        <div className="absolute bottom-8 left-6 sm:left-12 max-w-xl text-white">
          <span className="font-mono text-xs uppercase tracking-widest text-bronze-light block mb-1">
            ARCHITECTURAL SPECIFICATION
          </span>
          <p className="font-sans text-sm sm:text-base text-warm-grey-light">
            {service.shortDescription}
          </p>
        </div>
      </section>

      {/* Technical Specifications Matrix */}
      <section className="py-20 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto border-b border-warm-grey/30">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Main Description */}
          <div className="lg:col-span-7 space-y-8">
            <div>
              <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-2">
                OVERVIEW &amp; SCOPE
              </span>
              <h2 className="type-section-title text-3xl sm:text-4xl text-charcoal mb-4">
                Engineered for High-Exposure Substrates
              </h2>
              <p className="font-sans text-base sm:text-lg text-charcoal/80 leading-relaxed">
                {service.fullDescription}
              </p>
            </div>

            <div className="border-t border-warm-grey/30 pt-6">
              <h3 className="type-card-title text-xl sm:text-2xl text-charcoal mb-4">Core Deliverables</h3>
              <ul className="space-y-3 font-sans text-sm sm:text-base text-charcoal/85">
                {service.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-3">
                    <span className="w-2 h-2 bg-bronze mt-2 flex-shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 4-Step Process */}
            <div className="border-t border-warm-grey/30 pt-6">
              <h3 className="type-card-title text-xl sm:text-2xl text-charcoal mb-4">Sequential Application Protocol</h3>
              <div className="space-y-4">
                {service.processSteps.map((p) => (
                  <div key={p.step} className="flex gap-4 p-4 bg-white border border-warm-grey/30">
                    <span className="font-mono text-xs font-semibold text-bronze">{p.step}</span>
                    <div>
                      <h4 className="font-sans font-semibold text-sm text-charcoal">{p.title}</h4>
                      <p className="font-sans text-xs sm:text-sm text-warm-grey-dark mt-1">{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar / Specs */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 sm:p-8 bg-white border border-warm-grey/40">
              <span className="font-mono text-xs text-bronze uppercase tracking-widest block mb-4">
                TECHNICAL BENCHMARKS
              </span>
              
              <div className="space-y-5 text-sm">
                <div>
                  <span className="font-sans text-xs uppercase text-warm-grey-dark block mb-1">
                    Tolerance &amp; Planar Standard
                  </span>
                  <p className="font-sans text-charcoal font-medium">
                    {service.tolerances}
                  </p>
                </div>

                <div className="pt-4 border-t border-warm-grey/20">
                  <span className="font-sans text-xs uppercase text-warm-grey-dark block mb-1">
                    Material Chemistry
                  </span>
                  <p className="font-sans text-charcoal font-medium">
                    {service.chemistry}
                  </p>
                </div>

                <div className="pt-4 border-t border-warm-grey/20">
                  <span className="font-sans text-xs uppercase text-warm-grey-dark block mb-1">
                    Substrate Suitability
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {service.substrateSuitability.map((sub) => (
                      <span key={sub} className="text-xs px-2.5 py-1 bg-ivory border border-warm-grey/40 text-charcoal">
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-warm-grey/30">
                <Button href="/contact" variant="primary" size="md" className="w-full text-center">
                  Request Specification Drawdown
                </Button>
                <a
                  href={`https://wa.me/61406646061?text=${encodeURIComponent(`Hello Strovyn Painting Co. I would like to enquire about ${service.title} in Adelaide.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 w-full py-2.5 px-4 bg-emerald-800 hover:bg-emerald-700 text-white font-sans text-xs uppercase tracking-wider font-medium text-center flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Chat on WhatsApp: 0406 646 061</span>
                </a>
              </div>
            </div>

            {/* Quick Link to all Services */}
            <div className="p-6 bg-charcoal text-white">
              <span className="font-mono text-xs text-bronze uppercase tracking-widest block mb-2">
                OTHER DISCIPLINES
              </span>
              <ul className="space-y-2 text-xs sm:text-sm text-warm-grey">
                {SERVICES_DATA.filter((s) => s.slug !== service.slug).map((s) => (
                  <li key={s.slug}>
                    <Link href={`/services/${s.slug}`} className="hover:text-white transition-colors flex items-center justify-between">
                      <span>{s.title}</span>
                      <span className="font-mono text-bronze">{s.number}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
