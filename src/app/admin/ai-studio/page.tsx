import React, { Suspense } from 'react';
import { connection } from 'next/server';
import { resolveAdminPageGate } from '@/lib/cms/adminServerGate';
import {
  getAiProviderStatus,
  getAiUsageSnapshot,
} from '@/lib/cms/aiStudioProvider';
import { listEditorialArticles } from '@/lib/cms/editorialService';
import { listProjectsForAdmin } from '@/lib/cms/projectsService';
import { AdminAiStudioWorkspace } from '@/components/cms/AdminAiStudioWorkspace';
import { AdminWorkspaceShell } from '@/components/cms/AdminWorkspaceShell';
import {
  StaffAccessDeniedCard,
  StaffSignInCard,
} from '@/components/cms/StaffAuthGateCards';

async function AdminAiStudioContent() {
  await connection();
  const gate = await resolveAdminPageGate('ai_studio:use');
  if (gate.status === 'unauthenticated') {
    return <StaffSignInCard redirectTo="/admin/ai-studio" />;
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

  const [projects, articlesResult] = await Promise.all([
    listProjectsForAdmin(gate.staff),
    listEditorialArticles(gate.staff, { page: 1, pageSize: 20 }),
  ]);

  const viewerIdentity = {
    id: gate.staff.id,
    email: gate.staff.email,
    full_name: gate.staff.full_name,
    role: gate.staff.role,
  };

  return (
    <AdminWorkspaceShell staff={viewerIdentity} activeModule="ai-content-studio">
      <AdminAiStudioWorkspace
        staff={viewerIdentity}
        initialProjects={projects}
        initialArticles={articlesResult.items}
        initialProviderStatus={getAiProviderStatus()}
        initialUsage={getAiUsageSnapshot(gate.staff.id)}
      />
    </AdminWorkspaceShell>
  );
}

export default function AdminAiStudioPage() {
  return (
    <Suspense
      fallback={
        <main className="w-full min-h-screen bg-ivory text-charcoal flex items-center justify-center px-6 py-24 font-mono text-xs uppercase tracking-widest">
          Loading AI Content Studio...
        </main>
      }
    >
      <AdminAiStudioContent />
    </Suspense>
  );
}
