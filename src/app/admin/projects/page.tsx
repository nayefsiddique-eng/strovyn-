import React, { Suspense } from 'react';
import { connection } from 'next/server';
import { resolveAdminPageGate } from '@/lib/cms/adminServerGate';
import { listProjectsForAdmin } from '@/lib/cms/projectsService';
import { AdminWorkspaceShell } from '@/components/cms/AdminWorkspaceShell';
import { AdminProjectsWorkspace } from '@/components/cms/AdminProjectsWorkspace';
import {
  StaffAccessDeniedCard,
  StaffSignInCard,
} from '@/components/cms/StaffAuthGateCards';

async function AdminProjectsContent() {
  await connection();
  const gate = await resolveAdminPageGate();
  if (gate.status === 'unauthenticated') {
    return <StaffSignInCard redirectTo="/admin/projects" />;
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

  const projects = await listProjectsForAdmin(gate.staff);
  const viewerIdentity = {
    id: gate.staff.id,
    email: gate.staff.email,
    full_name: gate.staff.full_name,
    role: gate.staff.role,
  };

  return (
    <AdminWorkspaceShell staff={viewerIdentity} activeModule="projects">
      <AdminProjectsWorkspace staff={viewerIdentity} projects={projects} />
    </AdminWorkspaceShell>
  );
}

export default function AdminProjectsPage() {
  return (
    <Suspense
      fallback={
        <main className="w-full min-h-screen bg-ivory text-charcoal flex items-center justify-center px-6 py-24 font-mono text-xs uppercase tracking-widest">
          Loading Portfolio Workspace...
        </main>
      }
    >
      <AdminProjectsContent />
    </Suspense>
  );
}
