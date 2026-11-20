import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { getEditorialArticleById } from '@/lib/cms/editorialService';
import type { EditorialArticleDetail } from '@/lib/cms/editorHelpers';
import { EditorialHttpError } from '@/lib/cms/http';
import {
  resolveAuthenticatedStaff,
  StaffAuthError,
} from '@/lib/cms/staffAuth';
import { sanitizeAdminRedirectPath } from '@/lib/cms/stage1Access';
import { UuidParamSchema } from '@/lib/cms/validators';
import { AdminArticleEditor } from '@/components/cms/AdminArticleEditor';
import {
  StaffAccessDeniedCard,
  StaffSignInCard,
} from '@/components/cms/StaffAuthGateCards';

export const instant = false;

export const metadata: Metadata = {
  title: 'Article Workspace | STROVYN Editorial Desk',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
  },
};

async function AuthenticatedArticleEditorContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;

  const safeRedirect = sanitizeAdminRedirectPath(`/admin/insights/articles/${id}`);

  let staff: Awaited<ReturnType<typeof resolveAuthenticatedStaff>> | null = null;
  let deniedError: { code: string; status: number; message: string } | null = null;
  let isUnauthenticated = false;

  try {
    staff = await resolveAuthenticatedStaff();
  } catch (err) {
    if (err instanceof StaffAuthError) {
      if (err.code === 'UNAUTHENTICATED') {
        isUnauthenticated = true;
      } else {
        deniedError = { code: err.code, status: err.status, message: err.message };
      }
    } else {
      deniedError = {
        code: 'AUTH_SERVICE_UNAVAILABLE',
        status: 503,
        message: 'Unable to verify staff authentication session.',
      };
    }
  }

  if (isUnauthenticated) {
    return <StaffSignInCard redirectTo={safeRedirect} />;
  }

  if (deniedError || !staff) {
    return (
      <StaffAccessDeniedCard
        code={deniedError?.code || 'AUTH_SERVICE_UNAVAILABLE'}
        status={deniedError?.status || 503}
        message={deniedError?.message || 'Unable to verify staff authentication session.'}
      />
    );
  }

  const parsedId = UuidParamSchema.safeParse(id);
  if (!parsedId.success) {
    notFound();
  }

  let article: EditorialArticleDetail | null = null;
  let articleLoadError: string | null = null;
  let isNotFound = false;

  try {
    article = (await getEditorialArticleById(
      staff,
      parsedId.data
    )) as EditorialArticleDetail;
  } catch (err) {
    if (err instanceof EditorialHttpError && err.status === 404) {
      isNotFound = true;
    } else {
      articleLoadError = 'Editorial article workspace could not be loaded cleanly.';
    }
  }

  if (isNotFound) {
    notFound();
  }

  if (articleLoadError || !article) {
    return (
      <StaffAccessDeniedCard
        code="STAFF_LOOKUP_FAILED"
        status={503}
        message={articleLoadError || 'Editorial article workspace could not be loaded cleanly.'}
      />
    );
  }

  return (
    <AdminArticleEditor
      initialStaff={{
        id: staff.id,
        email: staff.email,
        full_name: staff.full_name,
        role: staff.role,
      }}
      initialArticle={article}
    />
  );
}

export default function AdminArticleWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="w-full min-h-screen bg-ivory text-charcoal pt-28 pb-24 px-6">
          <div className="max-w-7xl mx-auto font-mono text-xs uppercase tracking-widest text-warm-grey-dark">
            Loading article workspace...
          </div>
        </main>
      }
    >
      <AuthenticatedArticleEditorContent params={params} />
    </Suspense>
  );
}
