/**
 * Strovyn Painting Co. - Australian Construction Industry Research Pipeline
 * Source Adapter: Standards Australia
 * URL: https://www.standards.org.au/news
 *
 * Scrapes news cards from standards.org.au/news.
 * Isolates each news item block to prevent bleed-through of dates across cards.
 */

import { normalizeCanonicalUrl } from '../lib/urlNormalizer.mjs';

export async function fetchStandardsAustraliaUpdates() {
  const url = 'https://www.standards.org.au/news';
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
      return { source: 'Standards Australia', error: `HTTP ${res.status}`, items: [] };
    }

    const html = await res.text();
    const items = [];
    const seenUrls = new Set();

    // Standards Australia renders articles in card blocks (<div class="...card..."> or similar)
    const cardSplits = html.split(/(?:<div[^>]*class="[^"]*(?:card|item|post|news-item)[^"]*"|<article[^>]*>)/i);

    if (cardSplits.length > 1) {
      for (let i = 1; i < cardSplits.length; i++) {
        const container = cardSplits[i];
        const linkMatch = container.match(/href="(\/news\/[a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/i);
        if (!linkMatch) continue;

        const rawPath = linkMatch[1];
        const linkText = linkMatch[2].replace(/<[^>]+>/g, '').trim();

        if (!rawPath || rawPath === '/news' || rawPath === '/news/' || linkText.length < 10) continue;

        let canonicalUrl;
        try {
          canonicalUrl = normalizeCanonicalUrl(`https://www.standards.org.au${rawPath}`);
        } catch {
          continue;
        }

        if (seenUrls.has(canonicalUrl)) continue;
        seenUrls.add(canonicalUrl);

        // Date strictly within THIS card container
        const dateMatch = container.match(/\b(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/i);
        const publicationDate = dateMatch ? dateMatch[0].trim() : null;

        items.push({
          sourceAuthority: 'Standards Australia',
          title: linkText,
          canonicalUrl,
          publicationDate,
          rawSlug: rawPath.split('/').pop()
        });
      }
    } else {
      // Fallback: Tight contiguous search window (250 chars max)
      const linkRegex = /href="(\/news\/[a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        const rawPath = match[1];
        const linkText = match[2].replace(/<[^>]+>/g, '').trim();

        if (!rawPath || rawPath === '/news' || rawPath === '/news/' || linkText.length < 10) continue;

        let canonicalUrl;
        try {
          canonicalUrl = normalizeCanonicalUrl(`https://www.standards.org.au${rawPath}`);
        } catch {
          continue;
        }

        if (seenUrls.has(canonicalUrl)) continue;
        seenUrls.add(canonicalUrl);

        const startIdx = Math.max(0, match.index - 250);
        const endIdx = Math.min(html.length, match.index + 250);
        const snippet = html.substring(startIdx, endIdx);
        const dateMatch = snippet.match(/\b(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/i);
        const publicationDate = dateMatch ? dateMatch[0].trim() : null;

        items.push({
          sourceAuthority: 'Standards Australia',
          title: linkText,
          canonicalUrl,
          publicationDate,
          rawSlug: rawPath.split('/').pop()
        });
      }
    }

    if (items.length === 0) {
      return {
        source: 'Standards Australia',
        error: 'STRUCTURE_ANOMALY: 0 articles extracted from Standards Australia. Potential page redesign.',
        items: []
      };
    }

    return { source: 'Standards Australia', error: null, items: items.slice(0, 8) };
  } catch (err) {
    clearTimeout(timeout);
    return {
      source: 'Standards Australia',
      error: err.name === 'AbortError' ? 'Timeout (12s)' : err.message,
      items: []
    };
  }
}
