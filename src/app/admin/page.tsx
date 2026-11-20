import React, { Suspense } from 'react';
import { connection } from 'next/server';
import { resolveAdminPageGate } from '@/lib/cms/adminServerGate';
import { getAdminOverviewSnapshot } from '@/lib/cms/adminOverviewService';
import { AdminWorkspaceShell } from '@/components/cms/AdminWorkspaceShell';
import { AdminOverviewDashboard } from '@/components/cms/AdminOverviewDashboard';
import {
  StaffAccessDeniedCard,
  StaffSignInCard,
} from '@/components/cms/StaffAuthGateCards';

export const instant = false;

async function AdminOverviewContent({
  searchParams,
}: {
  searchParams: Promise<{ module?: string | string[] }>;
}) {
  await connection();
  const resolved = await searchParams;
  const rawModule = Array.isArray(resolved.module) ? resolved.module[0] : resolved.module;

  const gate = await resolveAdminPageGate();
  if (gate.status === 'unauthenticated') {
    return <StaffSignInCard redirectTo="/admin" />;
  }
  if (gate.status === 'denied') {
    return (
      <StaffAccessDeniedCard
        code={gate.code}
        status={gate.httpStatus}
        message={gate.message}
      />
    );
  }

  const snapshot = await getAdminOverviewSnapshot(gate.staff);
  const viewerIdentity = {
    id: gate.staff.id,
    email: gate.staff.email,
    full_name: gate.staff.full_name,
    role: gate.staff.role,
  };

  return (
    <AdminWorkspaceShell staff={viewerIdentity} activeModule="overview">
      <AdminOverviewDashboard
        staff={viewerIdentity}
        snapshot={snapshot}
        selectedPlannedModule={rawModule}
      />
    </AdminWorkspaceShell>
  );
}

export default function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string | string[] }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="w-full min-h-screen bg-ivory text-charcoal flex items-center justify-center px-6 py-24 font-mono text-xs uppercase tracking-widest">
          Loading Business CMS Overview...
        </main>
      }
    >
      <AdminOverviewContent searchParams={searchParams} />
    </Suspense>
  );
}
