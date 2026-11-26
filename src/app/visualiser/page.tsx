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
    <div
      role="main"
      className="w-full min-h-screen bg-[#F4F1EA] dark:bg-[#181917] text-[#20211F] dark:text-[#F4F1EA]"
    >
      <div className="px-5 sm:px-10 lg:px-16 pt-8 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[#20211F]/25 dark:border-white/20 py-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[#5C5A55] dark:text-[#B8B5AE]">
          <span>§ IV &middot; OPTICAL COLOUR ATELIER &mdash; PRIVATE IN-BROWSER SIMULATION</span>
          <span>ZERO SERVER UPLOAD BY DEFAULT</span>
        </div>
      </div>

      <React.Suspense
        fallback={
          <div className="py-24 px-6 max-w-7xl mx-auto font-mono text-xs uppercase tracking-widest text-[#7E6340] dark:text-[#C9B28F]">
            Loading Wall Colour Visualiser...
          </div>
        }
      >
        <WallColourVisualiser />
      </React.Suspense>
    </div>
  );
}
