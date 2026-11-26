'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Search } from 'lucide-react';
import type { PublicArticleSummary } from '@/lib/cms/publicArticles';
import { PublicArticleMedia } from '@/components/insights/PublicArticleMedia';

const ARTICLES_PER_PAGE = 6;

export const V3InsightsJournal: React.FC<{ articles: PublicArticleSummary[] }> = ({
  articles,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState<number>(ARTICLES_PER_PAGE);

  const categories = useMemo(() => {
    const seen = new Set(articles.map((a) => a.category.trim()).filter(Boolean));
    return ['All', ...Array.from(seen)];
  }, [articles]);

  const featuredArticle = useMemo(() => {
    if (articles.length === 0) return null;
    return articles.find((a) => a.isFeatured) ?? articles[0];
  }, [articles]);

  const isUnfiltered = selectedCategory === 'All' && !searchQuery.trim();

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const matchesCat = selectedCategory === 'All' || article.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        article.title.toLowerCase().includes(q) ||
        (article.subtitle && article.subtitle.toLowerCase().includes(q)) ||
        article.excerpt.toLowerCase().includes(q) ||
        article.category.toLowerCase().includes(q);
      if (!matchesCat || !matchesSearch) return false;
      if (isUnfiltered && featuredArticle && article.slug === featuredArticle.slug) {
        return false;
      }
      return true;
    });
  }, [articles, selectedCategory, searchQuery, isUnfiltered, featuredArticle]);

  const visibleArticles = filteredArticles.slice(0, visibleCount);
  const hasMore = visibleCount < filteredArticles.length;

  return (
    <div
      role="main"
      className="w-full bg-[#F4F1EA] dark:bg-[#181917] text-[#20211F] dark:text-[#F4F1EA]"
    >
      {/* Broadsheet Masthead & Search Bar */}
      <section className="px-5 sm:px-10 lg:px-16 pt-8 sm:pt-12 pb-12 sm:pb-16 border-b border-[#B8B5AE]/70 dark:border-white/15">
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[#20211F]/25 dark:border-white/20 py-2.5 mb-10 font-mono text-[10px] uppercase tracking-[0.22em] text-[#5C5A55] dark:text-[#B8B5AE]">
          <span>TECHNICAL BROADSHEET &mdash; COATINGS SCIENCE &amp; SUBSTRATE NOTES</span>
          <span>AS/NZS 2311 FIELD RESEARCH</span>
        </div>

        <div className="max-w-3xl space-y-5 mb-12">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F] block">
            § V &middot; FIELD JOURNAL
          </span>
          <h1 className="font-display uppercase text-[clamp(2.8rem,5.8vw,5.6rem)] leading-[0.92]">
            Architectural Insights &amp; Coatings Science.
          </h1>
          <p className="font-sans text-base sm:text-lg text-[#42413D] dark:text-[#D5D2CA] font-light leading-[1.75]">
            Practitioner papers on substrate moisture equilibration, grazing daylight sheen
            selection, and mineral coating systems.
          </p>
        </div>

        <div className="pt-6 border-t border-[#B8B5AE]/60 dark:border-white/15 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat);
                    setVisibleCount(ARTICLES_PER_PAGE);
                  }}
                  className={`px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.18em] border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#20211F] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#181917] border-[#20211F] dark:border-[#F4F1EA] font-semibold'
                      : 'bg-[#FAF8F4] dark:bg-[#1C1D1A] text-[#4A4945] dark:text-[#C8C5BE] border-[#B8B5AE]/80 dark:border-white/20 hover:border-[#7E6340]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="h-3.5 w-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7E6340]" />
            <input
              type="text"
              aria-label="Search technical insights"
              placeholder="Search specifications..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(ARTICLES_PER_PAGE);
              }}
              className="w-full bg-[#FAF8F4] dark:bg-[#1C1D1A] border border-[#B8B5AE] dark:border-white/20 pl-9 pr-4 py-2.5 font-sans text-xs focus:outline-none focus:border-[#C41E1E]"
            />
          </div>
        </div>
      </section>

      {/* Featured Lead Monograph */}
      {isUnfiltered && featuredArticle && (
        <section className="px-5 sm:px-10 lg:px-16 py-16 sm:py-20 border-b border-[#B8B5AE]/70 dark:border-white/15 bg-[#EFECE4]/65 dark:bg-[#151614]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {featuredArticle.coverImage && (
              <Link
                href={`/insights/${featuredArticle.slug}`}
                className="lg:col-span-6 relative aspect-[16/10] overflow-hidden bg-[#141513] border border-[#B8B5AE]/70 dark:border-white/15 block"
              >
                <PublicArticleMedia
                  src={featuredArticle.coverImage}
                  alt={featuredArticle.coverImageAlt}
                  priority
                  sizes="(max-width: 1024px) 100vw, 45vw"
                />
              </Link>
            )}
            <div className={`${featuredArticle.coverImage ? 'lg:col-span-6' : 'lg:col-span-10'} space-y-4`}>
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#C41E1E] dark:text-[#C9B28F] font-semibold block">
                FEATURED MONOGRAPH &middot; {featuredArticle.category} &middot; {featuredArticle.readTimeLabel}
              </span>
              <h2 className="font-display uppercase text-3xl sm:text-5xl leading-[0.94]">
                <Link
                  href={`/insights/${featuredArticle.slug}`}
                  className="hover:text-[#C41E1E] dark:hover:text-[#C9B28F] transition-colors"
                >
                  {featuredArticle.title}
                </Link>
              </h2>
              <p className="font-sans text-sm sm:text-base text-[#3A3936] dark:text-[#D5D2CA] font-light leading-relaxed">
                {featuredArticle.excerpt}
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-[#B8B5AE]/60 dark:border-white/15">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5C5A55] dark:text-[#B8B5AE]">
                  {featuredArticle.authorName} &middot; {featuredArticle.publishedDateLabel}
                </span>
                <Link
                  href={`/insights/${featuredArticle.slug}`}
                  className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] font-semibold text-[#20211F] dark:text-[#F4F1EA] hover:text-[#C41E1E]"
                >
                  <span>Read Full Paper</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Print Broadsheet Column Archive */}
      <section className="px-5 sm:px-10 lg:px-16 py-16 sm:py-24">
        {articles.length === 0 ? (
          <div className="border border-[#B8B5AE] dark:border-white/20 bg-[#FAF8F4] dark:bg-[#1B1C19] p-10 space-y-2 max-w-2xl">
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#7E6340] dark:text-[#C9B28F] block">
              EDITORIAL QUEUE
            </span>
            <p className="font-sans text-sm text-[#4A4945] dark:text-[#B8B5AE]">
              Technical field papers are currently undergoing practitioner review prior to
              publication.
            </p>
          </div>
        ) : visibleArticles.length === 0 && (!isUnfiltered || !featuredArticle) ? (
          <div className="border border-[#B8B5AE] dark:border-white/20 bg-[#FAF8F4] dark:bg-[#1B1C19] p-10 text-center space-y-4">
            <p className="font-sans text-sm text-[#4A4945] dark:text-[#C8C5BE]">
              No published papers match your current search or category filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('All');
                setSearchQuery('');
              }}
              className="px-5 py-2.5 bg-[#20211F] dark:bg-[#F4F1EA] text-[#F4F1EA] dark:text-[#181917] font-mono text-[10px] uppercase tracking-[0.2em] cursor-pointer"
            >
              Clear Search &amp; Filters
            </button>
          </div>
        ) : (
          <div className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-14">
              {visibleArticles.map((art) => (
                <article
                  key={art.id}
                  className="group border-t border-[#B8B5AE] dark:border-white/20 pt-6 flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-3">
                    {art.coverImage && (
                      <Link
                        href={`/insights/${art.slug}`}
                        className="block relative aspect-[16/9] overflow-hidden bg-[#141513] border border-[#B8B5AE]/60 dark:border-white/15 mb-4"
                      >
                        <PublicArticleMedia
                          src={art.coverImage}
                          alt={art.coverImageAlt}
                          sizes="(max-width: 768px) 100vw, 40vw"
                        />
                      </Link>
                    )}
                    <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-[#7E6340] dark:text-[#C9B28F]">
                      <span>{art.category}</span>
                      <span>{art.readTimeLabel}</span>
                    </div>
                    <h3 className="font-display uppercase text-2xl sm:text-3xl leading-[0.96]">
                      <Link
                        href={`/insights/${art.slug}`}
                        className="hover:text-[#C41E1E] dark:hover:text-[#C9B28F] transition-colors"
                      >
                        {art.title}
                      </Link>
                    </h3>
                    <p className="font-sans text-sm text-[#4A4945] dark:text-[#B8B5AE] font-light leading-relaxed line-clamp-3">
                      {art.excerpt}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#B8B5AE]/40 dark:border-white/10 font-mono text-[10px] uppercase tracking-[0.18em] text-[#5C5A55] dark:text-[#B8B5AE]">
                    <span>{art.publishedDateLabel}</span>
                    <Link
                      href={`/insights/${art.slug}`}
                      className="inline-flex items-center gap-1.5 text-[#20211F] dark:text-[#F4F1EA] group-hover:text-[#C41E1E]"
                    >
                      <span>Read Paper</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>

            {hasMore && (
              <div className="pt-6 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + ARTICLES_PER_PAGE)}
                  className="px-7 py-3.5 border border-[#20211F] dark:border-white/30 font-mono text-[10px] uppercase tracking-[0.22em] hover:bg-[#20211F] hover:text-[#F4F1EA] transition-colors cursor-pointer"
                >
                  Load Earlier Papers
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
