import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Careers & Craftsmanship Guild',
  description:
    'Career opportunities and expressions of interest for architectural painters and fine cabinetry spray technicians across Greater Adelaide, SA.',
  openGraph: {
    title: 'Careers & Craftsmanship Guild | Strovyn Painting Co.',
    description:
      'Join Strovyn Painting Co. across Greater Adelaide — dedicated to Level 5 surface preparation and architectural coatings.',
    images: ['/images/strovyn-logo.png'],
  },
};

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
