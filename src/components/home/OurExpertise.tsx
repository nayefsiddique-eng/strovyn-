'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';

export interface ExpertiseItem {
  number: string;
  title: string;
  slug: string;
  shortDescription: string;
  spec: string;
  image: string;
}

export const expertiseServices: ExpertiseItem[] = [
  {
    number: '01',
    title: 'Interior Architectural Painting',
    slug: 'interior-architectural-painting',
    shortDescription:
      'High-specification finish standards, precision shadow line junctions, and light-responsive pigment depths engineered for raking daylight.',
    spec: 'Full Surface Skim & HEPA Dust-Controlled Sanding',
    image:
      'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80',
  },
  {
    number: '02',
    title: 'Exterior Facade Restoration & Coatings',
    slug: 'exterior-facade-restoration',
    shortDescription:
      'Breathable mineral silicates and protective elastomeric barrier systems formulated specifically for South Australian UV extremes.',
    spec: 'Potassium Silicate Masonry & Micro-Porous Weatherproofing',
    image:
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
  },
  {
    number: '03',
    title: 'Fine Cabinetry & Millwork Lacquering',
    slug: 'fine-cabinetry-millwork',
    shortDescription:
      'Factory-grade spray finishing, 2K polyurethanes, and velvet satin cabinetry finishes for bespoke architectural joinery.',
    spec: 'Catalyzed 2K Polyurethanes & Zero Orange-Peel Spraying',
    image:
      'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80',
  },
  {
    number: '04',
    title: 'Artisanal Plasters & Lime Washes',
    slug: 'artisanal-plasters-lime-washes',
    shortDescription:
      'Hand-trowelled Italian Venetian plaster, slaked lime washes, and organic marmorino textures that patina gracefully over decades.',
    spec: 'Grassello di Calce (Italian Slaked Lime) & Carrara Marble Blends',
    image:
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80',
  },
  {
    number: '05',
    title: 'Architectural Surface Restoration',
    slug: 'architectural-surface-restoration',
    shortDescription:
      'Substrate repair, precision planar skim-coating, and advanced remediation for weathered or degraded interior and exterior architectural surfaces.',
    spec: 'Substrate Consolidation & High-Adhesion Bonding Matrix',
    image:
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
  },
  {
    number: '06',
    title: 'Commercial & Hospitality Finishes',
    slug: 'commercial-hospitality-finishes',
    shortDescription:
      'High-scuff ceramic and zero-VOC coatings for flagship retail, boutique hotels, and cultural galleries with accelerated project milestones.',
    spec: 'High-Scuff Ceramic Epoxy & Green Star Zero-VOC Formulations',
    image:
      'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
  },
];

export interface OurExpertiseProps {
  className?: string;
}

export const OurExpertise: React.FC<OurExpertiseProps> = ({ className = '' }) => {
  return (
    <section
      id="expertise"
      aria-label="Our Expertise & Services"
      className={`relative w-full bg-[#20211F] text-white py-24 md:py-36 border-b border-white/10 overflow-hidden ${className}`}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col md:flex-row md:items-end justify-between border-b border-white/10 pb-6 mb-16 gap-6"
        >
          <div>
            <span className="font-sans text-xs sm:text-sm uppercase tracking-[0.2em] text-bronze font-medium block mb-3">
              [ 02 / DISCIPLINES &amp; SERVICES ]
            </span>
            <h2 className="type-section-title text-3xl sm:text-5xl md:text-6xl text-white max-w-2xl">
              Our Architectural Finishing Expertise.
            </h2>
          </div>

          <div className="shrink-0">
            <Button
              variant="outline"
              size="md"
              href="/services"
              className="text-white border-white/40 hover:bg-white hover:text-charcoal hover:border-white"
              rightIcon={
                <svg
                  className="w-4 h-4 ml-1"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M3 8H13M13 8L8.5 3.5M13 8L8.5 12.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="square"
                  />
                </svg>
              }
            >
              View All Disciplines
            </Button>
          </div>
        </motion.div>

        {/* Haven-Inspired Architectural Portfolio Grid (Large Image Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
          {expertiseServices.map((service, index) => (
            <motion.article
              key={service.slug}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{
                duration: 0.7,
                ease: [0.16, 1, 0.3, 1],
                delay: index * 0.1,
              }}
              className="group border border-white/10 bg-[#2A2B29] flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:border-bronze/50"
            >
              <div>
                {/* Large Architectural Photograph */}
                <Link
                  href={`/services/${service.slug}`}
                  className="relative aspect-[4/3] w-full overflow-hidden bg-charcoal block cursor-pointer"
                >
                  <Image
                    src={service.image}
                    alt={`${service.title} by Strovyn Painting Co.`}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/15 group-hover:bg-transparent transition-colors duration-300" />
                  
                  {/* Number Tag */}
                  <span className="absolute top-4 left-4 z-10 font-mono text-xs bg-charcoal text-white px-2.5 py-1 tracking-widest">
                    {service.number}
                  </span>
                </Link>

                {/* Editorial Details */}
                <div className="p-6 sm:p-8 flex flex-col gap-3">
                  <div className="border-b border-white/10 pb-3">
                    <span className="font-mono text-[10px] text-bronze uppercase tracking-widest font-semibold block mb-1">
                      SPECIFICATION
                    </span>
                    <span className="font-mono text-xs text-[#B8B5AE] leading-snug block">
                      {service.spec}
                    </span>
                  </div>

                  <h3 className="type-card-title text-2xl text-white group-hover:text-bronze transition-colors">
                    <Link href={`/services/${service.slug}`}>
                      {service.title}
                    </Link>
                  </h3>

                  <p className="font-sans text-xs sm:text-sm text-[#B8B5AE] leading-relaxed font-light">
                    {service.shortDescription}
                  </p>
                </div>
              </div>

              {/* Bottom Link Action */}
              <div className="p-6 sm:p-8 pt-0 border-t border-white/10 mt-4 flex items-center justify-between">
                <Link
                  href={`/services/${service.slug}`}
                  className="font-mono text-xs uppercase tracking-[0.16em] text-[#B8B5AE] group-hover:text-bronze font-medium transition-colors inline-flex items-center gap-2"
                >
                  <span>Explore Specifications</span>
                  <span className="transition-transform group-hover:translate-x-1">&rarr;</span>
                </Link>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default OurExpertise;
