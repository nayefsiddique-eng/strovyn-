import React, { Suspense } from 'react';
import { connection } from 'next/server';
import { resolveAdminPageGate } from '@/lib/cms/adminServerGate';
import { listCustomerFeedbackForAdmin } from '@/lib/cms/submissionsService';
import { AdminSubmissionsWorkspace } from '@/components/cms/AdminSubmissionsWorkspace';
import { AdminWorkspaceShell } from '@/components/cms/AdminWorkspaceShell';
import {
  StaffAccessDeniedCard,
  StaffSignInCard,
} from '@/components/cms/StaffAuthGateCards';

async function AdminFeedbackContent() {
  await connection();
  const gate = await resolveAdminPageGate('submission:read');
  if (gate.status === 'unauthenticated') {
    return <StaffSignInCard redirectTo="/admin/feedback" />;
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

  const pageData = await listCustomerFeedbackForAdmin(gate.staff, {
    page: 1,
    pageSize: 20,
  });
  const viewerIdentity = {
    id: gate.staff.id,
    email: gate.staff.email,
    full_name: gate.staff.full_name,
    role: gate.staff.role,
  };

  return (
    <AdminWorkspaceShell
      staff={viewerIdentity}
      activeModule="customer-feedback"
    >
      <AdminSubmissionsWorkspace mode="feedback" initialPageData={pageData} />
    </AdminWorkspaceShell>
  );
}

export default function AdminFeedbackPage() {
  return (
    <Suspense
      fallback={
        <main className="w-full min-h-screen bg-ivory text-charcoal flex items-center justify-center px-6 py-24 font-mono text-xs uppercase tracking-widest">
          Loading Customer Feedback Workspace...
        </main>
      }
    >
      <AdminFeedbackContent />
    </Suspense>
  );
}
