import type { Metadata } from 'next';
import { playfair, inter } from '@/styles/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Strovyn Painting Co. | Premium Architectural Painting',
    template: '%s | Strovyn Painting Co.',
  },
  description:
    'Professional painting services delivering premium craftsmanship, attention to detail, and architectural sophistication for residential and commercial projects.',
  keywords: [
    'painting services',
    'interior painting',
    'exterior painting',
    'commercial painting',
    'residential painting',
    'architectural finishes',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Strovyn Painting Co.',
    title: 'Strovyn Painting Co. | Premium Architectural Painting',
    description:
      'Professional painting services delivering premium craftsmanship and architectural sophistication.',
    images: ['/images/og-default.jpg'],
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
      className={`${playfair.variable} ${inter.variable} h-full`}
    >
      <body className="min-h-full bg-ivory text-charcoal font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
