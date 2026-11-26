import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getProjectsWithOverridesAsync } from '@/lib/projectPhotos';
import { listPublishedArticles } from '@/lib/cms/publicArticles';
import { V3IntroGate } from '@/components/v3/shared/V3IntroAndTheme';
import { ArchitecturalCinemaExperience } from '@/components/v3/cinema/ArchitecturalCinemaExperience';

export const metadata: Metadata = {
  title: 'Strovyn Painting Co. — Concept A: Architectural Cinema',
  description: 'Full-bleed photographic storytelling concept for Strovyn Painting Co.',
  robots: { index: false, follow: false },
};

async function CinemaDataLoader() {
  await connection();
  const [projects, articles] = await Promise.all([
    getProjectsWithOverridesAsync(),
    listPublishedArticles({ limit: 3 }),
  ]);
  return <ArchitecturalCinemaExperience projects={projects} articles={articles} />;
}

export default function PrototypeV3CinemaPage() {
  return (
    <>
      <V3IntroGate routeKey="v3-cinema" />
      <Suspense fallback={<ArchitecturalCinemaExperience projects={[]} articles={[]} />}>
        <CinemaDataLoader />
      </Suspense>
    </>
  );
}
