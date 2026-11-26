import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { getPublicOpenVacancies } from '@/lib/cms/publicCareers';
import { V3CareersGuild } from '@/components/v3-luxury/pages/V3CareersGuild';

export const metadata: Metadata = {
  title: 'Guild Careers',
  description:
    'Join Strovyn Painting Co.’s architectural finishing guild in Adelaide, South Australia.',
};

async function CareersDynamicContent() {
  const vacancies = await getPublicOpenVacancies();
  return <V3CareersGuild vacancies={vacancies} />;
}

export default function CareersPage() {
  return (
    <Suspense fallback={<V3CareersGuild vacancies={[]} isLoading />}>
      <CareersDynamicContent />
    </Suspense>
  );
}
