'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ARTICLES_DATA, getFeaturedArticle, getCategories } from '@/data/articlesData';

const ARTICLES_PER_PAGE = 6;

export default function InsightsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState<number>(ARTICLES_PER_PAGE);

  const categories = useMemo(() => getCategories(), []);
  const featuredArticle = useMemo(() => getFeaturedArticle(), []);

  const isUnfiltered = selectedCategory === 'All' && !searchQuery.trim();

  // Filter articles based on active category & search query
  const filteredArticles = useMemo(() => {
    return ARTICLES_DATA.filter((article) => {
      const matchesCat =
        selectedCategory === 'All' || article.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        article.title.toLowerCase().includes(q) ||
        article.excerpt.toLowerCase().includes(q) ||
        article.category.toLowerCase().includes(q);

      if (!matchesCat || !matchesSearch) return false;

      // When the Featured Monograph is visible, exclude its slug from the grid to prevent duplication
      if (isUnfiltered && featuredArticle && article.slug === featuredArticle.slug) {
        return false;
      }

      return true;
    });
  }, [selectedCategory, searchQuery, isUnfiltered, featuredArticle]);

  // When filters or search change, reset pagination view
  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setVisibleCount(ARTICLES_PER_PAGE);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setVisibleCount(ARTICLES_PER_PAGE);
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + ARTICLES_PER_PAGE);
  };

  // The slice of filtered articles currently visible in the grid
  const visibleArticles = filteredArticles.slice(0, visibleCount);
  const hasMore = visibleCount < filteredArticles.length;

  return (
    <main className="w-full min-h-screen bg-ivory text-charcoal">
      {/* Editorial Header */}
      <section className="relative pt-36 pb-16 md:pt-44 md:pb-24 border-b border-warm-grey/30 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-4">
          [ 01 / EDITORIAL &amp; MATERIAL KNOWLEDGE ]
        </span>
        <h1 className="type-page-title text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-charcoal max-w-4xl mb-8">
          Architectural Insights &amp; Coatings Science
        </h1>
        <p className="font-sans text-lg sm:text-xl text-charcoal/80 max-w-2xl leading-relaxed">
          Technical papers, substrate chemistry analyses, and field notes on fine finishing practices for architects, designers, and builders.
        </p>

        {/* Search & Category Filter */}
        <div className="mt-12 flex flex-col md:flex-row md:items-center justify-between gap-6 pt-8 border-t border-warm-grey/30">
          {/* Categories */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryChange(cat)}
                className={`font-sans text-xs uppercase tracking-widest px-4 py-2 border transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-charcoal text-white border-charcoal'
                    : 'bg-white text-charcoal/80 border-warm-grey/40 hover:border-charcoal'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="w-full md:w-72">
            <input
              type="text"
              placeholder="Search specifications..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full bg-white border border-warm-grey/40 px-4 py-2 text-xs font-sans text-charcoal focus:outline-none focus:border-bronze"
            />
          </div>
        </div>
      </section>

      {/* Featured Article Monograph (Displayed when unfiltered) */}
      {selectedCategory === 'All' && !searchQuery.trim() && featuredArticle && (
        <section className="py-16 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto border-b border-warm-grey/30">
          <span className="font-mono text-xs uppercase text-bronze tracking-widest block mb-4">
            FEATURED MONOGRAPH
          </span>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 bg-white border border-warm-grey/40 p-6 sm:p-10">
            <div className="lg:col-span-6 relative aspect-[16/10] bg-charcoal overflow-hidden">
              <Image
                src={featuredArticle.coverImage}
                alt={featuredArticle.title}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <div className="lg:col-span-6 flex flex-col justify-between">
              <div>
                <span className="font-sans text-xs uppercase tracking-widest text-bronze font-medium block mb-2">
                  {featuredArticle.category} &mdash; {featuredArticle.readTime}
                </span>
                <h2 className="type-card-title text-2xl sm:text-3xl md:text-4xl text-charcoal mb-4">
                  <Link href={`/insights/${featuredArticle.slug}`} className="hover:text-bronze transition-colors">
                    {featuredArticle.title}
                  </Link>
                </h2>
                <p className="font-sans text-base text-charcoal/80 leading-relaxed mb-6">
                  {featuredArticle.excerpt}
                </p>
              </div>

              <div className="pt-6 border-t border-warm-grey/20 flex items-center justify-between">
                <span className="font-sans text-xs text-warm-grey-dark">
                  By {featuredArticle.author} ({featuredArticle.authorRole})
                </span>
                <Link
                  href={`/insights/${featuredArticle.slug}`}
                  className="font-sans text-xs uppercase tracking-wider text-bronze hover:text-charcoal font-semibold"
                >
                  Read Paper &rarr;
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Articles Grid */}
      <section className="py-20 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        {filteredArticles.length === 0 ? (
          <div className="text-center py-24 bg-white border border-warm-grey/30 p-12">
            <h3 className="type-card-title text-2xl text-charcoal mb-3">No matching articles found</h3>
            <p className="font-sans text-sm text-charcoal/70 max-w-md mx-auto mb-6">
              We could not find any specifications matching &ldquo;{searchQuery}&rdquo;. Try another term or reset filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('All');
                setSearchQuery('');
                setVisibleCount(ARTICLES_PER_PAGE);
              }}
              className="px-6 py-2.5 bg-charcoal text-white font-mono text-xs uppercase tracking-widest hover:bg-black transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-warm-grey/20 text-xs font-mono text-warm-grey-dark">
              <span>
                Showing {Math.min(visibleArticles.length, filteredArticles.length)} of {filteredArticles.length} papers
              </span>
              {selectedCategory !== 'All' && (
                <span className="uppercase text-bronze font-medium">Category: {selectedCategory}</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {visibleArticles.map((article) => (
                <article
                  key={article.slug}
                  className="bg-white border border-warm-grey/40 flex flex-col justify-between group shadow-sm hover:border-charcoal/60 transition-all duration-300"
                >
                  <Link href={`/insights/${article.slug}`} className="relative aspect-[16/10] bg-charcoal block overflow-hidden">
                    <Image
                      src={article.coverImage}
                      alt={article.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    <span className="absolute top-3 left-3 font-mono text-[10px] bg-charcoal/90 text-white px-2 py-0.5 uppercase tracking-widest">
                      {article.category}
                    </span>
                  </Link>

                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs text-warm-grey-dark mb-3">
                        <span>{article.date}</span>
                        <span>{article.readTime}</span>
                      </div>

                      <h3 className="type-card-title text-xl sm:text-2xl text-charcoal mb-3 group-hover:text-bronze transition-colors">
                        <Link href={`/insights/${article.slug}`}>
                          {article.title}
                        </Link>
                      </h3>

                      <p className="font-sans text-xs sm:text-sm text-charcoal/75 leading-relaxed mb-6">
                        {article.excerpt}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-warm-grey/20 flex items-center justify-between">
                      <span className="font-sans text-xs text-warm-grey-dark">
                        {article.author}
                      </span>
                      <Link
                        href={`/insights/${article.slug}`}
                        className="font-sans text-xs uppercase tracking-wider text-bronze hover:text-charcoal font-semibold inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform"
                      >
                        <span>Read</span>
                        <span aria-hidden="true">&rarr;</span>
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* Load More Pagination Interaction */}
            {hasMore && (
              <div className="mt-16 text-center pt-8 border-t border-warm-grey/30">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  className="inline-flex items-center justify-center gap-3 px-8 py-3.5 bg-charcoal text-white hover:bg-black font-mono text-xs uppercase tracking-[0.2em] font-medium transition-all shadow-sm cursor-pointer"
                >
                  <span>Load More Articles</span>
                  <span aria-hidden="true">&darr;</span>
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
