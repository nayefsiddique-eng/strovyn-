'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

export interface ServiceItem {
  id: string;
  number: string;
  title: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  specifications: string[];
  substrates: string;
  image: string;
  tag: string;
}

export const servicesData: ServiceItem[] = [
  {
    id: 'interior',
    number: '01',
    title: 'Interior Architectural Painting',
    slug: 'interior-architectural-painting',
    shortDescription:
      'Level 5 finish standards, precision shadow lines, and light-responsive pigment depths.',
    fullDescription:
      'Specialized full-scale interior coatings engineered to AS/NZS 2311 Level 5 specifications. We ensure continuous planar uniformity, micro-sanded drywalls, and crisp intersections across high-raking light environments.',
    specifications: [
      'Level 5 Plasterboard Skim & Machine Sanding',
      'Ultra-Low Sheen & Deep Velvet Matte Formulations',
      'Shadow Line & Reveal Junction Precision',
      'Dust-Free HEPA Sanding Extraction On-Site',
    ],
    substrates: 'Drywall, plasterboard, fibrous plaster, architectural masonry',
    image:
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    tag: 'Architectural Residential',
  },
  {
    id: 'exterior',
    number: '02',
    title: 'Exterior Facade Restoration & Coatings',
    slug: 'exterior-facade-restoration',
    shortDescription:
      'Breathable mineral silicates and protective elastomeric systems built for extreme weather.',
    fullDescription:
      'Architectural envelope coatings utilizing potassium silicate and micro-porous resins that crystallize into masonry substrates. Formulated for moisture breathability, UV color stability, and crack-bridging durability.',
    specifications: [
      'Potassium Silicate Masonry Systems',
      'Elastomeric Weatherproofing & Crack Bridging',
      'Substrate Moisture Equilibrium Verification',
      'Coastal Salt-Mist & UV-Resistant Formulations',
    ],
    substrates: 'Rendered masonry, AAC panels, concrete, architectural brick',
    image:
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
    tag: 'Facade Engineering',
  },
  {
    id: 'millwork',
    number: '03',
    title: 'Fine Cabinetry & Millwork Lacquering',
    slug: 'fine-cabinetry-millwork',
    shortDescription:
      'Factory-grade spray finishing, 2K polyurethanes, and velvet satin cabinetry finishes.',
    fullDescription:
      'Flawless spray applications for bespoke joinery, architectural paneling, and custom kitchens. Available both via controlled off-site spray booths and sealed on-site negative-pressure containment units.',
    specifications: [
      'Catalyzed 2K Polyurethane Systems',
      'Zero-Orange-Peel Spray Precision',
      'Sheen Customization: 5% Dead Flat to 90% High Gloss',
      'Chemical & Scratch-Resistant Surface Hardening',
    ],
    substrates: 'MDF, solid hardwoods, timber veneers, architectural metalwork',
    image:
      'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80',
    tag: 'Bespoke Joinery',
  },
  {
    id: 'plasters',
    number: '04',
    title: 'Artisanal Plasters & Lime Washes',
    slug: 'artisanal-plasters-lime-washes',
    shortDescription:
      'Hand-trowelled Venetian plaster, slaked lime washes, and organic marmorino textures.',
    fullDescription:
      'Tactile mineral finishes crafted from aged Italian slaked lime and crushed Carrara marble. Creates velvety, light-diffusing wall planes that regulate humidity naturally and develop subtle patina over decades.',
    specifications: [
      'Aged Grassello di Calce (Italian Slaked Lime)',
      'Hand-Polished Venetian & Marmorino Textures',
      'Natural Mineral Pigment Blending',
      'Hydrophobic Natural Beeswax Sealing',
    ],
    substrates: 'Prepared masonry, skimmed plasterboard, cement render',
    image:
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80',
    tag: 'Mineral Finishes',
  },
  {
    id: 'heritage',
    number: '05',
    title: 'Historic & Heritage Conservation',
    slug: 'historic-heritage-conservation',
    shortDescription:
      'Period molding restoration, archival paint analysis, and heritage pigment matching.',
    fullDescription:
      'Conservation-led coatings for Victorian, Edwardian, and Art Deco heritage properties. We restore damaged cornices, remediate aged coatings safely, and recreate authentic archival colors using historical pigment recipes.',
    specifications: [
      'Period-Accurate Mineral & Distemper Formulations',
      'Intricate Ornate Cornice & Rose Plaster Repair',
      'Lead-Safe Environmental Remediation Protocols',
      'Archival Paint Layer Stratigraphy & Matching',
    ],
    substrates: 'Lath and plaster, historic lime mortar, heritage wrought iron',
    image:
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
    tag: 'Conservation',
  },
  {
    id: 'commercial',
    number: '06',
    title: 'Commercial & Hospitality Finishes',
    slug: 'commercial-hospitality-finishes',
    shortDescription:
      'High-impact durability for boutique retail, luxury hotels, and flagship galleries.',
    fullDescription:
      'Scalable architectural coatings executed with accelerated scheduling and zero disruption. Engineered to withstand demanding commercial foot-traffic while delivering high aesthetic value and strict zero-VOC compliance.',
    specifications: [
      'High-Scuff Ceramic & Epoxy Formulations',
      'Acoustic Ceiling & Wall Coating Applications',
      'LEED & Green Star Zero-VOC Compliance',
      'Phased Overnight Execution & Clean Air Protocols',
    ],
    substrates: 'Commercial drywall, structural steel, exposed concrete, soffits',
    image:
      'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
    tag: 'Hospitality & Retail',
  },
];

export interface ServicesShowcaseProps {
  className?: string;
}

