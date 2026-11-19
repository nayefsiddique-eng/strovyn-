import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Request a Quotation & Adelaide Consultation',
  description:
    'Request a quotation or book an on-site substrate consultation across Greater Adelaide with Strovyn Painting Co. (WhatsApp: 0406 646 061).',
  openGraph: {
    title: 'Request a Quotation & Adelaide Consultation | Strovyn Painting Co.',
    description:
      'Initiate a project consultation or upload architectural plans for an on-site Adelaide assessment with Strovyn Painting Co.',
    images: ['/images/strovyn-logo.png'],
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
