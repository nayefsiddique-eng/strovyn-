import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { ArrowLeft, Eye, Lock, ShieldCheck } from 'lucide-react';
import { getEditorialArticleById } from '@/lib/cms/editorialService';
import { EditorialHttpError } from '@/lib/cms/http';
import {
  resolveAuthenticatedStaff,
  StaffAuthError,
} from '@/lib/cms/staffAuth';
import {
  describeStaffRole,
  formatStatusLabel,
  getRoleQueueActionModel,
  sanitizeAdminRedirectPath,
} from '@/lib/cms/stage1Access';
import { UuidParamSchema } from '@/lib/cms/validators';
import {
  StaffAccessDeniedCard,
  StaffSignInCard,
} from '@/components/cms/StaffAuthGateCards';

export const instant = false;

export const metadata: Metadata = {
  title: 'Article Brief | STROVYN Editorial Desk',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
  },
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Not set';
  try {
    return new Date(iso).toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

async function Stage1ArticleShellContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;

  const safeRedirect = sanitizeAdminRedirectPath(`/admin/insights/articles/${id}`);

  let staff;
  try {
    staff = await resolveAuthenticatedStaff();
  } catch (err) {
    if (err instanceof StaffAuthError) {
      if (err.code === 'UNAUTHENTICATED') {
        return <StaffSignInCard redirectTo={safeRedirect} />;
      }
      return (
        <StaffAccessDeniedCard
          code={err.code}
          status={err.status}
          message={err.message}
        />
      );
    }

    return (
      <StaffAccessDeniedCard
        code="AUTH_SERVICE_UNAVAILABLE"
        status={503}
        message="Unable to verify staff authentication session."
      />
    );
  }

  const parsedId = UuidParamSchema.safeParse(id);
  if (!parsedId.success) {
    notFound();
  }

  let article;
  try {
    article = await getEditorialArticleById(staff, parsedId.data);
  } catch (err) {
    if (err instanceof EditorialHttpError && err.status === 404) {
      notFound();
    }
    return (
      <StaffAccessDeniedCard
        code="STAFF_LOOKUP_FAILED"
        status={503}
        message="Editorial brief could not be loaded cleanly."
      />
    );
  }

  const status = article.status ?? 'draft';
  const roleMeta = describeStaffRole(staff.role);
  const actions = getRoleQueueActionModel(staff.role, status);

  return (
    <main className="w-full min-h-screen bg-ivory text-charcoal pt-28 pb-24 px-4 sm:px-6 lg:px-10">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation Bar */}
        <nav aria-label="Editorial workspace navigation" className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/admin/insights"
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-charcoal hover:text-bronze transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to Editorial Queue</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-warm-grey/60 font-mono text-[11px] uppercase tracking-wider text-charcoal">
              <ShieldCheck className="w-3.5 h-3.5 text-bronze" aria-hidden="true" />
              {staff.full_name} &middot; {roleMeta.label}
            </span>
            {actions.canOpenPreview && article.id && (
              <Link
                href={`/admin/insights/preview/${article.id}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-charcoal text-ivory hover:bg-bronze transition-colors font-mono text-xs uppercase tracking-wider"
              >
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Open Internal Preview</span>
              </Link>
            )}
          </div>
        </nav>

        {/* Stage 1 Read-Only Article Brief Card */}
        <article className="bg-white border border-warm-grey/60 p-6 sm:p-10 space-y-8">
          <header className="border-b border-warm-grey/40 pb-6 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-bronze">
                {article.category}
              </span>
              <span className="px-2.5 py-0.5 border border-warm-grey bg-ivory-light font-mono text-[11px] uppercase tracking-wider text-charcoal">
                {formatStatusLabel(status)}
              </span>
              {!actions.isEditableByRole && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 border border-warm-grey/70 bg-ivory font-mono text-[11px] text-warm-grey-dark">
                  <Lock className="w-3 h-3" aria-hidden="true" />
                  <span>{actions.lockNotice}</span>
                </span>
              )}
            </div>

            <h1 className="type-page-title text-3xl sm:text-4xl text-charcoal">
              {article.title}
            </h1>
            {article.subtitle && (
              <p className="font-sans text-base text-charcoal/75">{article.subtitle}</p>
            )}
            <p className="font-mono text-xs text-warm-grey-dark break-all">
              /insights/{article.slug}
            </p>
          </header>

          {/* Metadata Grid */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 border-b border-warm-grey/40 pb-6 text-sm">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
                Author
              </dt>
              <dd className="font-sans text-charcoal font-medium">
                {article.author_name}
              </dd>
              {article.author_role && (
                <dd className="font-sans text-xs text-warm-grey-dark">
                  {article.author_role}
                </dd>
              )}
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
                Last Updated
              </dt>
              <dd className="font-mono text-xs text-charcoal">
                {formatDateTime(article.updated_at)}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
                Published At
              </dt>
              <dd className="font-mono text-xs text-charcoal">
                {formatDateTime(article.published_at)}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark mb-1">
                Estimated Read
              </dt>
              <dd className="font-mono text-xs text-charcoal">
                {article.reading_time ?? 5} min
              </dd>
            </div>
          </dl>

          {/* Summary & SEO */}
          <div className="space-y-4">
            <div>
              <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-warm-grey-dark mb-2">
                Excerpt
              </h2>
              <p className="font-sans text-sm text-charcoal/85 leading-relaxed">
                {article.excerpt}
              </p>
            </div>

            {(article.seo_title || article.seo_description) && (
              <div className="bg-ivory-light border border-warm-grey/40 p-4 space-y-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-bronze block">
                  SEO Metadata
                </span>
                {article.seo_title && (
                  <p className="font-sans text-xs text-charcoal">
                    <strong>Title:</strong> {article.seo_title}
                  </p>
                )}
                {article.seo_description && (
                  <p className="font-sans text-xs text-charcoal/80">
                    <strong>Description:</strong> {article.seo_description}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Role Capabilities Summary & Stage 2–3 Shell Notice */}
          <footer className="border-t border-warm-grey/40 pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-ivory-light/70 p-5 border">
            <div className="space-y-1">
              <p className="font-mono text-[11px] uppercase tracking-wider text-bronze">
                Stage 1 Read-Only Article Shell
              </p>
              <p className="font-sans text-xs text-charcoal/80">
                {actions.isEditableByRole
                  ? `Your '${staff.role}' role is permitted to edit '${status}' articles once Tiptap authoring and media controls unlock in Stage 2.`
                  : `Your '${staff.role}' role has read-only access to '${status}' articles under editorial RBAC.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {actions.permittedTransitions.length > 0 ? (
                actions.permittedTransitions.map((tr) => (
                  <span
                    key={tr.toStatus}
                    className="px-2.5 py-1 border border-warm-grey bg-white font-mono text-[10px] uppercase tracking-wider text-charcoal"
                  >
                    Stage 3: {tr.label}
                  </span>
                ))
              ) : (
                <span className="px-2.5 py-1 border border-warm-grey/60 bg-white font-mono text-[10px] uppercase tracking-wider text-warm-grey-dark">
                  No transitions for {staff.role}
                </span>
              )}
            </div>
          </footer>
        </article>
      </div>
    </main>
  );
}

export default function AdminArticleShellPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="w-full min-h-screen bg-ivory text-charcoal pt-28 pb-24 px-6">
          <div className="max-w-5xl mx-auto font-mono text-xs uppercase tracking-widest text-warm-grey-dark">
            Loading article brief...
          </div>
        </main>
      }
    >
      <Stage1ArticleShellContent params={params} />
    </Suspense>
  );
}