export const ServicesShowcase: React.FC<ServicesShowcaseProps> = ({ className }) => {
  const [activeServiceId, setActiveServiceId] = useState<string>(servicesData[0].id);

  const activeService =
    servicesData.find((service) => service.id === activeServiceId) || servicesData[0];

  return (
    <section
      id="services"
      aria-label="Services & Disciplines"
      className={cn(
        'relative w-full bg-ivory text-charcoal border-b border-warm-grey/30 py-20 md:py-28 lg:py-36',
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
          className="flex flex-col md:flex-row md:items-end justify-between border-b border-warm-grey/30 pb-6 mb-12 md:mb-16 gap-6"
        >
          <div>
            <span className="font-sans text-xs sm:text-sm uppercase tracking-[0.2em] text-bronze font-medium block mb-3">
              [ 02 / DISCIPLINES &amp; EXPERTISE ]
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-charcoal tracking-tight max-w-2xl">
              Disciplined execution across specialized architectural coatings.
            </h2>
          </div>

          <div className="shrink-0">
            <Button
              variant="outline"
              size="md"
              href="/services"
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

        {/* Interactive Services Showcase Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Interactive Service Rows */}
          <div className="lg:col-span-7 flex flex-col border-t border-warm-grey/30">
            {servicesData.map((service) => {
              const isActive = service.id === activeServiceId;
              return (
                <div
                  key={service.id}
                  onMouseEnter={() => setActiveServiceId(service.id)}
                  onClick={() => setActiveServiceId(service.id)}
                  className={cn(
                    'group relative border-b border-warm-grey/30 transition-all duration-300 cursor-pointer',
                    isActive ? 'bg-white/80 pl-6 sm:pl-8' : 'hover:bg-white/40 pl-3 sm:pl-4'
                  )}
                >
                  {/* Active Indicator Bar */}
                  {isActive && (
                    <motion.div
                      layoutId="activeServiceIndicator"
                      className="absolute left-0 top-0 bottom-0 w-1 bg-bronze"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}

                  <div className="py-6 sm:py-7 pr-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-baseline gap-4 sm:gap-6">
                        <span
                          className={cn(
                            'font-mono text-xs sm:text-sm transition-colors duration-200',
                            isActive ? 'text-bronze font-semibold' : 'text-warm-grey-dark'
                          )}
                        >
                          {service.number}
                        </span>
                        <h3
                          className={cn(
                            'font-serif text-xl sm:text-2xl transition-colors duration-200',
                            isActive ? 'text-charcoal' : 'text-charcoal-muted group-hover:text-charcoal'
                          )}
                        >
                          {service.title}
                        </h3>
                      </div>

                      <Badge
                        variant={isActive ? 'bronze' : 'default'}
                        size="sm"
                        className="hidden sm:inline-flex shrink-0"
                      >
                        {service.tag}
                      </Badge>
                    </div>

                    <p className="text-sm text-charcoal-muted font-sans pl-8 sm:pl-10 pr-6 leading-relaxed">
                      {service.shortDescription}
                    </p>

                    <div className="pl-8 sm:pl-10 pt-1 flex items-center gap-4">
                      <Link
                        href={`/services/${service.slug}`}
                        className="inline-flex items-center gap-1.5 text-xs font-sans uppercase tracking-[0.14em] font-medium text-bronze hover:text-bronze-hover transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>Explore Specifications</span>
                        <svg
                          className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1"
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
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Dynamic Architectural Preview Panel */}
          <div className="lg:col-span-5 sticky top-28 hidden lg:block">
            <div className="border border-warm-grey/40 bg-white p-6 sm:p-8 flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-warm-grey/30 pb-3">
                <span className="font-mono text-[11px] text-bronze uppercase tracking-widest font-medium">
                  SPEC // {activeService.number}
                </span>
                <span className="font-mono text-[10px] text-warm-grey-dark uppercase tracking-wider">
                  ACTIVE PREVIEW
                </span>
              </div>

              {/* Architectural Image Preview */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-charcoal border border-warm-grey/30">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeService.id}
                    initial={{ opacity: 0, scale: 1.03 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
                    className="relative w-full h-full"
                  >
                    <Image
                      src={activeService.image}
                      alt={`${activeService.title} by Strovyn Painting Co.`}
                      fill
                      sizes="(max-width: 1280px) 40vw, 480px"
                      className="object-cover object-center filter contrast-[1.04]"
                      priority={false}
                    />
                    {/* Subtle vignette border */}
                    <div className="absolute inset-0 border border-black/10 pointer-events-none" />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Architectural Breakdown */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-serif text-2xl text-charcoal mb-2">
                    {activeService.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-charcoal-muted leading-relaxed font-sans">
                    {activeService.fullDescription}
                  </p>
                </div>

                <div className="border-t border-warm-grey/30 pt-4 space-y-2">
                  <span className="block font-sans text-[11px] uppercase tracking-wider text-charcoal font-semibold">
                    Technical Specifications:
                  </span>
                  <ul className="space-y-1.5">
                    {activeService.specifications.map((spec, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-charcoal-muted font-sans">
                        <span className="text-bronze font-mono mt-0.5">•</span>
                        <span>{spec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-t border-warm-grey/30 pt-4 flex items-center justify-between">
                  <div className="text-[11px] font-sans text-warm-grey-dark">
                    <span className="font-medium text-charcoal block uppercase tracking-wider text-[10px]">
                      Substrates
                    </span>
                    <span>{activeService.substrates}</span>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    href={`/services/${activeService.slug}`}
                    className="shrink-0"
                  >
                    Details
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ServicesShowcase;
