import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { getPublishedArticleBySlug } from '@/lib/cms/publicArticles';
import { V3InsightArticle } from '@/components/v3-luxury/pages/V3InsightArticle';

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

  return <V3InsightArticle article={article} />;
}
