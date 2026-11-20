import React, { Suspense } from 'react';
import { connection } from 'next/server';
import { listPublishedArticles } from '@/lib/cms/publicArticles';
import { PublicInsightsCatalog } from '@/components/insights/PublicInsightsCatalog';

async function DynamicPublicInsightsCatalog() {
  await connection();
  const articles = await listPublishedArticles();
  return <PublicInsightsCatalog articles={articles} />;
}

export default function InsightsPage() {
  return (
    <Suspense
      fallback={
        <main className="w-full min-h-screen bg-ivory text-charcoal flex items-center justify-center px-6 py-24 font-mono text-xs uppercase tracking-widest">
          Loading Published Insights...
        </main>
      }
    >
      <DynamicPublicInsightsCatalog />
    </Suspense>
  );
}
