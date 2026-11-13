'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import Button from '@/components/ui/Button';

export interface EditorialArticle {
  slug: string;
  category: string;
  title: string;
  introduction: string;
  readingTime: string;
  image: string;
}

export const editorialArticles: EditorialArticle[] = [
  {
    slug: 'achieving-as-nzs-2311-level-5-surface-standards',
    category: 'SURFACE SCIENCE',
    title: 'Why Surface Preparation Determines the Final Paint Finish.',
    introduction:
      'Over 70% of finish quality is decided before topcoat mobilization. Discover how substrate moisture diagnostics, planar tolerance checks, and dual-axis dustless sanding prevent raking light imperfections.',
    readingTime: '5 min read',
    image:
      'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=1200&q=80',
  },
  {
    slug: 'chemistry-of-potassium-silicate-mineral-coatings',
    category: 'MATERIAL CHEMISTRY',
    title: 'Choosing the Right Paint Finish for Different Interior Spaces.',
    introduction:
      'From dead-flat mineral silicates that diffuse northern raking light to durable catalyzed 2K polyurethanes for bespoke joinery, understand the aesthetic and tactile behavior of modern architectural finishes.',
    readingTime: '6 min read',
    image:
      'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=1200&q=80',
  },
  {
    slug: 'heritage-restoration-bluestone-lime-wash-adelaide',
    category: 'PROJECT GUIDANCE',
    title: 'What to Consider Before Starting a Painting Project.',
    introduction:
      'Substrate moisture equilibrium, architectural daylight audits, dust containment strategies, and contractor scheduling milestones essential for seamless residential and commercial execution.',
    readingTime: '4 min read',
    image:
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
  },
];

const tickerWords = [
  'PREPARATION',
  'PRECISION',
  'CRAFTSMANSHIP',
  'DETAIL',
  'FINISH',
  'QUALITY',
  'PREPARATION',
  'PRECISION',
  'CRAFTSMANSHIP',
  'DETAIL',
  'FINISH',
  'QUALITY',
];

export interface InsightsArticlesProps {
  className?: string;
}

export const InsightsArticles: React.FC<InsightsArticlesProps> = ({ className = '' }) => {
  const shouldReduce = useReducedMotion();

  return (
    <section
      id="insights"
      aria-label="Insights & Editorial Perspectives"
      className={`relative w-full bg-ivory text-charcoal py-20 md:py-32 border-b border-warm-grey/30 overflow-hidden ${className}`}
    >
      {/* =========================================================================
          CONTINUOUS MOVING EDITORIAL TICKER
          PREPARATION / PRECISION / CRAFTSMANSHIP / DETAIL / FINISH / QUALITY
          ========================================================================= */}
      <div className="w-full border-y border-warm-grey/30 bg-white/70 py-4 mb-16 md:mb-24 overflow-hidden select-none">
        <motion.div
          animate={shouldReduce ? {} : { x: ['0%', '-50%'] }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="flex whitespace-nowrap gap-12 font-mono text-xs sm:text-sm tracking-[0.3em] uppercase text-charcoal/80 font-medium"
        >
          {tickerWords.map((word, i) => (
            <span key={i} className="inline-flex items-center gap-12">
              <span>{word}</span>
              <span className="text-brand-red font-semibold">/</span>
            </span>
          ))}
        </motion.div>
      </div>

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
              [ 05 / EDITORIAL &amp; INSIGHTS ]
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl md:text-6xl text-charcoal tracking-tight max-w-2xl">
              Perspectives on Paint, Space &amp; Craft.
            </h2>
          </div>

          <div className="shrink-0">
            <Button
              variant="outline"
              size="md"
              href="/insights"
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
              View All Articles
            </Button>
          </div>
        </motion.div>

        {/* 3 Editorial Article Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
          {editorialArticles.map((article, idx) => (
            <motion.article
              key={article.slug}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{
                duration: 0.7,
                ease: [0.16, 1, 0.3, 1],
                delay: idx * 0.12,
              }}
              className="group border border-warm-grey/40 bg-white flex flex-col justify-between hover:border-charcoal/70 transition-all duration-300 shadow-md"
            >
              <div>
                {/* Article Photograph */}
                <Link
                  href={`/insights/${article.slug}`}
                  className="relative aspect-[16/10] w-full overflow-hidden bg-charcoal block cursor-pointer"
                >
                  <Image
                    src={article.image}
                    alt={article.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/15 group-hover:bg-transparent transition-colors duration-300" />
                  
                  <span className="absolute top-4 left-4 z-10 font-mono text-[10px] bg-charcoal text-white px-2.5 py-1 tracking-widest uppercase">
                    {article.category}
                  </span>
                </Link>

                {/* Article Typography Details */}
                <div className="p-6 sm:p-8 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs font-mono text-warm-grey-dark">
                    <span>{article.category}</span>
                    <span>{article.readingTime}</span>
                  </div>

                  <h3 className="font-serif text-2xl text-charcoal group-hover:text-bronze transition-colors">
                    <Link href={`/insights/${article.slug}`}>
                      {article.title}
                    </Link>
                  </h3>

                  <p className="font-sans text-xs sm:text-sm text-charcoal-muted leading-relaxed font-light">
                    {article.introduction}
                  </p>
                </div>
              </div>

              {/* Read Article Action */}
              <div className="p-6 sm:p-8 pt-0 border-t border-warm-grey/20 mt-4 flex items-center justify-between">
                <Link
                  href={`/insights/${article.slug}`}
                  className="font-mono text-xs uppercase tracking-[0.16em] text-charcoal group-hover:text-brand-red font-medium transition-colors inline-flex items-center gap-2"
                >
                  <span>Read Article</span>
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

export default InsightsArticles;
