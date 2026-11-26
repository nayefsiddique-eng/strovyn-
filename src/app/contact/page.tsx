import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { V3ContactAtelier } from '@/components/v3-luxury/pages/V3ContactAtelier';

export const metadata: Metadata = {
  title: 'Request Consultation & Quotation',
  description:
    'Book a free Adelaide on-site architectural painting consultation and substrate diagnostic.',
};

export default function ContactPage() {
  return (
    <Suspense
      fallback={
        <div
          role="main"
          className="w-full min-h-screen bg-[#F4F1EA] dark:bg-[#181917] text-[#20211F] dark:text-[#F4F1EA] flex items-center justify-center py-40 font-mono text-xs uppercase tracking-[0.22em]"
        >
          Loading Specification Desk...
        </div>
      }
    >
      <V3ContactAtelier />
    </Suspense>
  );
}
