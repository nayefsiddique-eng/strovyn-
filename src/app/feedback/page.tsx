import React from 'react';
import type { Metadata } from 'next';
import { V3FeedbackFolio } from '@/components/v3-luxury/pages/V3FeedbackFolio';

export const metadata: Metadata = {
  title: 'Client Reflections & Feedback',
  description:
    'Submit your Strovyn Painting Co. project evaluation and handover reflection.',
};

export default function FeedbackPage() {
  return <V3FeedbackFolio />;
}
