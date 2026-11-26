import React from 'react';
import type { Metadata } from 'next';
import { inter, anton } from '@/styles/fonts';
import { Header, Footer } from '@/components/layout';
import { PublicConversionWidgets } from '@/components/floating/PublicConversionWidgets';
import { IntroWrapper } from '@/components/intro';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || 'https://strovynpaints.com'
  ),
  alternates: {
    canonical: '/',
  },
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
      suppressHydrationWarning
      className={`${inter.variable} ${anton.variable} h-full`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try {
                var key = 'strovyn-theme';
                var saved = localStorage.getItem(key);
                var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                var isDark = saved === 'dark' || (!saved && prefersDark);
                if (isDark) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
                if (window.location.pathname === '/') {
                  var rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                  if (!rm) {
                    document.documentElement.setAttribute('data-intro-pending', 'true');
                    setTimeout(function(){
                      document.documentElement.removeAttribute('data-intro-pending');
                    }, 1500);
                  }
                }
              } catch(e) {}
            })();`,
          }}
        />
      </head>
      <body className="min-h-full bg-ivory text-charcoal font-sans antialiased flex flex-col">
        <React.Suspense fallback={null}>
          <Header />
        </React.Suspense>
        <div className="flex-1">
          <IntroWrapper>{children}</IntroWrapper>
        </div>
        <Footer />
        <PublicConversionWidgets />
      </body>
    </html>
  );
}
