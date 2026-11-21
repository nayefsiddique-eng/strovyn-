import React, { Suspense } from 'react';
import { getPublicOpenVacancies } from '@/lib/cms/publicCareers';
import { PublicCareersClient } from '@/components/careers/PublicCareersClient';

async function CareersDynamicContent() {
  const vacancies = await getPublicOpenVacancies();
  return <PublicCareersClient vacancies={vacancies} />;
}

export default function CareersPage() {
  return (
    <Suspense fallback={<PublicCareersClient vacancies={[]} isLoading />}>
      <CareersDynamicContent />
    </Suspense>
  );
}
