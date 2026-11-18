/**
 * Strovyn Painting Co. - Australian Construction Industry Research Pipeline
 * Source Adapter: Safe Work Australia
 * URL: https://www.safeworkaustralia.gov.au/media-centre
 *
 * Uses semantic <time datetime="..."> elements matched strictly to their
 * corresponding card headline anchor.
 */

import { normalizeCanonicalUrl } from '../lib/urlNormalizer.mjs';

export async function fetchSafeWorkAustraliaUpdates() {
  const url = 'https://www.safeworkaustralia.gov.au/media-centre';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { source: 'Safe Work Australia', error: `HTTP ${res.status}`, items: [] };
    }

    const html = await res.text();
    const items = [];
    const seenUrls = new Set();

    // Split by discrete teaser/card containers
    const cardSplits = html.split(/(?:<div[^>]*class="[^"]*views-row[^"]*"|<article[^>]*>|<div[^>]*class="[^"]*teaser[^"]*")/i);

    if (cardSplits.length > 1) {
      for (let i = 1; i < cardSplits.length; i++) {
        const container = cardSplits[i];
        const linkMatch = container.match(/href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
        if (!linkMatch) continue;

        const rawHref = linkMatch[1];
        const title = linkMatch[2].replace(/<[^>]+>/g, '').trim();
        if (!title || title.length < 5 || rawHref.startsWith('#')) continue;

        let canonicalUrl;
        try {
          const full = rawHref.startsWith('http') ? rawHref : `https://www.safeworkaustralia.gov.au${rawHref}`;
          canonicalUrl = normalizeCanonicalUrl(full);
        } catch {
          continue;
        }

        if (seenUrls.has(canonicalUrl)) continue;
        seenUrls.add(canonicalUrl);

        // Time tag strictly inside THIS card
        const timeMatch = container.match(/<time[^>]*datetime="([^"]+)"[^>]*>([^<]*)<\/time>/i);
        const isoDate = timeMatch ? timeMatch[1] : null;
        const displayDate = timeMatch ? timeMatch[2].trim() : null;

        items.push({
          sourceAuthority: 'Safe Work Australia',
          title,
          canonicalUrl,
          publicationDate: displayDate || isoDate,
          isoDate
        });
      }
    } else {
      // Fallback: Strict contiguous regex
      const cardRegex = /<time[^>]*datetime="([^"]+)"[^>]*>([^<]*)<\/time>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while ((match = cardRegex.exec(html)) !== null) {
        const isoDate = match[1];
        const displayDate = match[2].trim();
        const rawPath = match[3];
        const title = match[4].replace(/<[^>]+>/g, '').trim();

        if (!title || rawPath.startsWith('#')) continue;

        let canonicalUrl;
        try {
          const full = rawPath.startsWith('http') ? rawPath : `https://www.safeworkaustralia.gov.au${rawPath}`;
          canonicalUrl = normalizeCanonicalUrl(full);
        } catch {
          continue;
        }

        if (seenUrls.has(canonicalUrl)) continue;
        seenUrls.add(canonicalUrl);

        items.push({
          sourceAuthority: 'Safe Work Australia',
          title,
          canonicalUrl,
          publicationDate: displayDate || isoDate,
          isoDate
        });
      }
    }

    if (items.length === 0) {
      return {
        source: 'Safe Work Australia',
        error: 'STRUCTURE_ANOMALY: 0 articles extracted from Safe Work Australia. Potential page redesign.',
        items: []
      };
    }

    return { source: 'Safe Work Australia', error: null, items: items.slice(0, 8) };
  } catch (err) {
    clearTimeout(timeout);
    return {
      source: 'Safe Work Australia',
      error: err.name === 'AbortError' ? 'Timeout (12s)' : err.message,
      items: []
    };
  }
}
