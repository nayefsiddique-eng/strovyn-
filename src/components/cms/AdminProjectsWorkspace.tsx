'use client';

import React from 'react';
import Link from 'next/link';
import { Camera, ExternalLink, FolderKanban } from 'lucide-react';
import type { AdminProjectListItem } from '@/lib/cms/projectsService';
import type { StaffViewerIdentity } from './StaffAuthGateCards';

export function AdminProjectsWorkspace({
  staff,
  projects,
}: {
  staff: StaffViewerIdentity;
  projects: AdminProjectListItem[];
}) {
  const canEditPhotos = staff.role === 'publisher' || staff.role === 'admin';

  return (
    <div className="space-y-6">
      <section className="bg-white border border-warm-grey/60 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-bronze block mb-1.5">
            PHASE B FOUNDATION · PORTFOLIO
          </span>
          <h1 className="type-section-title text-3xl text-charcoal">
            Projects &amp; Portfolio Inventory
          </h1>
          <p className="font-sans text-sm text-charcoal/75 mt-1">
            Unified view of established portfolio case studies and active Supabase photo overrides.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEditPhotos && (
            <Link
              href="/admin/photos"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-charcoal text-ivory hover:bg-bronze transition-colors font-mono text-xs uppercase tracking-wider"
            >
              <Camera className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Manage Project Photos</span>
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

      <section className="bg-white border border-warm-grey/60 divide-y divide-warm-grey/30">
        {projects.map((project) => (
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
                  <span className="font-mono text-[10px] uppercase tracking-wider text-bronze">
                    {project.category}
                  </span>
                  <span className="px-2 py-0.5 border border-warm-grey/60 bg-ivory-light font-mono text-[10px] uppercase text-charcoal">
                    {project.lifecycle}
                  </span>
                  {project.hasPhotoOverride && (
                    <span className="px-2 py-0.5 border border-emerald-800/30 bg-emerald-50 font-mono text-[10px] uppercase text-emerald-900">
                      DB Photo Override
                    </span>
                  )}
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
                  /projects/{project.slug} · {project.location} · {project.galleryCount} gallery images
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href={`/projects/${project.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 border border-warm-grey text-xs font-mono uppercase tracking-wider text-charcoal hover:border-charcoal"
              >
                View Live
              </Link>
              {canEditPhotos && (
                <Link
                  href="/admin/photos"
                  className="px-3 py-1.5 border border-charcoal text-xs font-mono uppercase tracking-wider text-charcoal hover:bg-charcoal hover:text-ivory transition-colors"
                >
                  Edit Photos
                </Link>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
