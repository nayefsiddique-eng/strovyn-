import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import {
  getProjectsWithOverridesAsync,
  getPublishedProjectDetailAsync,
} from '@/lib/projectPhotos';
import { V3ProjectCaseStudy } from '@/components/v3-luxury/pages/V3ProjectCaseStudy';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const project = await getPublishedProjectDetailAsync(slug);
  if (!project) {
    return {
      title: 'Project Not Found',
      robots: { index: false, follow: false },
    };
  }

  return {
    title: project.seoTitle,
    description: project.seoDescription,
    openGraph: {
      title: `${project.seoTitle} | Strovyn Painting Co.`,
      description: project.seoDescription,
      images: project.heroImage ? [project.heroImage] : ['/images/strovyn-logo.png'],
    },
  };
}

export default async function ProjectDetailPage({ params }: Props) {
  await connection();
  const { slug } = await params;
  const projects = await getProjectsWithOverridesAsync();
  const project = projects.find((p) => p.slug === slug);

  if (!project) {
    notFound();
  }

  const relatedProjects = projects.filter((p) => p.slug !== project.slug).slice(0, 3);
  return <V3ProjectCaseStudy project={project} relatedProjects={relatedProjects} />;
}
