import React from 'react';
import type { Metadata } from 'next';
import { V3ServicesOverview } from '@/components/v3-luxury/pages/V3ServicesOverview';

export const metadata: Metadata = {
  title: 'Services & Finishes',
  description:
    'Comprehensive architectural painting, Level 5 interior coatings, exterior facade restoration, artisanal Venetian plasters, and fine millwork lacquering.',
};

export default function ServicesPage() {
  return <V3ServicesOverview />;
}
