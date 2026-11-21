import React, { Suspense } from 'react';
import { connection } from 'next/server';
import { resolveAdminPageGate } from '@/lib/cms/adminServerGate';
import { listVacanciesForAdmin } from '@/lib/cms/careersService';
import { AdminWorkspaceShell } from '@/components/cms/AdminWorkspaceShell';
import { AdminCareersWorkspace } from '@/components/cms/AdminCareersWorkspace';
import {
  StaffAccessDeniedCard,
  StaffSignInCard,
} from '@/components/cms/StaffAuthGateCards';

export const instant = false;

async function AdminCareersContent() {
  await connection();
  const gate = await resolveAdminPageGate();
  if (gate.status === 'unauthenticated') {
    return <StaffSignInCard redirectTo="/admin/careers" />;
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

  const vacancies = await listVacanciesForAdmin(gate.staff);
  const viewerIdentity = {
    id: gate.staff.id,
    email: gate.staff.email,
    full_name: gate.staff.full_name,
    role: gate.staff.role,
  };

  return (
    <AdminWorkspaceShell staff={viewerIdentity} activeModule="careers">
      <AdminCareersWorkspace staff={viewerIdentity} initialVacancies={vacancies} />
    </AdminWorkspaceShell>
  );
}

export default function AdminCareersPage() {
  return (
    <Suspense
      fallback={
        <main className="w-full min-h-screen bg-ivory text-charcoal flex items-center justify-center px-6 py-24 font-mono text-xs uppercase tracking-widest">
          Loading Careers Workspace...
        </main>
      }
    >
      <AdminCareersContent />
    </Suspense>
  );
}
