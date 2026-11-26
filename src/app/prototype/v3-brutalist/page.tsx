import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getProjectsWithOverridesAsync } from '@/lib/projectPhotos';
import { listPublishedArticles } from '@/lib/cms/publicArticles';
import { V3IntroGate } from '@/components/v3/shared/V3IntroAndTheme';
import { ContemporaryBrutalistExperience } from '@/components/v3/brutalist/ContemporaryBrutalistExperience';

export const metadata: Metadata = {
  title: 'Strovyn Painting Co. — Concept C: Contemporary Brutalism',
  description: 'Exposed architectural grid and structural poster concept for Strovyn Painting Co.',
  robots: { index: false, follow: false },
};

async function BrutalistDataLoader() {
  await connection();
  const [projects, articles] = await Promise.all([
    getProjectsWithOverridesAsync(),
    listPublishedArticles({ limit: 3 }),
  ]);
  return <ContemporaryBrutalistExperience projects={projects} articles={articles} />;
}

export default function PrototypeV3BrutalistPage() {
  return (
    <>
      <V3IntroGate routeKey="v3-brutalist" />
      <Suspense fallback={<ContemporaryBrutalistExperience projects={[]} articles={[]} />}>
        <BrutalistDataLoader />
      </Suspense>
    </>
  );
}
