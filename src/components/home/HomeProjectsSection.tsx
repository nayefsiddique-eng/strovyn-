import React from 'react';
import { connection } from 'next/server';
import { getProjectsWithOverridesAsync } from '@/lib/projectPhotos';
import FeaturedProjects from './FeaturedProjects';

export async function HomeProjectsSection({ className }: { className?: string }) {
  await connection();
  const projects = await getProjectsWithOverridesAsync();
  const featured =
    projects.find((p) => p.isFeatured) ??
    projects.find((p) => p.slug === 'the-north-adelaide-residence') ??
    projects[0] ??
    null;

  return <FeaturedProjects featuredProject={featured} className={className} />;
}
