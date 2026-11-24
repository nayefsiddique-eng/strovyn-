import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { PublicArticleMedia } from '@/components/insights/PublicArticleMedia';
import { getPublishedArticleBySlug } from '@/lib/cms/publicArticles';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) {
    return {
      title: 'Article Not Found',
      robots: { index: false, follow: false },
    };
  }

  return {
    title: article.seoTitle,
    description: article.seoDescription,
    openGraph: {
      title: `${article.seoTitle} | Strovyn Painting Co.`,
      description: article.seoDescription,
      type: 'article',
      publishedTime: article.publishedAt ?? undefined,
      images: article.ogImage ? [article.ogImage] : ['/images/strovyn-logo.png'],
    },
  };
}

export default async function ArticleDetailPage({ params }: Props) {
  await connection();
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  return (
    <main className="w-full min-h-screen bg-ivory text-charcoal">
      {/* Header */}
      <section className="relative pt-36 pb-16 md:pt-44 md:pb-20 border-b border-warm-grey/30 px-6 sm:px-8 lg:px-12 max-w-4xl mx-auto">
        <nav className="font-sans text-xs uppercase tracking-widest text-warm-grey-dark mb-6 flex items-center gap-2">
          <Link href="/" className="hover:text-charcoal transition-colors">Home</Link>
          <span>/</span>
          <Link href="/insights" className="hover:text-charcoal transition-colors">Insights</Link>
          <span>/</span>
          <span className="text-bronze font-medium truncate">{article.title}</span>
        </nav>

        <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-4">
          [ {article.category} &mdash; {article.readTimeLabel} ]
        </span>
        <h1 className="type-page-title text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-charcoal mb-6">
          {article.title}
        </h1>
        {article.subtitle && (
          <p className="font-sans text-lg sm:text-xl text-charcoal/75 leading-relaxed mb-6">
            {article.subtitle}
          </p>
        )}

        <div className="flex items-center gap-4 pt-6 border-t border-warm-grey/30 text-xs sm:text-sm text-warm-grey-dark">
          <div>
            <span className="font-sans font-medium text-charcoal block">{article.authorName}</span>
            <span>{article.authorRole}</span>
          </div>
          <span className="ml-auto font-mono">{article.publishedDateLabel}</span>
        </div>
      </section>

      {/* Hero Cover Image */}
      {article.coverImage && (
        <section className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 py-10">
          <div className="relative aspect-[16/9] bg-charcoal border border-warm-grey/30 overflow-hidden">
            <PublicArticleMedia
              src={article.coverImage}
              alt={article.coverImageAlt}
              priority
              sizes="(max-width: 1024px) 100vw, 80vw"
            />
          </div>
        </section>
      )}

      {/* Sanitized Editorial Body */}
      <article className="max-w-3xl mx-auto px-6 sm:px-8 lg:px-12 py-12 font-sans text-base sm:text-lg text-charcoal/85 leading-relaxed">
        <p className="type-quote text-xl sm:text-2xl text-charcoal italic border-l-2 border-bronze pl-6 py-1 my-8">
          &ldquo;{article.excerpt}&rdquo;
        </p>

        <div
          className="space-y-6 [&_h2]:font-display [&_h2]:text-3xl [&_h2]:text-charcoal [&_h2]:mt-10 [&_h2]:mb-3 [&_h3]:font-display [&_h3]:text-2xl [&_h3]:text-charcoal [&_h3]:mt-8 [&_h3]:mb-2 [&_h4]:font-sans [&_h4]:font-semibold [&_h4]:text-lg [&_h4]:mt-6 [&_blockquote]:border-l-2 [&_blockquote]:border-bronze [&_blockquote]:pl-5 [&_blockquote]:italic [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-bronze [&_a]:underline [&_img]:max-w-full [&_img]:h-auto [&_img]:border [&_img]:border-warm-grey/30 [&_hr]:border-warm-grey/40 [&_hr]:my-8"
          dangerouslySetInnerHTML={{ __html: article.sanitizedHtml }}
        />

        <div className="mt-12 p-6 sm:p-8 bg-white border border-warm-grey/40">
          <span className="font-mono text-xs uppercase text-bronze tracking-widest block mb-2">
            PRACTITIONER NOTE &mdash; ARCHITECTURAL SPECIFICATION
          </span>
          <p className="font-sans text-sm text-charcoal/80 leading-relaxed">
            All substrate preparation procedures detailed herein correspond strictly to the Australian &amp; New Zealand Painting Standards (AS/NZS 2311). For customized drawdown panels or architectural specifications, contact our studio team.
          </p>
        </div>
      </article>

      {/* Bottom CTA */}
      <section className="py-16 bg-charcoal text-white px-6 sm:px-8 lg:px-12 mt-16 border-t border-charcoal">
        <div className="max-w-3xl mx-auto text-center">
          <h3 className="type-section-title text-2xl sm:text-3xl mb-4">
            Consult on Substrate Specifications
          </h3>
          <p className="font-sans text-sm sm:text-base text-warm-grey mb-8">
            Speak directly with our technical coatings directors regarding moisture thresholds, raking light analysis, or historical paint matching.
          </p>
          <Button href="/contact" variant="primary" size="md">
            Contact Technical Team
          </Button>
        </div>
      </section>
    </main>
  );
}
