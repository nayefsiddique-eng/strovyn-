'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Badge from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

export interface TestimonialItem {
  id: string;
  quote: string;
  author: string;
  role?: string | null;
  project?: string | null;
  location?: string | null;
  specification?: string | null;
  rating?: number | null;
  isFeatured?: boolean;
}

export interface TestimonialCarouselProps {
  testimonials?: TestimonialItem[];
  isLoading?: boolean;
  className?: string;
  autoPlay?: boolean;
  autoPlayInterval?: number;
}

export const TestimonialCarousel: React.FC<TestimonialCarouselProps> = ({
  testimonials = [],
  isLoading = false,
  className,
  autoPlay = false,
  autoPlayInterval = 8000,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [direction, setDirection] = useState<number>(1);

  const total = testimonials.length;
  const safeIndex = total > 0 ? currentIndex % total : 0;
  const current = total > 0 ? testimonials[safeIndex] : null;

  const handleNext = useCallback(() => {
    if (total <= 1) return;
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const handlePrev = useCallback(() => {
    if (total <= 1) return;
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    if (!autoPlay || total <= 1) return;
    const timer = setInterval(() => {
      handleNext();
    }, autoPlayInterval);
    return () => clearInterval(timer);
  }, [autoPlay, autoPlayInterval, handleNext, total]);

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 40 : -40,
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
    exit: (dir: number) => ({
      x: dir > 0 ? -40 : 40,
      opacity: 0,
      transition: {
        duration: 0.35,
        ease: [0.25, 1, 0.5, 1] as [number, number, number, number],
      },
    }),
  };

  const attributionMeta = current
    ? [current.role, current.location].filter((part): part is string => Boolean(part && part.trim()))
    : [];

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
            <h2 className="type-section-title text-3xl sm:text-4xl md:text-5xl text-charcoal max-w-2xl">
              Endorsements from architects, builders, and estate owners.
            </h2>
          </div>

          {current && (
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] text-warm-grey-dark uppercase tracking-widest border border-warm-grey/40 bg-white px-2.5 py-1">
                {current.isFeatured ? 'Featured Client Endorsement' : 'Verified Client Endorsement'}
              </span>
            </div>
          )}
        </motion.div>

        {isLoading ? (
          <div className="border border-warm-grey/40 bg-white p-8 sm:p-12 lg:p-16">
            <p className="font-mono text-xs uppercase tracking-widest text-warm-grey-dark">
              Loading verified client endorsements...
            </p>
          </div>
        ) : !current ? (
          <div
            data-testid="testimonials-empty-state"
            className="border border-warm-grey/40 bg-white p-8 sm:p-12 lg:p-16 flex flex-col md:flex-row md:items-center justify-between gap-6"
          >
            <div className="space-y-3 max-w-2xl">
              <p className="font-mono text-[11px] uppercase tracking-widest text-bronze">
                Verified Perspectives Pending Publication
              </p>
              <p className="font-sans text-base sm:text-lg text-charcoal/85 leading-relaxed">
                Strovyn publishes only genuine, written client endorsements after project
                completion and explicit publication consent verification.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                href="/feedback"
                className="px-5 py-3 bg-charcoal text-ivory font-mono text-[11px] uppercase tracking-widest hover:bg-bronze transition-colors"
              >
                Share Client Feedback
              </Link>
              <Link
                href="/projects"
                className="px-5 py-3 border border-warm-grey/60 bg-ivory text-charcoal font-mono text-[11px] uppercase tracking-widest hover:border-charcoal transition-colors"
              >
                View Portfolio
              </Link>
            </div>
          </div>
        ) : (
          <div className="border border-warm-grey/40 bg-white p-8 sm:p-12 lg:p-16 relative">
            {/* Top Status & Controls Bar */}
            <div className="flex items-center justify-between border-b border-warm-grey/30 pb-6 mb-8 sm:mb-12 gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-sm text-bronze font-semibold">
                  {String(safeIndex + 1).padStart(2, '0')}
                </span>
                <span className="font-mono text-xs text-warm-grey-dark">/</span>
                <span className="font-mono text-xs text-warm-grey-dark">
                  {String(total).padStart(2, '0')}
                </span>
                {current.project && (
                  <span className="ml-4 font-mono text-[11px] text-charcoal uppercase tracking-wider hidden sm:inline-block truncate">
                    {current.project}
                  </span>
                )}
              </div>

              {total > 1 && (
                <div className="flex items-center gap-2 shrink-0">
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
              )}
            </div>

            {/* Animated Slide Viewport */}
            <div className="relative min-h-[200px] sm:min-h-[160px] overflow-hidden">
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
                  <blockquote className="type-quote text-xl sm:text-2xl md:text-[1.65rem] text-charcoal mb-8 max-w-4xl">
                    &ldquo;{current.quote}&rdquo;
                  </blockquote>

                  <div className="border-t border-warm-grey/30 pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-ivory border border-bronze/40 flex items-center justify-center font-mono text-xs font-semibold text-bronze uppercase shrink-0">
                        {current.author.substring(0, 2)}
                      </div>
                      <div>
                        <span className="font-sans text-sm font-semibold text-charcoal block">
                          {current.author}
                        </span>
                        {attributionMeta.length > 0 && (
                          <span className="font-sans text-xs text-warm-grey-dark block">
                            {attributionMeta.join(' — ')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {typeof current.rating === 'number' && (
                        <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-1 border border-bronze/40 bg-ivory text-bronze">
                          {current.rating}/5 Rating
                        </span>
                      )}
                      {current.specification && (
                        <Badge variant="bronze" size="sm">
                          {current.specification}
                        </Badge>
                      )}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Bottom Pagination Dots / Bars */}
            {total > 1 && (
              <div className="flex items-center gap-2 mt-8 sm:mt-12 pt-6 border-t border-warm-grey/20">
                {testimonials.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setDirection(idx > safeIndex ? 1 : -1);
                      setCurrentIndex(idx);
                    }}
                    aria-label={`Go to endorsement ${idx + 1}`}
                    className={cn(
                      'h-1 transition-all duration-300 cursor-pointer',
                      idx === safeIndex
                        ? 'w-12 bg-bronze'
                        : 'w-4 bg-warm-grey/40 hover:bg-warm-grey'
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default TestimonialCarousel;
