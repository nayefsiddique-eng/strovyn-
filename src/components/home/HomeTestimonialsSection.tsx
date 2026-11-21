import React from 'react';
import { getPublicTestimonials } from '@/lib/cms/publicTestimonials';
import { TestimonialCarousel } from './TestimonialCarousel';

export async function HomeTestimonialsSection() {
  const testimonials = await getPublicTestimonials();
  return <TestimonialCarousel testimonials={testimonials} />;
}
