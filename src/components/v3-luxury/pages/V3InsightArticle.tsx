import React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { PublicArticleDetail } from '@/lib/cms/publicArticles';
import { PublicArticleMedia } from '@/components/insights/PublicArticleMedia';

export const V3InsightArticle: React.FC<{ article: PublicArticleDetail }> = ({ article }) => {
  return (
    <div
      role="main"
      className="w-full bg-[#F4F1EA] dark:bg-[#181917] text-[#20211F] dark:text-[#F4F1EA]"
    >
      {/* Essay Masthead */}
      <section className="px-5 sm:px-10 lg:px-16 pt-8 sm:pt-12 pb-12 border-b border-[#B8B5AE]/70 dark:border-white/15">
        <nav
          aria-label="Breadcrumb"
          className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#5C5A55] dark:text-[#B8B5AE] mb-8 flex flex-wrap items-center gap-2 border-b border-[#B8B5AE]/60 dark:border-white/15 pb-3"
        >
          <Link href="/" className="hover:text-[#20211F] dark:hover:text-[#F4F1EA]">
            Frontispiece
          </Link>
          <span>/</span>
          <Link href="/insights" className="hover:text-[#20211F] dark:hover:text-[#F4F1EA]">
            Field Journal
          </Link>
          <span>/</span>
          <span className="text-[#7E6340] dark:text-[#C9B28F] truncate max-w-xs sm:max-w-md">
            {article.title}
          </span>
        </nav>

        <div className="max-w-4xl space-y-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7E6340] dark:text-[#C9B28F] block">
            {article.category} &middot; {article.readTimeLabel}
          </span>
          <h1 className="font-display uppercase text-[clamp(2.4rem,5vw,4.8rem)] leading-[0.94]">
            {article.title}
          </h1>
          {article.subtitle && (
            <p className="font-sans text-lg sm:text-xl text-[#42413D] dark:text-[#D5D2CA] font-light leading-relaxed">
              {article.subtitle}
            </p>
          )}
        </div>
      </section>

      {/* Widescreen Cover Plate */}
      {article.coverImage && (
        <section className="px-5 sm:px-10 lg:px-16 py-10 border-b border-[#B8B5AE]/70 dark:border-white/15">
          <div className="relative aspect-[16/9] lg:aspect-[21/9] bg-[#141513] border border-[#B8B5AE]/70 dark:border-white/15 overflow-hidden">
            <PublicArticleMedia
              src={article.coverImage}
              alt={article.coverImageAlt}
              priority
              sizes="100vw"
            />
          </div>
        </section>
      )}

      {/* 3 / 9 Scholarly Monograph Layout: Left Practitioner Marginalia + Right Long-Form Essay */}
      <section className="px-5 sm:px-10 lg:px-16 py-14 sm:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Left Marginalia */}
          <aside className="lg:col-span-3 lg:sticky lg:top-10 space-y-6 border-t border-[#20211F]/25 dark:border-white/20 pt-4">
            <div>
              <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#7E6340] dark:text-[#C9B28F] block">
                AUTHORSHIP
              </span>
              <span className="font-sans text-sm font-medium block mt-1">{article.authorName}</span>
              <span className="font-sans text-xs text-[#5C5A55] dark:text-[#B8B5AE]">
                {article.authorRole}
              </span>
            </div>

            <div className="pt-4 border-t border-[#B8B5AE]/60 dark:border-white/15">
              <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#7E6340] dark:text-[#C9B28F] block">
                PUBLISHED
              </span>
              <span className="font-mono text-xs block mt-1">{article.publishedDateLabel}</span>
            </div>

            <div className="p-4 bg-[#FAF8F4] dark:bg-[#1B1C19] border border-[#B8B5AE]/80 dark:border-white/15 space-y-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#C41E1E] font-semibold block">
                PRACTITIONER NOTE
              </span>
              <p className="font-sans text-xs text-[#4A4945] dark:text-[#B8B5AE] leading-relaxed">
                Substrate procedures align with AS/NZS 2311. Request an Adelaide site diagnostic for
                project-specific coating specifications.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#20211F] dark:text-[#F4F1EA] underline pt-1"
              >
                <span>Consult Desk</span>
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </aside>

          {/* Right Sanitized Editorial Body */}
          <article className="lg:col-span-9 max-w-3xl space-y-8 font-sans text-base sm:text-lg text-[#32312E] dark:text-[#DBD8D0] font-light leading-[1.85]">
            <blockquote className="text-xl sm:text-2xl italic border-l-2 border-[#C41E1E] pl-6 py-1 text-[#20211F] dark:text-[#F4F1EA]">
              &ldquo;{article.excerpt}&rdquo;
            </blockquote>

            <div
              className="space-y-6 [&_h2]:font-display [&_h2]:uppercase [&_h2]:text-3xl [&_h2]:text-[#20211F] dark:[&_h2]:text-[#F4F1EA] [&_h2]:mt-10 [&_h2]:mb-3 [&_h3]:font-display [&_h3]:uppercase [&_h3]:text-2xl [&_h3]:text-[#20211F] dark:[&_h3]:text-[#F4F1EA] [&_h3]:mt-8 [&_h3]:mb-2 [&_h4]:font-sans [&_h4]:font-semibold [&_h4]:text-lg [&_h4]:mt-6 [&_blockquote]:border-l-2 [&_blockquote]:border-[#A78B65] [&_blockquote]:pl-5 [&_blockquote]:italic [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-[#7E6340] dark:[&_a]:text-[#C9B28F] [&_a]:underline [&_img]:max-w-full [&_img]:h-auto [&_img]:border [&_img]:border-[#B8B5AE]/50 [&_hr]:border-[#B8B5AE]/50 [&_hr]:my-8"
              dangerouslySetInnerHTML={{ __html: article.sanitizedHtml }}
            />
          </article>
        </div>
      </section>
    </div>
  );
};
