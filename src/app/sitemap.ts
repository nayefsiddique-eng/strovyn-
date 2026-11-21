import type { MetadataRoute } from 'next';
import { SERVICES_DATA } from '@/data/servicesData';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || 'https://strovynpaints.com'
  ).replace(/\/+$/, '');

  const staticRoutes = [
    '',
    '/about',
    '/services',
    '/projects',
    '/insights',
    '/careers',
    '/contact',
    '/feedback',
    '/visualiser',
  ];

  const serviceRoutes = SERVICES_DATA.map((s) => `/services/${s.slug}`);

  return [...staticRoutes, ...serviceRoutes].map((route) => ({
    url: `${siteUrl}${route}`,
    changeFrequency: route === '' || route === '/insights' ? 'weekly' : 'monthly',
    priority: route === '' ? 1.0 : route === '/services' || route === '/projects' ? 0.9 : 0.8,
  }));
}
