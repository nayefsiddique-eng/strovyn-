import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getProjectsWithOverridesAsync } from '@/lib/projectPhotos';
import { listPublishedArticles } from '@/lib/cms/publicArticles';
import { V3IntroGate } from '@/components/v3/shared/V3IntroAndTheme';
import { EditorialAtelierExperience } from '@/components/v3/editorial/EditorialAtelierExperience';

export const metadata: Metadata = {
  title: 'Strovyn Painting Co. — Concept B: Editorial Atelier',
  description: 'Magazine-grade architectural print monograph concept for Strovyn Painting Co.',
  robots: { index: false, follow: false },
};

async function EditorialDataLoader() {
  await connection();
  const [projects, articles] = await Promise.all([
    getProjectsWithOverridesAsync(),
    listPublishedArticles({ limit: 3 }),
  ]);
  return <EditorialAtelierExperience projects={projects} articles={articles} />;
}

export default function PrototypeV3EditorialPage() {
  return (
    <>
      <V3IntroGate routeKey="v3-editorial" />
      <Suspense fallback={<EditorialAtelierExperience projects={[]} articles={[]} />}>
        <EditorialDataLoader />
      </Suspense>
    </>
  );
}
