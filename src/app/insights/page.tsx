import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { listPublishedArticles } from '@/lib/cms/publicArticles';
import { V3InsightsJournal } from '@/components/v3-luxury/pages/V3InsightsJournal';

export const metadata: Metadata = {
  title: 'Architectural Insights & Coatings Science',
  description:
    'Technical papers, substrate chemistry analyses, and field notes on fine finishing practices across Adelaide, South Australia.',
};

async function DynamicPublicInsightsCatalog() {
  await connection();
  const articles = await listPublishedArticles();
  return <V3InsightsJournal articles={articles} />;
}

export default function InsightsPage() {
  return (
    <Suspense
      fallback={
        <div
          role="main"
          className="w-full min-h-screen bg-[#F4F1EA] dark:bg-[#181917] text-[#20211F] dark:text-[#F4F1EA] flex items-center justify-center px-6 py-24 font-mono text-xs uppercase tracking-[0.22em]"
        >
          Loading Field Journal...
        </div>
      }
    >
      <DynamicPublicInsightsCatalog />
    </Suspense>
  );
}
