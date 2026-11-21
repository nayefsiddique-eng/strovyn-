'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { FloatingContact } from './FloatingContact';
import { AIAssistant } from './AIAssistant';

/**
 * Renders customer-facing conversion widgets (WhatsApp, mobile sticky bar,
 * and STRO Finish Guide) strictly on public routes, keeping `/admin/**`
 * workspaces completely unobstructed.
 */
export const PublicConversionWidgets: React.FC = () => {
  const pathname = usePathname();
  if (pathname === '/admin' || pathname?.startsWith('/admin/')) {
    return null;
  }

  return (
    <>
      <FloatingContact />
      <AIAssistant />
    </>
  );
};
