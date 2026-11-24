import React, { Suspense } from 'react';
import { connection } from 'next/server';
import { resolveAdminPageGate } from '@/lib/cms/adminServerGate';
import { AdminWorkspaceShell } from '@/components/cms/AdminWorkspaceShell';
import { NewVacancyForm } from '@/components/cms/NewVacancyForm';
import {
  StaffAccessDeniedCard,
  StaffSignInCard,
} from '@/components/cms/StaffAuthGateCards';

async function AdminNewVacancyContent() {
  await connection();
  const gate = await resolveAdminPageGate();
  if (gate.status === 'unauthenticated') {
    return <StaffSignInCard redirectTo="/admin/careers/new" />;
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

  const viewerIdentity = {
    id: gate.staff.id,
    email: gate.staff.email,
    full_name: gate.staff.full_name,
    role: gate.staff.role,
  };

  return (
    <AdminWorkspaceShell staff={viewerIdentity} activeModule="careers">
      <NewVacancyForm />
    </AdminWorkspaceShell>
  );
}

export default function AdminNewVacancyPage() {
  return (
    <Suspense
      fallback={
        <main className="w-full min-h-screen bg-ivory text-charcoal flex items-center justify-center px-6 py-24 font-mono text-xs uppercase tracking-widest">
          Loading New Vacancy Form...
        </main>
      }
    >
      <AdminNewVacancyContent />
    </Suspense>
  );
}
