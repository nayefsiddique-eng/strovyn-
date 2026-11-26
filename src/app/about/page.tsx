import React from 'react';
import type { Metadata } from 'next';
import { V3AboutAtelier } from '@/components/v3-luxury/pages/V3AboutAtelier';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Learn about our dedication to architectural coatings, Level 5 surface preparation, and the philosophy of quiet luxury in contemporary finishes.',
};

export default function AboutPage() {
  return <V3AboutAtelier />;
}
