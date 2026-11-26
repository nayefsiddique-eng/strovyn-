import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getProjectsWithOverridesAsync } from '@/lib/projectPhotos';
import { FinishExplorer } from '@/components/home/FinishExplorer';
import { HomeInsightsSection } from '@/components/home/HomeInsightsSection';
import { HomeTestimonialsSection } from '@/components/home/HomeTestimonialsSection';
import { InsightsArticles } from '@/components/home/InsightsArticles';
import { SearchableFAQ } from '@/components/home/SearchableFAQ';
import { TestimonialCarousel } from '@/components/home/TestimonialCarousel';
import { StrovynV2IntroGate } from '@/components/v2/StrovynV2IntroGate';
import { StrovynV2Navbar } from '@/components/v2/StrovynV2Navbar';
import { StrovynV2Hero } from '@/components/v2/StrovynV2Hero';
import { StrovynV2Craftsmanship } from '@/components/v2/StrovynV2Craftsmanship';
import { StrovynV2Services } from '@/components/v2/StrovynV2Services';
import { StrovynV2Approach } from '@/components/v2/StrovynV2Approach';
import { StrovynV2Portfolio } from '@/components/v2/StrovynV2Portfolio';
import { StrovynV2ConsultationCta } from '@/components/v2/StrovynV2ConsultationCta';

export const metadata: Metadata = {
  title: 'Strovyn Painting Co. — Architectural Shell Prototype (v2)',
  description:
    'Isolated visual migration prototype for Strovyn Painting Co., Adelaide, South Australia.',
  robots: {
    index: false,
    follow: false,
  },
};

async function LivePortfolioLoader() {
  await connection();
  const projects = await getProjectsWithOverridesAsync();
  return <StrovynV2Portfolio projects={projects} />;
}

export default function StrovynPrototypeV2Page() {
  return (
    <>
      <StrovynV2IntroGate />
      <StrovynV2Navbar />
      <main
        data-v2-prototype="true"
        className="w-full min-h-screen bg-ivory text-charcoal flex flex-col overflow-x-hidden"
      >
        <StrovynV2Hero />
        <StrovynV2Craftsmanship />
        <StrovynV2Services />
        <FinishExplorer />
        <StrovynV2Approach />
        <Suspense fallback={<StrovynV2Portfolio projects={[]} isLoading />}>
          <LivePortfolioLoader />
        </Suspense>
        <Suspense fallback={<TestimonialCarousel isLoading />}>
          <HomeTestimonialsSection />
        </Suspense>
        <Suspense fallback={<InsightsArticles isLoading />}>
          <HomeInsightsSection />
        </Suspense>
        <div id="v2-faq" className="w-full bg-ivory">
          <SearchableFAQ />
        </div>
        <StrovynV2ConsultationCta />
      </main>
    </>
  );
}
