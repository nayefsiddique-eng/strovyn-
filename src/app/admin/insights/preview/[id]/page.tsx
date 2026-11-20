import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { getSecureArticlePreview } from '@/lib/cms/editorialService';
import { EditorialHttpError } from '@/lib/cms/http';
import { isApprovedPreviewImageUrl } from '@/lib/cms/mediaUrlPolicy';
import { requireStaffSession, StaffAuthError } from '@/lib/cms/staffAuth';
import { UuidParamSchema } from '@/lib/cms/validators';

export const instant = false;

export const metadata: Metadata = {
  title: 'Editorial Preview | STROVYN',
  description: 'Authenticated internal editorial preview.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
  },
};

function PreviewAccessDenied({ message }: { message: string }) {
  return (
    <main className="w-full min-h-screen bg-ivory text-charcoal flex items-center justify-center px-6 py-24">
      <div className="max-w-lg w-full border border-warm-grey/40 bg-white p-8">
        <span className="font-mono text-xs uppercase tracking-widest text-bronze block mb-3">
          STROVYN EDITORIAL PREVIEW
        </span>
        <h1 className="type-section-title text-2xl text-charcoal mb-3">
          Staff Authentication Required
        </h1>
        <p className="font-sans text-sm text-charcoal/75 leading-relaxed mb-6">
          {message}
        </p>
        <Link
          href="/insights"
          className="inline-block font-sans text-xs uppercase tracking-widest border border-charcoal px-4 py-2 hover:bg-charcoal hover:text-ivory transition-colors"
        >
          Return to Public Insights
        </Link>
      </div>
    </main>
  );
}

async function AuthenticatedPreviewContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;

  let staffEmail = '';
  let staffRole = '';
  try {
    const staff = await requireStaffSession({ action: 'article:read_unpublished' });
    staffEmail = staff.email;
    staffRole = staff.role;
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return <PreviewAccessDenied message={err.message} />;
    }
    return (
      <PreviewAccessDenied message="Unable to verify active editorial staff credentials." />
    );
  }

  const parsedId = UuidParamSchema.safeParse(id);
  if (!parsedId.success) {
    notFound();
  }

  let preview;
  try {
    preview = await getSecureArticlePreview(parsedId.data);
  } catch (err) {
    if (err instanceof EditorialHttpError && err.status === 404) {
      notFound();
    }
    return (
      <PreviewAccessDenied message="Editorial preview could not be loaded cleanly." />
    );
  }

  return (
    <main className="w-full min-h-screen bg-ivory text-charcoal">
      {/* Staff-only preview banner */}
      <div className="w-full bg-charcoal text-ivory border-b border-bronze/40 px-6 py-3 pt-24 sm:pt-28">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-2 py-0.5 bg-bronze text-ivory uppercase tracking-widest">
              INTERNAL PREVIEW — NOT PUBLICLY INDEXED
            </span>
            <span className="uppercase tracking-wider text-warm-grey">
              Status: <strong className="text-white">{preview.status}</strong>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={`/admin/insights/articles/${preview.id}`}
              className="text-ivory hover:text-bronze-light underline underline-offset-4 transition-colors"
            >
              &larr; Back to Editor
            </Link>
            <Link
              href="/admin/insights"
              className="text-warm-grey hover:text-ivory transition-colors"
            >
              Queue
            </Link>
            <span className="text-warm-grey">
              Viewing as {staffEmail} ({staffRole})
            </span>
          </div>
        </div>
      </div>

      {/* Article Header */}
      <section className="relative pt-20 pb-12 border-b border-warm-grey/30 px-6 sm:px-8 lg:px-12 max-w-4xl mx-auto">
        <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-4">
          [ {preview.category} &mdash; {preview.reading_time} min read ]
        </span>
        <h1 className="type-page-title text-3xl sm:text-4xl md:text-5xl text-charcoal mb-4">
          {preview.title}
        </h1>
        {preview.subtitle && (
          <p className="font-sans text-lg text-charcoal/75 mb-6">{preview.subtitle}</p>
        )}

        <div className="flex items-center gap-4 pt-6 border-t border-warm-grey/30 text-xs sm:text-sm text-warm-grey-dark">
          <div>
            <span className="font-sans font-medium text-charcoal block">
              {preview.author_name}
            </span>
            {preview.author_role && <span>{preview.author_role}</span>}
          </div>
          <span className="ml-auto font-mono">
            {preview.published_at
              ? new Date(preview.published_at).toLocaleDateString('en-AU', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : `Updated ${new Date(preview.updated_at).toLocaleDateString('en-AU')}`}
          </span>
        </div>
      </section>

      {/* Cover Image */}
      {preview.featured_image_url &&
        isApprovedPreviewImageUrl(preview.featured_image_url) && (
        <section className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 py-10">
          <div className="relative aspect-[16/9] bg-charcoal border border-warm-grey/30 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.featured_image_url}
              alt={preview.featured_image_alt || preview.title}
              className="w-full h-full object-cover"
            />
          </div>
        </section>
      )}

      {/* Sanitized Editorial Body */}
      <article className="max-w-3xl mx-auto px-6 sm:px-8 lg:px-12 py-12 font-sans text-base sm:text-lg text-charcoal/85 leading-relaxed">
        <p className="type-quote text-xl sm:text-2xl text-charcoal italic border-l-2 border-bronze pl-6 py-1 mb-8">
          &ldquo;{preview.excerpt}&rdquo;
        </p>

        <div
          className="space-y-6 [&_h2]:font-display [&_h2]:text-3xl [&_h2]:text-charcoal [&_h2]:mt-10 [&_h2]:mb-3 [&_h3]:font-display [&_h3]:text-2xl [&_h3]:text-charcoal [&_h3]:mt-8 [&_h3]:mb-2 [&_h4]:font-sans [&_h4]:font-semibold [&_h4]:text-lg [&_h4]:mt-6 [&_blockquote]:border-l-2 [&_blockquote]:border-bronze [&_blockquote]:pl-5 [&_blockquote]:italic [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-bronze [&_a]:underline [&_img]:max-w-full [&_img]:h-auto [&_img]:border [&_img]:border-warm-grey/30 [&_hr]:border-warm-grey/40 [&_hr]:my-8"
          dangerouslySetInnerHTML={{ __html: preview.sanitizedHtml }}
        />
      </article>
    </main>
  );
}

export default function EditorialPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="w-full min-h-screen bg-ivory text-charcoal flex items-center justify-center px-6 py-24 font-mono text-xs uppercase tracking-widest">
          Verifying Editorial Session...
        </main>
      }
    >
      <AuthenticatedPreviewContent params={params} />
    </Suspense>
  );
}
