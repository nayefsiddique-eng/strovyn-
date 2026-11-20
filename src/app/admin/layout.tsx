import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Business CMS | STROVYN',
  description: 'Internal Strovyn website operations and editorial management.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
  },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
