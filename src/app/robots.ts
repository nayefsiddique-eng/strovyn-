import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || 'https://strovynpaints.com'
  ).replace(/\/+$/, '');
  const isProductionHost =
    process.env.CONTEXT === 'production' &&
    !siteUrl.includes('netlify.app');

  if (!isProductionHost) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
