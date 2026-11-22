import React from 'react';
import { getPublicTestimonials } from '@/lib/cms/publicTestimonials';
import { ClientExperiencesCarousel } from './ClientExperiencesCarousel';

export async function HomeClientExperiencesSection() {
  const testimonials = await getPublicTestimonials();
  return <ClientExperiencesCarousel testimonials={testimonials} />;
}
