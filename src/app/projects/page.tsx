import React, { Suspense } from 'react';
import { connection } from 'next/server';
import { getProjectsWithOverridesAsync } from '@/lib/projectPhotos';
import { PublicProjectsCatalog } from '@/components/projects/PublicProjectsCatalog';

async function DynamicPublicProjects() {
  await connection();
  const projects = await getProjectsWithOverridesAsync();
  return <PublicProjectsCatalog initialProjects={projects} />;
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <main className="w-full min-h-screen bg-ivory text-charcoal flex items-center justify-center px-6 py-24 font-mono text-xs uppercase tracking-widest">
          Loading Architectural Portfolio...
        </main>
      }
    >
      <DynamicPublicProjects />
    </Suspense>
  );
}
