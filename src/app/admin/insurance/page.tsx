import React, { Suspense } from 'react';
import { connection } from 'next/server';
import { resolveAdminPageGate } from '@/lib/cms/adminServerGate';
import { getAdminInsuranceWorkspaceSnapshot } from '@/lib/cms/insuranceService';
import { AdminWorkspaceShell } from '@/components/cms/AdminWorkspaceShell';
import { AdminInsuranceWorkspace } from '@/components/cms/AdminInsuranceWorkspace';
import {
  StaffAccessDeniedCard,
  StaffSignInCard,
} from '@/components/cms/StaffAuthGateCards';

async function AdminInsuranceContent() {
  await connection();
  const gate = await resolveAdminPageGate('insurance:read');

  if (gate.status === 'unauthenticated') {
    return <StaffSignInCard redirectTo="/admin/insurance" />;
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

  const snapshot = await getAdminInsuranceWorkspaceSnapshot(gate.staff);
  const viewerIdentity = {
    id: gate.staff.id,
    email: gate.staff.email,
    full_name: gate.staff.full_name,
    role: gate.staff.role,
  };

  return (
    <AdminWorkspaceShell staff={viewerIdentity} activeModule="insurance">
      <AdminInsuranceWorkspace initialSnapshot={snapshot} />
    </AdminWorkspaceShell>
  );
}

export default function AdminInsurancePage() {
  return (
    <Suspense
      fallback={
        <main className="w-full min-h-screen bg-ivory text-charcoal flex items-center justify-center px-6 py-24 font-mono text-xs uppercase tracking-widest">
          Loading Insurance &amp; Enquiries Workspace...
        </main>
      }
    >
      <AdminInsuranceContent />
    </Suspense>
  );
}
