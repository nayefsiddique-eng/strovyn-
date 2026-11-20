import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Editorial Desk | STROVYN',
  description: 'Internal Strovyn editorial queue and governance workspace.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
  },
};

export default function AdminInsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
