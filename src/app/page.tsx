import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import {
  Hero,
  EditorialStatement,
  OurExpertise,
  FeaturedProjects,
  BeforeAfterSlider,
  StrovynApproach,
  InsightsArticles,
  FinalContact,
  SearchableFAQ,
  FinishExplorer,
} from '@/components/home';
import { HomeInsightsSection } from '@/components/home/HomeInsightsSection';
import { HomeProjectsSection } from '@/components/home/HomeProjectsSection';

export const metadata: Metadata = {
  title: {
    absolute: 'Strovyn Painting Co. | Premium Painters Adelaide, South Australia',
  },
  description:
    'Thoughtful preparation, refined finishes and professional painting for spaces that deserve a higher standard. Serving greater Adelaide, South Australia.',
};

export default function HomePage() {
  return (
    <main className="w-full min-h-screen bg-ivory text-charcoal flex flex-col selection:bg-brand-red selection:text-white">
      {/* SECTION A & B: CINEMATIC OPENING & MAIN HERO */}
      <Hero />

      {/* SECTION C: EDITORIAL BRAND STATEMENT */}
      <EditorialStatement />

      {/* SECTION D: OUR EXPERTISE */}
      <OurExpertise />

      {/* SECTION E: FEATURED PROJECTS */}
      <Suspense fallback={<FeaturedProjects />}>
        <HomeProjectsSection />
      </Suspense>

      {/* TACTILE SUBSTRATE TRANSFORMATION (Interactive Before/After Slider) */}
      <BeforeAfterSlider />

      {/* FINISH EXPLORER (Tactile Sheen & Substrate Matrix) */}
      <FinishExplorer />

      {/* SECTION F: THE STROVYN APPROACH */}
      <StrovynApproach />

      {/* SECTION G: INSIGHTS AND ARTICLES WITH MOVING TICKER */}
      <Suspense fallback={<InsightsArticles isLoading />}>
        <HomeInsightsSection />
      </Suspense>

      {/* SEARCHABLE FAQ */}
      <SearchableFAQ />

      {/* SECTION H: FINAL CONTACT SECTION */}
      <FinalContact />
    </main>
  );
}
