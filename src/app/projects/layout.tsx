import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Architectural Portfolio & Projects',
  description:
    'Selected residential architectural painting commissions, surface finishing studies, and coating schedules across Greater Adelaide, South Australia.',
  openGraph: {
    title: 'Architectural Portfolio & Projects | Strovyn Painting Co.',
    description:
      'Selected residential architectural painting commissions and surface finishing case studies across Greater Adelaide, South Australia.',
    images: ['/images/strovyn-logo.png'],
  },
};

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
