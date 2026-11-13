import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ARTICLES_DATA } from '@/data/articlesData';
import { Button } from '@/components/ui/Button';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return ARTICLES_DATA.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = ARTICLES_DATA.find((a) => a.slug === slug);
  if (!article) return { title: 'Article Not Found' };

  return {
    title: `${article.title} | Strovyn Painting Co.`,
    description: article.excerpt,
  };
}

export default async function ArticleDetailPage({ params }: Props) {
  const { slug } = await params;
  const article = ARTICLES_DATA.find((a) => a.slug === slug);

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
          [ {article.category} // {article.readTime} ]
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-charcoal leading-[1.15] mb-8">
          {article.title}
        </h1>

        <div className="flex items-center gap-4 pt-6 border-t border-warm-grey/30 text-xs sm:text-sm text-warm-grey-dark">
          <div>
            <span className="font-sans font-medium text-charcoal block">{article.author}</span>
            <span>{article.authorRole}</span>
          </div>
          <span className="ml-auto font-mono">{article.date}</span>
        </div>
      </section>

      {/* Hero Cover Image */}
      <section className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 py-10">
        <div className="relative aspect-[16/9] bg-charcoal border border-warm-grey/30 overflow-hidden">
          <Image
            src={article.coverImage}
            alt={article.title}
            fill
            priority
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 80vw"
          />
        </div>
      </section>

      {/* Article Body */}
      <article className="max-w-3xl mx-auto px-6 sm:px-8 lg:px-12 py-12 space-y-6 font-sans text-base sm:text-lg text-charcoal/85 leading-relaxed">
        <p className="font-serif text-xl sm:text-2xl text-charcoal leading-snug italic border-l-2 border-bronze pl-6 py-1 my-8">
          &ldquo;{article.excerpt}&rdquo;
        </p>

        {article.content.map((paragraph, idx) => (
          <p key={idx}>{paragraph}</p>
        ))}

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
          <h3 className="font-serif text-2xl sm:text-3xl mb-4">
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
