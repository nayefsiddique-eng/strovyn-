import React from 'react';
import { connection } from 'next/server';
import { listPublishedArticles } from '@/lib/cms/publicArticles';
import InsightsArticles from './InsightsArticles';

export async function HomeInsightsSection({ className }: { className?: string }) {
  await connection();
  const articles = await listPublishedArticles({ limit: 3 });
  return <InsightsArticles articles={articles} className={className} />;
}
