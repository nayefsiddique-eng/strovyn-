import React from 'react';
import type { Metadata } from 'next';
import { WallColourVisualiser } from '@/components/visualiser/WallColourVisualiser';

export const metadata: Metadata = {
  title: 'Wall Colour Visualiser (Preview)',
  description:
    'Preview illustrative architectural paint finishes on your own room photographs locally in your browser.',
};

export default function VisualiserPage() {
  return (
    <main className="w-full min-h-screen bg-ivory text-charcoal pt-20">
      <React.Suspense
        fallback={
          <div className="py-24 px-6 max-w-7xl mx-auto font-mono text-xs uppercase tracking-widest text-warm-grey-dark">
            Loading Wall Colour Visualiser...
          </div>
        }
      >
        <WallColourVisualiser />
      </React.Suspense>
    </main>
  );
}
