import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { PROJECTS_DATA } from '@/data/projectsData';
import { getProjectsWithOverrides } from '@/lib/projectPhotos';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return PROJECTS_DATA.map((project) => ({
    slug: project.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const projects = getProjectsWithOverrides();
  const project = projects.find((p) => p.slug === slug);
  if (!project) return { title: 'Project Not Found' };

  return {
    title: `${project.title} | Strovyn Painting Co.`,
    description: project.description,
  };
}

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params;
  const projects = getProjectsWithOverrides();
  const project = projects.find((p) => p.slug === slug);

  if (!project) {
    notFound();
  }

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
            <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-charcoal leading-tight">
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

      {/* Split Case Study Content */}
      <section className="py-20 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto border-b border-warm-grey/30">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          {/* Left Column: Sticky Metadata & Specs */}
          <div className="lg:col-span-5 space-y-8">
            <div className="p-6 sm:p-8 bg-white border border-warm-grey/40 sticky top-28">
              <span className="font-mono text-xs text-bronze uppercase tracking-widest block mb-4">
                COMMISSION METADATA
              </span>

              <div className="space-y-4 text-sm divide-y divide-warm-grey/20">
                <div className="pt-2">
                  <span className="font-sans text-xs uppercase text-warm-grey-dark block mb-1">Architect / Design Collaborator</span>
                  <p className="font-sans font-medium text-charcoal">{project.architect}</p>
                </div>
                <div className="pt-3">
                  <span className="font-sans text-xs uppercase text-warm-grey-dark block mb-1">Builder / General Contractor</span>
                  <p className="font-sans font-medium text-charcoal">{project.builder}</p>
                </div>
                <div className="pt-3">
                  <span className="font-sans text-xs uppercase text-warm-grey-dark block mb-1">Location &amp; Delivery Year</span>
                  <p className="font-sans font-medium text-charcoal">{project.location} &mdash; {project.year}</p>
                </div>
                <div className="pt-3">
                  <span className="font-sans text-xs uppercase text-warm-grey-dark block mb-1">Finishes Schedule</span>
                  <p className="font-mono text-xs text-charcoal bg-ivory p-2 border border-warm-grey/30">{project.finishes}</p>
                </div>
                <div className="pt-3">
                  <span className="font-sans text-xs uppercase text-warm-grey-dark block mb-1">Calibrated Sheen Levels</span>
                  <p className="font-sans text-xs text-charcoal/85">{project.sheenLevels}</p>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-warm-grey/30">
                <Button href="/contact" variant="primary" size="md" className="w-full text-center">
                  Request Finishes Schedule
                </Button>
                <a
                  href={`https://wa.me/61406646061?text=${encodeURIComponent(`Hello Strovyn Painting Co. I am viewing the ${project.title} study and would like to discuss a similar project in Adelaide.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 w-full py-2.5 px-4 bg-emerald-800 hover:bg-emerald-700 text-white font-sans text-xs uppercase tracking-wider font-medium text-center flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Chat on WhatsApp: 0406 646 061</span>
                </a>
              </div>
            </div>
          </div>

          {/* Right Column: Narrative, Challenges, Gallery */}
          <div className="lg:col-span-7 space-y-12">
            <div>
              <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-2">
                ARCHITECTURAL INTENT
              </span>
              <h2 className="font-serif text-3xl text-charcoal mb-4">Project Overview</h2>
              <p className="font-sans text-base sm:text-lg text-charcoal/85 leading-relaxed">
                {project.description}
              </p>
            </div>

            <div className="border-t border-warm-grey/30 pt-8">
              <h3 className="font-serif text-2xl text-charcoal mb-4">Execution Scope</h3>
              <ul className="space-y-3 font-sans text-sm sm:text-base text-charcoal/85">
                {project.scope.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="w-2 h-2 bg-bronze mt-2 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-warm-grey/30 pt-8 bg-white p-6 border border-warm-grey/30">
              <span className="font-sans text-xs uppercase tracking-wider text-bronze font-medium block mb-2">
                TECHNICAL RESOLUTION
              </span>
              <h3 className="font-serif text-xl text-charcoal mb-2">Substrate &amp; Light Challenges</h3>
              <p className="font-sans text-sm sm:text-base text-charcoal/80 leading-relaxed">
                {project.challenges}
              </p>
            </div>

            {/* Gallery Images */}
            {project.galleryImages && project.galleryImages.length > 0 && (
              <div className="border-t border-warm-grey/30 pt-8 space-y-6">
                <h3 className="font-serif text-2xl text-charcoal mb-4">Finish &amp; Junction Photography</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {project.galleryImages.map((img, i) => (
                    <div key={i} className="relative aspect-[4/3] bg-charcoal border border-warm-grey/30 overflow-hidden">
                      <Image
                        src={img}
                        alt={`${project.title} detail ${i + 1}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 30vw"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Related Projects */}
      <section className="py-16 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        <h3 className="font-serif text-2xl text-charcoal mb-8">Other Selected Commissions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {PROJECTS_DATA.filter((p) => p.slug !== project.slug).slice(0, 3).map((p) => (
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
                <h4 className="font-serif text-lg text-charcoal group-hover:text-bronze transition-colors">
                  {p.title}
                </h4>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
