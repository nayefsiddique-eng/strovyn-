'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ensureGsapRegistered,
  gsap,
  prefersReducedMotion,
} from '@/lib/motion/gsapConfig';
import { cn } from '@/lib/utils';
import type { PublicTestimonialItem } from '@/lib/cms/publicTestimonials';

export interface ClientExperiencesCarouselProps {
  testimonials?: PublicTestimonialItem[];
  isLoading?: boolean;
  className?: string;
}

export const ClientExperiencesCarousel: React.FC<ClientExperiencesCarouselProps> = ({
  testimonials = [],
  isLoading = false,
  className,
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  const sectionRef = useRef<HTMLElement | null>(null);
  const activeCardRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const total = testimonials.length;
  const safeIndex = total > 0 ? ((activeIndex % total) + total) % total : 0;
  const current = total > 0 ? testimonials[safeIndex] : null;
  const prevItem = total >= 2 ? testimonials[(safeIndex - 1 + total) % total] : null;
  const nextItem = total >= 3 ? testimonials[(safeIndex + 1) % total] : null;
  const canNavigate = total > 1;

  useEffect(() => {
    setReducedMotion(prefersReducedMotion());
  }, []);

  // Subtle horizontal slide + scale transition on active card change
  useEffect(() => {
    if (!activeCardRef.current || reducedMotion || total === 0) return;
    ensureGsapRegistered();
    const el = activeCardRef.current;
    gsap.fromTo(
      el,
      {
        x: direction * 28,
        opacity: 0.72,
        scale: 0.985,
      },
      {
        x: 0,
        opacity: 1,
        scale: 1,
        duration: 0.45,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      }
    );
  }, [safeIndex, direction, reducedMotion, total]);

  const goNext = useCallback(() => {
    if (!canNavigate) return;
    setDirection(1);
    setActiveIndex((prev) => (prev + 1) % total);
  }, [canNavigate, total]);

  const goPrev = useCallback(() => {
    if (!canNavigate) return;
    setDirection(-1);
    setActiveIndex((prev) => (prev - 1 + total) % total);
  }, [canNavigate, total]);

  const goTo = useCallback(
    (idx: number) => {
      if (!canNavigate || idx === safeIndex) return;
      setDirection(idx > safeIndex ? 1 : -1);
      setActiveIndex(idx);
    },
    [canNavigate, safeIndex]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!canNavigate) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      goNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goPrev();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!canNavigate || e.touches.length !== 1) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!canNavigate || touchStartX.current === null || touchStartY.current === null) {
      return;
    }
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    // Only trigger swipe when horizontal gesture clearly dominates vertical scroll
    if (Math.abs(dx) >= 42 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx < 0) goNext();
      else goPrev();
    }
  };

  const renderAttributionMeta = (item: PublicTestimonialItem) => {
    const parts = [item.role, item.location].filter(
      (p): p is string => Boolean(p && p.trim())
    );
    return parts.join(' · ');
  };

  return (
    <section
      ref={sectionRef}
      id="client-experiences"
      aria-roledescription="carousel"
      aria-label="Client Experiences and Verified Testimonials"
      className={cn(
        'relative w-full bg-ivory text-charcoal border-b border-warm-grey/30 py-20 md:py-28 lg:py-36 overflow-hidden',
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-warm-grey/30 pb-6 mb-12 md:mb-16 gap-6">
          <div>
            <span className="font-sans text-xs sm:text-sm uppercase tracking-[0.2em] text-bronze font-medium block mb-3">
              [ 04 / CLIENT EXPERIENCES ]
            </span>
            <h2 className="type-section-title text-3xl sm:text-4xl md:text-5xl text-charcoal max-w-2xl">
              The Finish Speaks. So Do Our Clients.
            </h2>
          </div>

          <div className="max-w-md flex flex-col items-start md:items-end gap-2">
            <p className="font-sans text-xs sm:text-sm text-charcoal-muted leading-relaxed font-light md:text-right">
              Published directly from verified client feedback with explicit homeowner and
              architectural partner consent.
            </p>
            {total > 0 && (
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-bronze border border-warm-grey/40 bg-white dark:bg-[#20211F] px-2.5 py-1">
                {String(safeIndex + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
              </span>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="border border-warm-grey/40 bg-white dark:bg-[#20211F] p-8 sm:p-12 lg:p-16">
            <p className="font-mono text-xs uppercase tracking-widest text-warm-grey-dark">
              Loading verified client experiences...
            </p>
          </div>
        ) : !current ? (
          /* Branded Empty State (when 0 published & consented testimonials exist) */
          <div
            data-testid="client-experiences-empty-state"
            className="border border-warm-grey/40 bg-white dark:bg-[#20211F] grid grid-cols-1 lg:grid-cols-12 overflow-hidden shadow-sm"
          >
            <div className="lg:col-span-5 relative min-h-[240px] sm:min-h-[300px] bg-charcoal overflow-hidden">
              <Image
                src="/images/projects/adelaide-luxury-residence/living-kitchen-1.jpg"
                alt="Completed Adelaide Residence interior displaying level 5 architectural paint finish"
                fill
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 z-10">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/90 bg-black/65 px-2.5 py-1 border border-white/15 inline-block">
                  ADELAIDE RESIDENCE · COMPLETED FINISH
                </span>
              </div>
            </div>

            <div className="lg:col-span-7 p-8 sm:p-10 lg:p-14 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <span className="font-display text-5xl text-bronze/45 leading-none block select-none" aria-hidden="true">
                  &ldquo;
                </span>
                <h3 className="font-display font-normal text-2xl sm:text-3xl uppercase tracking-tight text-charcoal">
                  Verified Client Reviews Published Upon Consent
                </h3>
                <p className="font-sans text-sm sm:text-base text-charcoal-muted leading-relaxed max-w-xl">
                  Strovyn Painting Co. publishes only genuine client testimonials that have
                  passed editorial review and explicit publication consent. Explore our
                  completed Adelaide portfolio or share your project experience.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/projects"
                  className="inline-flex items-center justify-center gap-2 bg-charcoal hover:bg-black text-white px-5 py-3 font-mono text-xs uppercase tracking-[0.16em] transition-colors"
                >
                  <span>Explore Completed Projects</span>
                  <span aria-hidden="true">&rarr;</span>
                </Link>
                <Link
                  href="/feedback"
                  className="inline-flex items-center justify-center gap-2 border border-warm-grey/50 hover:border-bronze px-5 py-3 font-mono text-xs uppercase tracking-[0.16em] text-charcoal transition-colors"
                >
                  <span>Submit Client Feedback</span>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* Interactive Testimonial Carousel Stage */
          <div
            tabIndex={canNavigate ? 0 : undefined}
            onKeyDown={handleKeyDown}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            aria-label="Client testimonial slides. Use Left and Right arrow keys to navigate."
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
          >
            {/* Desktop & Mobile Horizontal Perspective Stage */}
            <div className="relative flex items-stretch justify-center gap-4 lg:gap-6">
              {/* Left Partial Preview Card (Desktop only, when >= 2 testimonials) */}
              {prevItem && (
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label={`View previous testimonial from ${prevItem.author}`}
                  className="hidden lg:flex lg:w-[22%] shrink-0 flex-col justify-between text-left border border-warm-grey/35 bg-white/75 dark:bg-[#20211F]/70 p-6 opacity-55 scale-[0.95] hover:opacity-80 hover:scale-[0.97] transition-all duration-300 motion-reduce:transition-none cursor-pointer overflow-hidden"
                >
                  <div>
                    <span className="font-display text-4xl text-bronze/40 leading-none block select-none" aria-hidden="true">
                      &ldquo;
                    </span>
                    <p className="mt-2 font-sans text-xs text-charcoal-muted leading-relaxed line-clamp-5">
                      {prevItem.quote}
                    </p>
                  </div>
                  <div className="pt-4 border-t border-warm-grey/25 mt-4">
                    <p className="font-sans text-xs font-semibold text-charcoal truncate">
                      {prevItem.author}
                    </p>
                    {(prevItem.project || prevItem.specification) && (
                      <p className="font-mono text-[10px] uppercase tracking-wider text-bronze truncate mt-0.5">
                        {prevItem.project || prevItem.specification}
                      </p>
                    )}
                  </div>
                </button>
              )}

              {/* Center Featured Active Testimonial Card */}
              <div
                ref={activeCardRef}
                role="group"
                aria-roledescription="slide"
                aria-label={`Testimonial ${safeIndex + 1} of ${total}`}
                className={cn(
                  'w-full border border-warm-grey/45 bg-white dark:bg-[#20211F] p-7 sm:p-10 lg:p-12 shadow-lg transition-shadow duration-300 motion-reduce:transition-none flex flex-col justify-between',
                  total >= 3
                    ? 'lg:w-[56%]'
                    : total === 2
                    ? 'lg:w-[74%]'
                    : 'lg:max-w-4xl mx-auto'
                )}
              >
                <div>
                  {/* Top Meta Row: Decorative Quotation Mark + Rating / Featured Tag */}
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <span
                      className="font-display text-6xl sm:text-7xl text-bronze/45 leading-[0.75] select-none"
                      aria-hidden="true"
                    >
                      &ldquo;
                    </span>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {current.isFeatured && (
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1 bg-ivory dark:bg-[#181917] border border-warm-grey/35 text-bronze">
                          Featured Client
                        </span>
                      )}
                      {typeof current.rating === 'number' && (
                        <span
                          aria-label={`Rated ${current.rating} out of 5`}
                          className="font-mono text-xs tracking-[0.12em] px-2.5 py-1 bg-ivory dark:bg-[#181917] border border-warm-grey/35 text-charcoal"
                        >
                          {'★'.repeat(current.rating)}
                          {'☆'.repeat(Math.max(0, 5 - current.rating))}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quote Text */}
                  <blockquote className="font-sans text-base sm:text-lg lg:text-xl leading-relaxed text-charcoal font-normal">
                    &ldquo;{current.quote}&rdquo;
                  </blockquote>
                </div>

                {/* Attribution Footer */}
                <div className="mt-8 pt-6 border-t border-warm-grey/30 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <p className="font-display font-normal text-xl sm:text-2xl uppercase tracking-tight text-charcoal">
                      {current.author}
                    </p>
                    {renderAttributionMeta(current) && (
                      <p className="font-sans text-xs sm:text-sm text-charcoal-muted mt-0.5">
                        {renderAttributionMeta(current)}
                      </p>
                    )}
                  </div>

                  {(current.project || current.specification) && (
                    <div className="sm:text-right">
                      {current.project && (
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-bronze font-medium">
                          {current.project}
                        </p>
                      )}
                      {current.specification && (
                        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-warm-grey-dark mt-0.5">
                          {current.specification}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Partial Preview Card (Desktop only, when >= 3 testimonials) */}
              {nextItem && (
                <button
                  type="button"
                  onClick={goNext}
                  aria-label={`View next testimonial from ${nextItem.author}`}
                  className="hidden lg:flex lg:w-[22%] shrink-0 flex-col justify-between text-left border border-warm-grey/35 bg-white/75 dark:bg-[#20211F]/70 p-6 opacity-55 scale-[0.95] hover:opacity-80 hover:scale-[0.97] transition-all duration-300 motion-reduce:transition-none cursor-pointer overflow-hidden"
                >
                  <div>
                    <span className="font-display text-4xl text-bronze/40 leading-none block select-none" aria-hidden="true">
                      &ldquo;
                    </span>
                    <p className="mt-2 font-sans text-xs text-charcoal-muted leading-relaxed line-clamp-5">
                      {nextItem.quote}
                    </p>
                  </div>
                  <div className="pt-4 border-t border-warm-grey/25 mt-4">
                    <p className="font-sans text-xs font-semibold text-charcoal truncate">
                      {nextItem.author}
                    </p>
                    {(nextItem.project || nextItem.specification) && (
                      <p className="font-mono text-[10px] uppercase tracking-wider text-bronze truncate mt-0.5">
                        {nextItem.project || nextItem.specification}
                      </p>
                    )}
                  </div>
                </button>
              )}
            </div>

            {/* Carousel Controls & Progress Indicator */}
            <div className="mt-8 pb-4 sm:pb-0 flex flex-wrap items-center justify-between gap-4">
              {/* Progress Bar & Slide Dots */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className="flex items-center gap-1.5"
                  role="tablist"
                  aria-label="Select client testimonial slide"
                >
                  {testimonials.map((item, idx) => {
                    const isActive = idx === safeIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-label={`Show testimonial ${idx + 1} of ${total}: ${item.author}`}
                        disabled={!canNavigate}
                        onClick={() => goTo(idx)}
                        className={cn(
                          'h-2 transition-all duration-300 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze',
                          canNavigate ? 'cursor-pointer' : 'cursor-default',
                          isActive
                            ? 'w-8 bg-bronze'
                            : 'w-2.5 bg-warm-grey/45 hover:bg-bronze/60'
                        )}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Previous / Next Arrow Controls (disabled when <= 1 testimonial) */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={!canNavigate}
                  aria-label="Previous client testimonial"
                  className={cn(
                    'w-10 h-10 border flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze',
                    canNavigate
                      ? 'border-warm-grey/50 bg-white dark:bg-[#20211F] text-charcoal hover:border-bronze hover:text-bronze cursor-pointer'
                      : 'border-warm-grey/25 bg-transparent text-warm-grey/50 cursor-not-allowed opacity-50'
                  )}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canNavigate}
                  aria-label="Next client testimonial"
                  className={cn(
                    'w-10 h-10 border flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze',
                    canNavigate
                      ? 'border-warm-grey/50 bg-white dark:bg-[#20211F] text-charcoal hover:border-bronze hover:text-bronze cursor-pointer'
                      : 'border-warm-grey/25 bg-transparent text-warm-grey/50 cursor-not-allowed opacity-50'
                  )}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
