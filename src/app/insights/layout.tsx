import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Architectural Insights & Coatings Science',
  description:
    'Technical field notes on Level 5 plaster preparation, mineral silicate chemistry, artisanal lime plasters, and fine architectural finishing.',
  openGraph: {
    title: 'Architectural Insights & Coatings Science | Strovyn Painting Co.',
    description:
      'Technical papers and substrate analyses on architectural painting and fine surface craft by Strovyn Painting Co.',
    images: ['/images/strovyn-logo.png'],
  },
};

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
