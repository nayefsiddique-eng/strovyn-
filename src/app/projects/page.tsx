'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { PROJECTS_DATA, ProjectData } from '@/data/projectsData';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const CATEGORIES = [
  'All',
  'Architectural Residential',
  'Heritage Restoration',
  'Artisanal Plasters',
] as const;

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectData[]>(PROJECTS_DATA);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  React.useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.projects) {
          setProjects(data.projects);
        }
      })
      .catch(() => {});
  }, []);

  const filteredProjects = projects.filter((project) => {
    const matchesCategory =
      selectedCategory === 'All' || project.category === selectedCategory;
    const matchesStatus =
      selectedStatus === 'All' || project.lifecycle === selectedStatus;
    return matchesCategory && matchesStatus;
  });

  return (
    <main className="w-full min-h-screen bg-ivory text-charcoal">
      {/* Header */}
      <section className="relative pt-36 pb-16 md:pt-44 md:pb-24 border-b border-warm-grey/30 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-4">
          [ COMMISSIONS &amp; CASE STUDIES ]
        </span>
        <h1 className="type-page-title text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-charcoal max-w-4xl mb-8">
          Architectural Portfolio
        </h1>
        <p className="font-sans text-lg sm:text-xl text-charcoal/80 max-w-2xl leading-relaxed">
          A monograph of selected residential estates, heritage conservation projects, and bespoke surface installations across greater Adelaide, South Australia.
        </p>

        {/* Filter Controls */}
        <div className="mt-12 flex flex-col md:flex-row md:items-center justify-between gap-6 pt-8 border-t border-warm-grey/30">
          {/* Categories */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`font-sans text-xs uppercase tracking-widest px-4 py-2 border transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-charcoal text-white border-charcoal'
                    : 'bg-white text-charcoal/80 border-warm-grey/40 hover:border-charcoal'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Lifecycle Status filter */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="font-sans text-xs uppercase text-warm-grey-dark">Stage:</span>
            {['All', 'Completed', 'Active On-Site'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setSelectedStatus(status)}
                className={`font-sans text-xs uppercase tracking-wider px-3 py-1.5 border transition-all cursor-pointer whitespace-nowrap ${
                  selectedStatus === status
                    ? 'bg-bronze text-white border-bronze'
                    : 'bg-transparent text-charcoal/70 border-warm-grey/40 hover:border-bronze'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Projects Grid */}
      <section className="py-20 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-14">
          {filteredProjects.map((project, idx) => (
            <article
              key={project.slug}
              className={`group flex flex-col border border-warm-grey/40 bg-white ${
                idx === 0 ? 'md:col-span-2' : ''
              }`}
            >
              {/* Image */}
              <Link
                href={`/projects/${project.slug}`}
                className="relative aspect-[16/10] sm:aspect-[16/9] overflow-hidden bg-charcoal block"
              >
                <Image
                  src={project.heroImage}
                  alt={project.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105 opacity-95 group-hover:opacity-100"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div className="absolute top-4 left-4 flex gap-2">
                  <Badge
                    variant={
                      project.isDemonstrationSpec
                        ? 'warning'
                        : project.lifecycle === 'Completed'
                        ? 'bronze'
                        : 'warning'
                    }
                    className="bg-ivory/95 dark:bg-charcoal/95"
                  >
                    {project.isDemonstrationSpec ? 'Demonstration Study' : project.lifecycle}
                  </Badge>
                  <span className="font-mono text-xs bg-charcoal/90 text-white px-2.5 py-1 uppercase tracking-widest">
                    {project.isDemonstrationSpec ? 'Illustrative Spec' : project.year}
                  </span>
                </div>
              </Link>

              {/* Details */}
              <div className="p-6 sm:p-8 flex flex-col justify-between flex-1">
                <div>
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <span className="font-sans text-xs uppercase tracking-widest text-bronze font-medium">
                      {project.category}
                    </span>
                    <span className="font-sans text-xs text-warm-grey-dark">
                      {project.location}
                    </span>
                  </div>

                  <h2 className="type-card-title text-2xl sm:text-3xl text-charcoal mb-3">
                    <Link
                      href={`/projects/${project.slug}`}
                      className="hover:text-bronze transition-colors"
                    >
                      {project.title}
                    </Link>
                  </h2>

                  <p className="font-sans text-sm text-charcoal/80 leading-relaxed mb-6">
                    {project.description}
                  </p>

                  <div className="p-3 bg-ivory border border-warm-grey/30 text-xs font-mono text-charcoal/85 mb-6">
                    {project.finishes}
                  </div>
                </div>

                <div className="pt-4 border-t border-warm-grey/20 flex items-center justify-between">
                  <span className="font-sans text-xs text-warm-grey-dark">
                    Collaborator: {project.architect}
                  </span>
                  <Link
                    href={`/projects/${project.slug}`}
                    className="font-sans text-xs uppercase tracking-wider text-bronze hover:text-charcoal font-semibold flex items-center gap-1"
                  >
                    View Case Study &rarr;
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Quote Banner */}
      <section className="py-20 bg-charcoal text-white px-6 sm:px-8 lg:px-12 border-t border-charcoal">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-2">
              [ PRIVATE COMMISSIONS ]
            </span>
            <h2 className="type-section-title text-3xl sm:text-4xl">
              Have an architectural project in specification?
            </h2>
          </div>
          <Button href="/contact" variant="primary" size="lg" className="flex-shrink-0">
            Submit Plans &amp; Inquire
          </Button>
        </div>
      </section>
    </main>
  );
}
