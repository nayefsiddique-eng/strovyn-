import React, { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { resolveAdminPageGate } from '@/lib/cms/adminServerGate';
import { getVacancyByIdForAdmin } from '@/lib/cms/careersService';
import { EditorialHttpError } from '@/lib/cms/http';
import { UuidParamSchema } from '@/lib/cms/validators';
import { AdminWorkspaceShell } from '@/components/cms/AdminWorkspaceShell';
import { AdminVacancyEditor } from '@/components/cms/AdminVacancyEditor';
import {
  StaffAccessDeniedCard,
  StaffSignInCard,
} from '@/components/cms/StaffAuthGateCards';

export const instant = false;

type PageProps = {
  params: Promise<{ id: string }>;
};

async function AdminVacancyDetailContent({ params }: PageProps) {
  await connection();
  const { id } = await params;

  const gate = await resolveAdminPageGate();
  if (gate.status === 'unauthenticated') {
    return <StaffSignInCard redirectTo={`/admin/careers/${id}`} />;
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

  const parsedId = UuidParamSchema.safeParse(id);
  if (!parsedId.success) {
    notFound();
  }

  let vacancy;
  try {
    vacancy = await getVacancyByIdForAdmin(gate.staff, parsedId.data);
  } catch (err) {
    if (err instanceof EditorialHttpError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  const viewerIdentity = {
    id: gate.staff.id,
    email: gate.staff.email,
    full_name: gate.staff.full_name,
    role: gate.staff.role,
  };

  return (
    <AdminWorkspaceShell staff={viewerIdentity} activeModule="careers">
      <AdminVacancyEditor staff={viewerIdentity} initialVacancy={vacancy} />
    </AdminWorkspaceShell>
  );
}

export default function AdminVacancyDetailPage(props: PageProps) {
  return (
    <Suspense
      fallback={
        <main className="w-full min-h-screen bg-ivory text-charcoal flex items-center justify-center px-6 py-24 font-mono text-xs uppercase tracking-widest">
          Loading Vacancy Editor...
        </main>
      }
    >
      <AdminVacancyDetailContent {...props} />
    </Suspense>
  );
}
