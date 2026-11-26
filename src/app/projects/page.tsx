import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getProjectsWithOverridesAsync } from '@/lib/projectPhotos';
import { V3ProjectsCatalog } from '@/components/v3-luxury/pages/V3ProjectsCatalog';

export const metadata: Metadata = {
  title: 'Architectural Portfolio',
  description:
    'Selected residential, heritage restoration, and architectural surface commissions across Greater Adelaide, South Australia.',
};

async function DynamicPublicProjects() {
  await connection();
  const projects = await getProjectsWithOverridesAsync();
  return <V3ProjectsCatalog initialProjects={projects} />;
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div
          role="main"
          className="w-full min-h-screen bg-[#F4F1EA] dark:bg-[#181917] text-[#20211F] dark:text-[#F4F1EA] flex items-center justify-center px-6 py-24 font-mono text-xs uppercase tracking-[0.22em]"
        >
          Loading Commission Monograph...
        </div>
      }
    >
      <DynamicPublicProjects />
    </Suspense>
  );
}
