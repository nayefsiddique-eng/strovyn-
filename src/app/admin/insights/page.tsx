import React, { Suspense } from 'react';
import { connection } from 'next/server';
import {
  resolveAuthenticatedStaff,
  StaffAuthError,
} from '@/lib/cms/staffAuth';
import { sanitizeAdminRedirectPath } from '@/lib/cms/stage1Access';
import { AdminInsightsQueue } from '@/components/cms/AdminInsightsQueue';
import {
  StaffAccessDeniedCard,
  StaffSignInCard,
} from '@/components/cms/StaffAuthGateCards';

export const instant = false;

async function AuthenticatedInsightsGate({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  await connection();
  const resolvedParams = await searchParams;
  const rawNext = Array.isArray(resolvedParams.next)
    ? resolvedParams.next[0]
    : resolvedParams.next;
  const safeRedirect = sanitizeAdminRedirectPath(rawNext, '/admin/insights');

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
        deniedError = {
          code: err.code,
          status: err.status,
          message: err.message,
        };
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

  return (
    <AdminInsightsQueue
      initialStaff={{
        id: staff.id,
        email: staff.email,
        full_name: staff.full_name,
        role: staff.role,
      }}
    />
  );
}

export default function AdminInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="w-full min-h-screen bg-ivory text-charcoal pt-28 pb-24 px-6">
          <div className="max-w-7xl mx-auto font-mono text-xs uppercase tracking-widest text-warm-grey-dark">
            Verifying editorial credentials...
          </div>
        </main>
      }
    >
      <AuthenticatedInsightsGate searchParams={searchParams} />
    </Suspense>
  );
}
