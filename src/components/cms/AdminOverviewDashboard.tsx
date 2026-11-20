'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { ADMIN_NAVIGATION_ITEMS, type AdminModuleId } from '@/lib/cms/adminNavigation';
import type { AdminOverviewSnapshot } from '@/lib/cms/adminOverviewService';
import type { StaffViewerIdentity } from './StaffAuthGateCards';

export function AdminOverviewDashboard({
  staff,
  snapshot,
  selectedPlannedModule,
}: {
  staff: StaffViewerIdentity;
  snapshot: AdminOverviewSnapshot;
  selectedPlannedModule?: string | null;
}) {
  const plannedItem = selectedPlannedModule
    ? ADMIN_NAVIGATION_ITEMS.find(
        (item) => item.id === (selectedPlannedModule as AdminModuleId) && item.status === 'planned'
      )
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-white border border-warm-grey/60 p-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-bronze block mb-2">
          OPERATIONAL OVERVIEW
        </span>
        <h1 className="type-section-title text-3xl text-charcoal mb-2">
          Strovyn Website Operations
        </h1>
        <p className="font-sans text-sm text-charcoal/75 leading-relaxed">
          Live operational counts, pending editorial reviews, and staged business CMS modules.
        </p>
      </section>

      {/* Planned Module Notice when user selects Phase C–F nav entry */}
      {plannedItem && (
        <section
          role="region"
          aria-label="Planned CMS module roadmap notice"
          className="bg-white border-2 border-bronze/60 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-bronze block">
              {plannedItem.phaseLabel} · Scheduled Module
            </span>
            <h2 className="font-sans text-base font-semibold text-charcoal">
              {plannedItem.label} Workspace
            </h2>
            <p className="font-sans text-xs text-charcoal/75">{plannedItem.description}</p>
          </div>
          <Link
            href="/admin"
            className="px-3.5 py-2 border border-charcoal text-xs font-mono uppercase tracking-wider text-charcoal hover:bg-charcoal hover:text-ivory transition-colors flex-shrink-0"
          >
            Back to Overview
          </Link>
        </section>
      )}

      {/* Primary Operational Counters (Real DB Queries Only) */}
      <section aria-label="Operational counts" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="bg-white border border-warm-grey/60 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-bronze">
              Editorial Articles
            </span>
            <Link href="/admin/insights" className="font-mono text-[10px] text-charcoal hover:text-bronze underline">
              Open Queue
            </Link>
          </div>
          <p className="font-display text-3xl text-charcoal">{snapshot.articles.total}</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono text-warm-grey-dark border-t border-warm-grey/30 pt-3">
            <div>Published: <strong className="text-charcoal">{snapshot.articles.published}</strong></div>
            <div>In Review: <strong className="text-charcoal">{snapshot.articles.review}</strong></div>
            <div>Approved: <strong className="text-charcoal">{snapshot.articles.approved}</strong></div>
            <div>Drafts: <strong className="text-charcoal">{snapshot.articles.draft}</strong></div>
          </dl>
        </div>

        <div className="bg-white border border-warm-grey/60 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-bronze">
              Projects Portfolio
            </span>
            <Link href="/admin/projects" className="font-mono text-[10px] text-charcoal hover:text-bronze underline">
              Open Projects
            </Link>
          </div>
          <p className="font-display text-3xl text-charcoal">{snapshot.projects.catalogCount}</p>
          <dl className="space-y-1 text-xs font-mono text-warm-grey-dark border-t border-warm-grey/30 pt-3">
            <div>Photo Overrides: <strong className="text-charcoal">{snapshot.projects.overridesCount}</strong></div>
            <div>DB Project Records: <strong className="text-charcoal">{snapshot.projects.dbProjectsCount}</strong></div>
          </dl>
        </div>

        {snapshot.submissions ? (
          <div className="bg-white border border-warm-grey/60 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-bronze">
                Pending Submissions
              </span>
              <span className="font-mono text-[10px] text-warm-grey-dark">
                {staff.role.toUpperCase()}
              </span>
            </div>
            <p className="font-display text-3xl text-charcoal">
              {snapshot.submissions.pendingQuotes +
                snapshot.submissions.pendingApplications +
                snapshot.submissions.pendingFeedback}
            </p>
            <dl className="space-y-1 text-xs font-mono text-warm-grey-dark border-t border-warm-grey/30 pt-3">
              <div>Quotes Pending: <strong className="text-charcoal">{snapshot.submissions.pendingQuotes}</strong> / {snapshot.submissions.totalQuotes}</div>
              <div>Applications Pending: <strong className="text-charcoal">{snapshot.submissions.pendingApplications}</strong> / {snapshot.submissions.totalApplications}</div>
              <div>Feedback Pending: <strong className="text-charcoal">{snapshot.submissions.pendingFeedback}</strong> / {snapshot.submissions.totalFeedback}</div>
            </dl>
          </div>
        ) : (
          <div className="bg-white border border-warm-grey/60 p-5 space-y-3">
            <span className="font-mono text-[10px] uppercase tracking-wider text-bronze block">
              Editorial Scope
            </span>
            <p className="font-sans text-sm text-charcoal/80 leading-relaxed">
              Your role ({staff.role}) is scoped to editorial drafting, preview, and review submissions.
            </p>
          </div>
        )}
      </section>

      {/* Pending Action Queue */}
      <section className="bg-white border border-warm-grey/60 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-warm-grey/40 pb-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-bronze">
            Pending Operational Actions
          </h2>
          <span className="font-mono text-[10px] text-warm-grey-dark">
            Updated {new Date(snapshot.generatedAt).toLocaleTimeString('en-AU')}
          </span>
        </div>

        {snapshot.pendingActions.length === 0 ? (
          <div className="flex items-center gap-2.5 py-4 text-xs font-sans text-emerald-900">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>No pending reviews, drafts, or unreviewed submissions require action.</span>
          </div>
        ) : (
          <div className="divide-y divide-warm-grey/30">
            {snapshot.pendingActions.map((action) => (
              <div
                key={action.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Clock
                      className={`w-3.5 h-3.5 ${
                        action.priority === 'high' ? 'text-bronze' : 'text-warm-grey-dark'
                      }`}
                      aria-hidden="true"
                    />
                    <h3 className="font-sans text-sm font-semibold text-charcoal">
                      {action.title}
                    </h3>
                    <span className="px-2 py-0.5 bg-ivory-light border border-warm-grey/60 font-mono text-[10px] text-charcoal">
                      {action.count}
                    </span>
                  </div>
                  <p className="font-sans text-xs text-charcoal/75 pl-5">{action.detail}</p>
                </div>

                <Link
                  href={action.href}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-charcoal text-xs font-mono uppercase tracking-wider text-charcoal hover:bg-charcoal hover:text-ivory transition-colors self-start sm:self-center flex-shrink-0"
                >
                  <span>{action.ctaLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
