import React, { Suspense } from 'react';
import { connection } from 'next/server';
import { resolveAdminPageGate } from '@/lib/cms/adminServerGate';
import { listStaffDirectory } from '@/lib/cms/staffManagementService';
import { AdminWorkspaceShell } from '@/components/cms/AdminWorkspaceShell';
import { AdminStaffWorkspace } from '@/components/cms/AdminStaffWorkspace';
import {
  StaffAccessDeniedCard,
  StaffSignInCard,
} from '@/components/cms/StaffAuthGateCards';

export const instant = false;

async function AdminStaffContent() {
  await connection();
  const gate = await resolveAdminPageGate('staff:manage');
  if (gate.status === 'unauthenticated') {
    return <StaffSignInCard redirectTo="/admin/staff" />;
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

  const snapshot = await listStaffDirectory(gate.staff);
  const viewerIdentity = {
    id: gate.staff.id,
    email: gate.staff.email,
    full_name: gate.staff.full_name,
    role: gate.staff.role,
  };

  return (
    <AdminWorkspaceShell staff={viewerIdentity} activeModule="staff">
      <AdminStaffWorkspace
        initialSnapshot={snapshot}
        currentAdminId={gate.staff.id}
      />
    </AdminWorkspaceShell>
  );
}

export default function AdminStaffPage() {
  return (
    <Suspense
      fallback={
        <main className="w-full min-h-screen bg-ivory text-charcoal flex items-center justify-center px-6 py-24 font-mono text-xs uppercase tracking-widest">
          Loading Staff &amp; Onboarding Directory...
        </main>
      }
    >
      <AdminStaffContent />
    </Suspense>
  );
}
