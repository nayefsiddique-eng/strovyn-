'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';

export interface ProjectShowcaseItem {
  id: string;
  title: string;
  slug: string;
  category: string;
  location: string;
  specification: string;
  description: string;
  image: string;
  year: string;
  span: string; // Tailwind grid span
}

export const showcaseProjects: ProjectShowcaseItem[] = [
  {
    id: 'adelaide-residence',
    title: 'Adelaide Luxury Living & Kitchen Residence',
    slug: 'the-north-adelaide-residence',
    category: 'Architectural Residential',
    location: 'Adelaide, SA',
    specification: 'Flawless Level 5 Interior Wall & Ceiling Finish',
    description:
      'Impeccable surface preparation across expansive open-plan living, dining and kitchen areas. Flawless white planar walls and ceilings capturing natural daylight with zero flash or raking flaws.',
    image:
      '/images/projects/adelaide-luxury-residence/living-dining-2.jpg',
    year: '2025',
    span: 'lg:col-span-8',
  },
  {
    id: 'adelaide-hills-estate',
    title: 'Adelaide Hills Modern Estate',
    slug: 'adelaide-hills-coastal-estate',
    category: 'Regional Architecture',
    location: 'Crafers, Adelaide Hills SA',
    specification: 'Elastomeric Masonry Barrier & Timber Satin',
    description:
      'Weather-resilient exterior coatings engineered for Adelaide Hills temperature shifts, paired with fine woodwork satin lacquering and formal daylight sign-off.',
    image:
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1400&q=85',
    year: '2026',
    span: 'lg:col-span-4',
  },
  {
    id: 'unley-park-residence',
    title: 'Unley Park Bespoke Residence',
    slug: 'unley-park-bespoke-residence',
    category: 'Bespoke Residential',
    location: 'Unley Park, Adelaide SA',
    specification: 'Italian Marmorino Plaster & 2K Joinery',
    description:
      'Curved corridor transitions enveloped in hand-burnished Italian marmorino plaster, paired with spray conversion finishes across custom kitchen cabinetry.',
    image:
      'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=85',
    year: '2026',
    span: 'lg:col-span-5',
  },
  {
    id: 'norwood-heritage-villa',
    title: 'Norwood Victorian Villa Restoration',
    slug: 'norwood-heritage-villa',
    category: 'Heritage Restoration',
    location: 'Norwood, Adelaide SA',
    specification: 'Breathable Mineral Distemper & Archival Woodwork',
    description:
      'Conservation of Victorian ceilings, period-accurate woodwork restoration, and breathable coatings formulated for traditional South Australian bluestone masonry.',
    image:
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1400&q=85',
    year: '2025',
    span: 'lg:col-span-7',
  },
];

export interface FeaturedProjectsProps {
  className?: string;
}

export const FeaturedProjects: React.FC<FeaturedProjectsProps> = ({ className = '' }) => {
  return (
    <section
      id="projects"
      aria-label="Featured Architectural Projects"
      className={`relative w-full bg-ivory text-charcoal py-24 md:py-36 border-b border-warm-grey/30 overflow-hidden ${className}`}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col md:flex-row md:items-end justify-between border-b border-warm-grey/30 pb-6 mb-16 gap-6"
        >
          <div>
            <span className="font-sans text-xs sm:text-sm uppercase tracking-[0.2em] text-bronze font-medium block mb-3">
              [ 03 / PORTFOLIO &amp; COMMISSIONS ]
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl md:text-6xl text-charcoal tracking-tight max-w-2xl">
              Featured Architectural Commissions.
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-warm-grey-dark uppercase tracking-widest hidden sm:inline-block">
              [COMMISSION ARCHIVE // ADELAIDE]
            </span>
            <Button
              variant="outline"
              size="md"
              href="/projects"
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
              View All Projects
            </Button>
          </div>
        </motion.div>

        {/* Editorial Notice on Illustrative Demonstrations */}
        <div className="mb-10 p-3 bg-white/70 border border-warm-grey/30 text-xs font-mono text-warm-grey-dark flex items-center justify-between">
          <span>SPECIFICATION MONOGRAPH // RESIDENTIAL &amp; HERITAGE CASE STUDIES</span>
          <span className="text-bronze font-semibold uppercase">ILLUSTRATIVE ARCHITECTURAL SPEC</span>
        </div>

        {/* Haven-Inspired Asymmetrical Editorial Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {showcaseProjects.map((project, idx) => (
            <motion.article
              key={project.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{
                duration: 0.8,
                ease: [0.16, 1, 0.3, 1],
                delay: idx * 0.1,
              }}
              className={`${project.span} group border border-warm-grey/40 bg-white flex flex-col justify-between overflow-hidden hover:border-charcoal/70 transition-all duration-300 shadow-md`}
            >
              {/* Image with Controlled Hover Zoom & Mask */}
              <Link
                href={`/projects/${project.slug}`}
                className="relative aspect-[16/10] sm:aspect-[16/9] w-full overflow-hidden bg-charcoal block cursor-pointer"
              >
                <Image
                  src={project.image}
                  alt={`${project.title} by Strovyn Painting Co.`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover object-center filter contrast-[1.04] transition-transform duration-1000 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/15 group-hover:bg-transparent transition-colors duration-300" />
                
                {/* Year & Location Badges */}
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                  <span className="font-mono text-[10px] bg-charcoal text-white px-2.5 py-1 tracking-widest uppercase">
                    {project.category}
                  </span>
                  <span className="font-mono text-[10px] bg-white text-charcoal border border-warm-grey/40 px-2 py-1 tracking-widest font-semibold">
                    {project.year}
                  </span>
                </div>
              </Link>

              {/* Project Metadata Details */}
              <div className="p-6 sm:p-8 flex flex-col justify-between flex-1">
                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-warm-grey-dark uppercase tracking-wider mb-2">
                    <span>{project.location}</span>
                    <span className="text-bronze font-medium">CASE STUDY</span>
                  </div>

                  <h3 className="font-serif text-2xl sm:text-3xl text-charcoal group-hover:text-bronze transition-colors mb-3">
                    <Link href={`/projects/${project.slug}`}>
                      {project.title}
                    </Link>
                  </h3>

                  <p className="font-sans text-xs sm:text-sm text-charcoal-muted leading-relaxed font-light mb-6">
                    {project.description}
                  </p>
                </div>

                <div className="border-t border-warm-grey/25 pt-4 flex items-center justify-between">
                  <div className="font-mono text-xs">
                    <span className="text-warm-grey-dark uppercase tracking-widest text-[10px] block">
                      Specification
                    </span>
                    <span className="text-charcoal font-medium">
                      {project.specification}
                    </span>
                  </div>

                  <Link
                    href={`/projects/${project.slug}`}
                    className="font-mono text-xs uppercase tracking-[0.16em] text-charcoal group-hover:text-brand-red font-medium transition-colors inline-flex items-center gap-2 shrink-0 ml-4"
                  >
                    <span>View Project</span>
                    <span className="transition-transform group-hover:translate-x-1">&rarr;</span>
                  </Link>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedProjects;
