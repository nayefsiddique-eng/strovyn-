import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getProjectsWithOverridesAsync } from '@/lib/projectPhotos';
import { listPublishedArticles } from '@/lib/cms/publicArticles';
import { getPublicTestimonials } from '@/lib/cms/publicTestimonials';
import { V3LuxuryHomePage } from '@/components/v3-luxury/home/V3LuxuryHomePage';

export const metadata: Metadata = {
  title: {
    absolute: 'Strovyn Painting Co. | Premium Painters Adelaide, South Australia',
  },
  description:
    'Thoughtful preparation, refined finishes and professional painting for spaces that deserve a higher standard. Serving greater Adelaide, South Australia.',
};

async function HomeDynamicContent() {
  await connection();
  const [projects, articles, testimonials] = await Promise.all([
    getProjectsWithOverridesAsync(),
    listPublishedArticles({ limit: 3 }),
    getPublicTestimonials(),
  ]);
  return (
    <V3LuxuryHomePage
      projects={projects}
      articles={articles}
      testimonials={testimonials}
    />
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <V3LuxuryHomePage projects={[]} articles={[]} testimonials={[]} />
      }
    >
      <HomeDynamicContent />
    </Suspense>
  );
}
