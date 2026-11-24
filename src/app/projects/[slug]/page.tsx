import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import Link from 'next/link';
import Image from 'next/image';
import type { PublicProjectDetail } from '@/lib/cms/publicProjects';
import {
  getProjectsWithOverridesAsync,
  getPublishedProjectDetailAsync,
} from '@/lib/projectPhotos';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface Props {
  params: Promise<{ slug: string }>;
}

export const instant = false;

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

function ProjectDetailBody({
  project,
  relatedProjects,
}: {
  project: PublicProjectDetail;
  relatedProjects: PublicProjectDetail[];
}) {
  return (
    <main className="w-full min-h-screen bg-ivory text-charcoal">
      {/* Breadcrumb & Title */}
      <section className="relative pt-36 pb-16 md:pt-44 md:pb-24 border-b border-warm-grey/30 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        <nav className="font-sans text-xs uppercase tracking-widest text-warm-grey-dark mb-6 flex items-center gap-2">
          <Link href="/" className="hover:text-charcoal transition-colors">Home</Link>
          <span>/</span>
          <Link href="/projects" className="hover:text-charcoal transition-colors">Portfolio</Link>
          <span>/</span>
          <span className="text-bronze font-medium">{project.title}</span>
        </nav>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-3">
              <Badge
                variant={
                  project.isDemonstrationSpec
                    ? 'warning'
                    : project.lifecycle === 'Completed'
                      ? 'bronze'
                      : 'warning'
                }
              >
                {project.isDemonstrationSpec ? 'Demonstration Study' : project.lifecycle}
              </Badge>
              <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium">
                {project.category} &mdash; {project.location}
              </span>
            </div>
            <h1 className="type-page-title text-4xl sm:text-5xl md:text-6xl text-charcoal">
              {project.title}
            </h1>
          </div>
          <Button href="/contact" variant="primary" size="lg" className="flex-shrink-0">
            Inquire About Similar Finish
          </Button>
        </div>
      </section>

      {/* Hero Image */}
      <section className="w-full h-[60vh] relative bg-charcoal border-b border-warm-grey/30">
        <Image
          src={project.heroImage}
          alt={project.title}
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
      </section>

      {/* Metadata & Narrative */}
      <section className="py-16 md:py-24 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto border-b border-warm-grey/30">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          <div className="lg:col-span-4 space-y-6 bg-white border border-warm-grey/40 p-6 sm:p-8 self-start">
            <h2 className="font-sans text-xs uppercase tracking-widest text-bronze font-semibold border-b border-warm-grey/30 pb-3">
              Architectural Specification
            </h2>
            <div className="space-y-4 font-sans text-sm">
              <div>
                <span className="text-xs uppercase text-warm-grey-dark block">Year</span>
                <span className="font-medium text-charcoal">{project.year}</span>
              </div>
              <div>
                <span className="text-xs uppercase text-warm-grey-dark block">Location</span>
                <span className="font-medium text-charcoal">{project.location}</span>
              </div>
              <div>
                <span className="text-xs uppercase text-warm-grey-dark block">Architect / Specifier</span>
                <span className="font-medium text-charcoal">{project.architect}</span>
              </div>
              <div>
                <span className="text-xs uppercase text-warm-grey-dark block">Builder</span>
                <span className="font-medium text-charcoal">{project.builder}</span>
              </div>
              {project.sheenLevels && (
                <div>
                  <span className="text-xs uppercase text-warm-grey-dark block">Sheen Calibration</span>
                  <span className="font-mono text-xs text-charcoal/85">{project.sheenLevels}</span>
                </div>
              )}
              <div>
                <span className="text-xs uppercase text-warm-grey-dark block">Material System</span>
                <span className="font-mono text-xs text-charcoal/85">{project.finishes}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-8">
            <div>
              <h2 className="type-section-title text-2xl sm:text-3xl text-charcoal mb-4">
                Project Overview
              </h2>
              <p className="font-sans text-base sm:text-lg text-charcoal/85 leading-relaxed">
                {project.description}
              </p>
            </div>

            {project.challenges && (
              <div>
                <h3 className="font-sans text-sm uppercase tracking-widest text-bronze font-semibold mb-3">
                  Technical Challenges &amp; Approach
                </h3>
                <p className="font-sans text-base text-charcoal/80 leading-relaxed">
                  {project.challenges}
                </p>
              </div>
            )}

            {project.scope.length > 0 && (
              <div>
                <h3 className="font-sans text-sm uppercase tracking-widest text-bronze font-semibold mb-4">
                  Executed Scope of Works
                </h3>
                <ul className="space-y-3 font-sans text-sm sm:text-base text-charcoal/85">
                  {project.scope.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-bronze mt-2 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Before / After Pairs (when configured) */}
      {project.beforeAfterPairs.length > 0 && (
        <section className="py-16 md:py-20 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto border-b border-warm-grey/30">
          <div className="mb-10">
            <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-2">
              [ SUBSTRATE TRANSFORMATION ]
            </span>
            <h2 className="type-section-title text-3xl text-charcoal">
              Before &amp; After Documentation
            </h2>
          </div>
          <div className="space-y-8">
            {project.beforeAfterPairs.map((pair) => (
              <div key={pair.pairKey} className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white border border-warm-grey/40 p-5">
                <figure className="space-y-2">
                  <div className="relative aspect-[16/10] bg-charcoal overflow-hidden">
                    <Image src={pair.beforeUrl} alt={pair.beforeAlt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
                  </div>
                  <figcaption className="font-mono text-[11px] uppercase tracking-wider text-warm-grey-dark">
                    Before · {pair.beforeAlt}
                  </figcaption>
                </figure>
                <figure className="space-y-2">
                  <div className="relative aspect-[16/10] bg-charcoal overflow-hidden">
                    <Image src={pair.afterUrl} alt={pair.afterAlt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
                  </div>
                  <figcaption className="font-mono text-[11px] uppercase tracking-wider text-bronze">
                    After · {pair.afterAlt}
                  </figcaption>
                </figure>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Gallery */}
      <section className="py-16 md:py-24 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto border-b border-warm-grey/30">
        <div className="mb-12">
          <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-2">
            [ PHOTOGRAPHIC ARCHIVE ]
          </span>
          <h2 className="type-section-title text-3xl text-charcoal">
            Detailed Surface Views
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {project.galleryImages.map((imgUrl, idx) => (
            <div key={`${imgUrl}-${idx}`} className="relative aspect-[16/10] bg-charcoal border border-warm-grey/30 overflow-hidden">
              <Image
                src={imgUrl}
                alt={`${project.title} - Detail view ${idx + 1}`}
                fill
                className="object-cover hover:scale-105 transition-transform duration-700"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Related Projects */}
      {relatedProjects.length > 0 && (
        <section className="py-16 md:py-24 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
          <h3 className="font-sans text-xs uppercase tracking-widest text-warm-grey-dark mb-8">
            Other Published Commissions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedProjects.map((p) => (
              <Link key={p.slug} href={`/projects/${p.slug}`} className="group block border border-warm-grey/40 bg-white">
                <div className="relative aspect-[16/10] bg-charcoal overflow-hidden">
                  <Image
                    src={p.heroImage}
                    alt={p.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
                <div className="p-4">
                  <span className="font-sans text-[11px] uppercase text-bronze tracking-wider block mb-1">
                    {p.category}
                  </span>
                  <h4 className="type-card-title text-lg sm:text-xl text-charcoal group-hover:text-bronze transition-colors">
                    {p.title}
                  </h4>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
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
  return <ProjectDetailBody project={project} relatedProjects={relatedProjects} />;
}
