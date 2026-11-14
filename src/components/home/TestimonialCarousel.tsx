'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Badge from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

export interface TestimonialItem {
  id: string;
  quote: string;
  author: string;
  role: string;
  project: string;
  location: string;
  specification: string;
  rating: number;
}

export const sampleTestimonials: TestimonialItem[] = [
  {
    id: 'henderson-north-adelaide',
    quote:
      'Strovyn’s craftsmen approached our heritage residence with the exactitude of museum conservators. The Level 5 ceiling finishes under harsh afternoon raking sunlight show zero defects, and their care around delicate 140-year-old plaster cornices was remarkable.',
    author: 'P. Henderson',
    role: 'Private Client & Estate Owner',
    project: 'The North Adelaide Villa',
    location: 'North Adelaide, SA',
    specification: 'Level 5 Drywall & Heritage Cornices',
    rating: 5,
  },
  {
    id: 'lin-studio',
    quote:
      'In high-end architectural builds, surface transitions make or break the integrity of the design. Strovyn’s millwork lacquering and lime wash applications were executed with absolute precision, meeting our studio’s most demanding tolerances.',
    author: 'M. Lin',
    role: 'Principal Architect, Studio Lin Architecture',
    project: 'Unley Park Residence',
    location: 'Unley Park, Adelaide SA',
    specification: 'Italian Marmorino Plaster & 2K Millwork',
    rating: 5,
  },
  {
    id: 'rossi-apex',
    quote:
      'The professionalism on site was exemplary. Seamless dust containment, schedule reliability under tight milestones, and a finish quality that surpassed our client’s highest standards. They are our definitive architectural coatings partner.',
    author: 'D. Rossi',
    role: 'Project Director, Apex Luxury Construct',
    project: 'Adelaide Hills Modern Estate',
    location: 'Crafers, Adelaide Hills SA',
    specification: 'Mineral Silicate Envelope & Fine Joinery',
    rating: 5,
  },
  {
    id: 'campbell-interior',
    quote:
      'From their initial diagnostic moisture analysis to final raking light inspection, Strovyn operates with a scientific discipline that is exceptionally rare in the coatings trade. Flawless execution across our heritage restoration.',
    author: 'E. Campbell',
    role: 'Interior Architect, Campbell & Co.',
    project: 'Medindie Heritage Restoration',
    location: 'Medindie, Adelaide SA',
    specification: 'Archival Distemper & Timber Restoration',
    rating: 5,
  },
];

export interface TestimonialCarouselProps {
  className?: string;
  autoPlay?: boolean;
  autoPlayInterval?: number;
}

export const TestimonialCarousel: React.FC<TestimonialCarouselProps> = ({
  className,
  autoPlay = false,
  autoPlayInterval = 8000,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [direction, setDirection] = useState<number>(1);

  const total = sampleTestimonials.length;
  const current = sampleTestimonials[currentIndex];

  const handleNext = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % total);
  };

  const handlePrev = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  };

  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(() => {
      handleNext();
    }, autoPlayInterval);
    return () => clearInterval(timer);
  }, [autoPlay, autoPlayInterval, currentIndex]);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 40 : -40,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
        ease: [0.25, 1, 0.5, 1] as [number, number, number, number],
      },
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -40 : 40,
      opacity: 0,
      transition: {
        duration: 0.35,
        ease: [0.25, 1, 0.5, 1] as [number, number, number, number],
      },
    }),
  };

  return (
    <section
      id="endorsements"
      aria-label="Client Perspectives & Endorsements"
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
              [ 06 / CLIENT PERSPECTIVES ]
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-charcoal tracking-tight max-w-2xl">
              Endorsements from architects, builders, and estate owners.
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] text-warm-grey-dark uppercase tracking-widest border border-warm-grey/40 bg-white px-2.5 py-1">
              [Sample Client Endorsement]
            </span>
          </div>
        </motion.div>

        {/* Carousel Framing Box */}
        <div className="border border-warm-grey/40 bg-white p-8 sm:p-12 lg:p-16 relative">
          {/* Top Status & Controls Bar */}
          <div className="flex items-center justify-between border-b border-warm-grey/30 pb-6 mb-8 sm:mb-12">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-bronze font-semibold">
                0{currentIndex + 1}
              </span>
              <span className="font-mono text-xs text-warm-grey-dark">/</span>
              <span className="font-mono text-xs text-warm-grey-dark">
                0{total}
              </span>
              <span className="ml-4 font-mono text-[11px] text-charcoal uppercase tracking-wider hidden sm:inline-block">
                {current.project}
              </span>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous endorsement"
                className="w-10 h-10 border border-warm-grey/40 bg-ivory text-charcoal flex items-center justify-center hover:bg-charcoal hover:text-white hover:border-charcoal transition-colors cursor-pointer"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M10 13L5 8L10 3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="square"
                  />
                </svg>
              </button>

              <button
                type="button"
                onClick={handleNext}
                aria-label="Next endorsement"
                className="w-10 h-10 border border-warm-grey/40 bg-ivory text-charcoal flex items-center justify-center hover:bg-charcoal hover:text-white hover:border-charcoal transition-colors cursor-pointer"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M6 3L11 8L6 13"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="square"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Animated Slide Viewport */}
          <div className="relative min-h-[220px] sm:min-h-[180px] overflow-hidden">
            <AnimatePresence custom={direction} mode="wait">
              <motion.div
                key={current.id}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="flex flex-col justify-between"
              >
                <blockquote className="font-serif text-xl sm:text-2xl md:text-3xl text-charcoal leading-snug sm:leading-relaxed mb-8 max-w-4xl">
                  &ldquo;{current.quote}&rdquo;
                </blockquote>

                <div className="border-t border-warm-grey/30 pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-ivory border border-bronze/40 flex items-center justify-center font-mono text-xs font-semibold text-bronze uppercase">
                      {current.author.substring(0, 2)}
                    </div>
                    <div>
                      <span className="font-sans text-sm font-semibold text-charcoal block">
                        {current.author}
                      </span>
                      <span className="font-sans text-xs text-warm-grey-dark block">
                        {current.role} &mdash; {current.location}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant="bronze" size="sm">
                      {current.specification}
                    </Badge>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom Pagination Dots / Bars */}
          <div className="flex items-center gap-2 mt-8 sm:mt-12 pt-6 border-t border-warm-grey/20">
            {sampleTestimonials.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setDirection(idx > currentIndex ? 1 : -1);
                  setCurrentIndex(idx);
                }}
                aria-label={`Go to endorsement ${idx + 1}`}
                className={cn(
                  'h-1 transition-all duration-300 cursor-pointer',
                  idx === currentIndex
                    ? 'w-12 bg-bronze'
                    : 'w-4 bg-warm-grey/40 hover:bg-warm-grey'
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialCarousel;
