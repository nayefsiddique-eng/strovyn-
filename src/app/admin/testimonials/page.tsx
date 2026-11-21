import React, { Suspense } from 'react';
import { connection } from 'next/server';
import { resolveAdminPageGate } from '@/lib/cms/adminServerGate';
import { listTestimonialsForAdmin } from '@/lib/cms/testimonialsService';
import { AdminWorkspaceShell } from '@/components/cms/AdminWorkspaceShell';
import { AdminTestimonialsWorkspace } from '@/components/cms/AdminTestimonialsWorkspace';
import {
  StaffAccessDeniedCard,
  StaffSignInCard,
} from '@/components/cms/StaffAuthGateCards';

export const instant = false;

async function AdminTestimonialsContent() {
  await connection();
  const gate = await resolveAdminPageGate();
  if (gate.status === 'unauthenticated') {
    return <StaffSignInCard redirectTo="/admin/testimonials" />;
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

  const testimonials = await listTestimonialsForAdmin(gate.staff);
  const viewerIdentity = {
    id: gate.staff.id,
    email: gate.staff.email,
    full_name: gate.staff.full_name,
    role: gate.staff.role,
  };

  return (
    <AdminWorkspaceShell staff={viewerIdentity} activeModule="testimonials">
      <AdminTestimonialsWorkspace
        staff={viewerIdentity}
        initialTestimonials={testimonials}
      />
    </AdminWorkspaceShell>
  );
}

export default function AdminTestimonialsPage() {
  return (
    <Suspense
      fallback={
        <main className="w-full min-h-screen bg-ivory text-charcoal flex items-center justify-center px-6 py-24 font-mono text-xs uppercase tracking-widest">
          Loading Testimonials Workspace...
        </main>
      }
    >
      <AdminTestimonialsContent />
    </Suspense>
  );
}
