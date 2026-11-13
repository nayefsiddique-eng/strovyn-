import React from 'react';
import type { Metadata } from 'next';
import { playfair, inter, bebasNeue } from '@/styles/fonts';
import { Header, Footer } from '@/components/layout';
import { FloatingContact } from '@/components/floating/FloatingContact';
import { AIAssistant } from '@/components/floating/AIAssistant';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'Strovyn Painting Co. | Premium Architectural Painting — Adelaide SA',
    template: '%s | Strovyn Painting Co.',
  },
  description:
    'Strovyn Painting Co. delivers premium architectural painting, heritage restoration and bespoke surface treatments across Adelaide, South Australia. A new standard in innovation.',
  keywords: [
    'painting services Adelaide',
    'interior painting',
    'exterior painting',
    'architectural finishes',
    'heritage restoration',
    'Adelaide painter',
    'premium painting Adelaide SA',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Strovyn Painting Co.',
    title: 'Strovyn Painting Co. | Premium Architectural Painting — Adelaide SA',
    description:
      'Premium architectural painting, heritage restoration and bespoke surface treatments across Adelaide, South Australia.',
    images: ['/images/strovyn-logo.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${inter.variable} ${bebasNeue.variable} h-full`}
    >
      <body className="min-h-full bg-ivory text-charcoal font-sans antialiased flex flex-col">
        <React.Suspense fallback={<div className="h-20" />}>
          <Header />
        </React.Suspense>
        <div className="flex-1">
          {children}
        </div>
        <Footer />
        <FloatingContact />
        <AIAssistant />
      </body>
    </html>
  );
}
