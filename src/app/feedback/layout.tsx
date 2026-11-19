import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Client Feedback & Project Evaluation',
  description:
    'Submit client project evaluations and craftsmanship feedback for Strovyn Painting Co. across Greater Adelaide, South Australia.',
  openGraph: {
    title: 'Client Feedback & Project Evaluation | Strovyn Painting Co.',
    description:
      'Share post-completion project reflections and surface finish feedback with Strovyn Painting Co.',
    images: ['/images/strovyn-logo.png'],
  },
};

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
