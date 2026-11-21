'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Camera, ExternalLink, FolderKanban, Plus, Search } from 'lucide-react';
import type { AdminProjectListItem } from '@/lib/cms/projectsService';
import type { ProjectVisibilityStatus } from '@/lib/cms/projectValidators';
import type { StaffViewerIdentity } from './StaffAuthGateCards';

const VISIBILITY_BADGE: Record<ProjectVisibilityStatus, string> = {
  published: 'border-emerald-800/40 bg-emerald-50 text-emerald-900',
  draft: 'border-warm-grey bg-ivory-light text-charcoal',
  archived: 'border-warm-grey-dark/40 bg-warm-grey-light/60 text-warm-grey-dark',
};

export function AdminProjectsWorkspace({
  staff,
  projects,
}: {
  staff: StaffViewerIdentity;
  projects: AdminProjectListItem[];
}) {
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | ProjectVisibilityStatus>('all');
  const [search, setSearch] = useState('');

  const canCreate = staff.role === 'editor' || staff.role === 'publisher' || staff.role === 'admin';
  const canLegacyPhotos = staff.role === 'publisher' || staff.role === 'admin';

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (visibilityFilter !== 'all' && p.visibilityStatus !== visibilityFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [projects, visibilityFilter, search]);

  return (
    <div className="space-y-6">
      <section className="bg-white border border-warm-grey/60 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-bronze block mb-1.5">
            PORTFOLIO MANAGEMENT
          </span>
          <h1 className="type-section-title text-3xl text-charcoal">
            Projects &amp; Portfolio
          </h1>
          <p className="font-sans text-sm text-charcoal/75 mt-1">
            Create case studies, upload multi-image galleries, pair before/after shots, and control public portfolio visibility.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <Link
              href="/admin/projects/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-bronze text-ivory hover:bg-bronze-hover transition-colors font-mono text-xs uppercase tracking-wider"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>New Project</span>
            </Link>
          )}
          {canLegacyPhotos && (
            <Link
              href="/admin/photos"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-warm-grey text-xs font-mono uppercase tracking-wider text-charcoal hover:border-charcoal"
            >
              <Camera className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Legacy Photo Tool</span>
            </Link>
          )}
          <Link
            href="/projects"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-warm-grey text-xs font-mono uppercase tracking-wider text-charcoal hover:border-charcoal"
          >
            <span>Public Portfolio</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* Filter & Search Bar */}
      <section className="bg-white border border-warm-grey/60 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter projects by visibility">
          {(['all', 'published', 'draft', 'archived'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setVisibilityFilter(tab)}
              className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider border cursor-pointer transition-colors ${
                visibilityFilter === tab
                  ? 'bg-charcoal text-ivory border-charcoal'
                  : 'bg-white text-charcoal border-warm-grey/50 hover:border-charcoal'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-warm-grey-dark absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search projects"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, slug, or location..."
            className="w-full bg-ivory-light border border-warm-grey pl-9 pr-3 py-1.5 text-xs font-sans text-charcoal focus:outline-none focus:border-bronze"
          />
        </div>
      </section>

      {/* Projects List */}
      <section className="bg-white border border-warm-grey/60 divide-y divide-warm-grey/30">
        {filteredProjects.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="font-sans text-sm text-charcoal/80">
              No projects match the current filter.
            </p>
          </div>
        ) : (
          filteredProjects.map((project) => (
            <div
              key={project.slug}
              className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-24 h-16 bg-charcoal border border-warm-grey/40 overflow-hidden flex-shrink-0">
                  {project.heroImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={project.heroImage}
                      alt={project.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-warm-grey">
                      <FolderKanban className="w-5 h-5" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 border font-mono text-[10px] uppercase tracking-wider ${
                        VISIBILITY_BADGE[project.visibilityStatus]
                      }`}
                    >
                      {project.visibilityStatus}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-bronze">
                      {project.category}
                    </span>
                    <span className="px-2 py-0.5 border border-warm-grey/60 bg-ivory-light font-mono text-[10px] uppercase text-charcoal">
                      {project.lifecycle}
                    </span>
                    {project.isDemonstrationSpec && (
                      <span className="px-2 py-0.5 border border-amber-700/30 bg-amber-50 font-mono text-[10px] uppercase text-amber-900">
                        Demonstration Spec
                      </span>
                    )}
                  </div>
                  <h2 className="font-sans text-base font-semibold text-charcoal truncate">
                    {project.title}
                  </h2>
                  <p className="font-mono text-[11px] text-warm-grey-dark truncate">
                    /projects/{project.slug} · {project.location} · {project.galleryCount} images
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {project.visibilityStatus === 'published' && (
                  <Link
                    href={`/projects/${project.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 border border-warm-grey text-xs font-mono uppercase tracking-wider text-charcoal hover:border-charcoal"
                  >
                    View Live
                  </Link>
                )}
                {project.id ? (
                  <Link
                    href={`/admin/projects/${project.id}`}
                    className="px-3.5 py-1.5 bg-charcoal text-ivory hover:bg-bronze transition-colors text-xs font-mono uppercase tracking-wider"
                  >
                    Open Editor
                  </Link>
                ) : (
                  <span className="font-mono text-[10px] uppercase text-warm-grey-dark">
                    Pending Migration 011
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
