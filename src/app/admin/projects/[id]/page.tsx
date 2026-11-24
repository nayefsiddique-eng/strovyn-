import React, { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { resolveAdminPageGate } from '@/lib/cms/adminServerGate';
import { EditorialHttpError } from '@/lib/cms/http';
import { getProjectByIdForAdmin } from '@/lib/cms/projectsService';
import { UuidParamSchema } from '@/lib/cms/validators';
import { AdminWorkspaceShell } from '@/components/cms/AdminWorkspaceShell';
import { AdminProjectEditor } from '@/components/cms/AdminProjectEditor';
import {
  StaffAccessDeniedCard,
  StaffSignInCard,
} from '@/components/cms/StaffAuthGateCards';

async function AdminProjectEditorContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;

  const gate = await resolveAdminPageGate();
  if (gate.status === 'unauthenticated') {
    return <StaffSignInCard redirectTo={`/admin/projects/${id}`} />;
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

  let project;
  try {
    project = await getProjectByIdForAdmin(gate.staff, parsedId.data);
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
    <AdminWorkspaceShell staff={viewerIdentity} activeModule="projects">
      <AdminProjectEditor initialStaff={viewerIdentity} initialProject={project} />
    </AdminWorkspaceShell>
  );
}

export default function AdminProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="w-full min-h-screen bg-ivory text-charcoal flex items-center justify-center px-6 py-24 font-mono text-xs uppercase tracking-widest">
          Loading Project Editor...
        </main>
      }
    >
      <AdminProjectEditorContent params={params} />
    </Suspense>
  );
}
