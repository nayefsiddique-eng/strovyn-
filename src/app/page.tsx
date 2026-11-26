import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import {
  Hero,
  EditorialStatement,
  OurExpertise,
  FeaturedProjects,
  StrovynApproach,
  InsightsArticles,
  FinalContact,
  SearchableFAQ,
  FinishExplorer,
  TestimonialCarousel,
} from '@/components/home';
import { ClientExperiencesCarousel } from '@/components/home/ClientExperiencesCarousel';
import { HomeClientExperiencesSection } from '@/components/home/HomeClientExperiencesSection';
import { HomeInsightsSection } from '@/components/home/HomeInsightsSection';
import { HomeProjectsSection } from '@/components/home/HomeProjectsSection';
import { HomeTestimonialsSection } from '@/components/home/HomeTestimonialsSection';
import { getPublicInsuranceStatus } from '@/lib/cms/insuranceService';

export const metadata: Metadata = {
  title: {
    absolute: 'Strovyn Painting Co. | Premium Painters Adelaide, South Australia',
  },
  description:
    'Thoughtful preparation, refined finishes and professional painting for spaces that deserve a higher standard. Serving greater Adelaide, South Australia.',
};

export default async function HomePage() {
  const insuranceStatus = await getPublicInsuranceStatus();

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

      {/* SECTION 04: CLIENT EXPERIENCES (Interactive Testimonial Carousel) */}
      <Suspense fallback={<ClientExperiencesCarousel isLoading />}>
        <HomeClientExperiencesSection />
      </Suspense>

      {/* FINISH EXPLORER (Tactile Sheen & Substrate Matrix) */}
      <FinishExplorer />

      {/* SECTION F: THE STROVYN APPROACH */}
      <StrovynApproach />

      {/* SECTION 06: CLIENT PERSPECTIVES & VERIFIED TESTIMONIALS */}
      <Suspense fallback={<TestimonialCarousel isLoading />}>
        <HomeTestimonialsSection />
      </Suspense>

      {/* SECTION G: INSIGHTS AND ARTICLES WITH MOVING TICKER */}
      <Suspense fallback={<InsightsArticles isLoading />}>
        <HomeInsightsSection />
      </Suspense>

      {/* SEARCHABLE FAQ */}
      <SearchableFAQ />

      {/* SECTION H: FINAL CONTACT SECTION */}
      <FinalContact insuranceStatus={insuranceStatus} />
    </main>
  );
}
