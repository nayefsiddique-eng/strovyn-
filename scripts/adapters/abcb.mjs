/**
 * Strovyn Painting Co. - Australian Construction Industry Research Pipeline
 * Source Adapter: Australian Building Codes Board (ABCB)
 * URL: https://www.abcb.gov.au/news
 *
 * Scrapes discrete news cards on abcb.gov.au/news.
 * Isolates each container to ensure title, link, and publication date
 * are extracted strictly from the same card element.
 */

import { normalizeCanonicalUrl } from '../lib/urlNormalizer.mjs';

export async function fetchABCBUpdates() {
  const url = 'https://www.abcb.gov.au/news';
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
      return { source: 'ABCB', error: `HTTP ${res.status}`, items: [] };
    }

    const html = await res.text();
    const items = [];
    const seenUrls = new Set();

    // Split HTML into discrete article/view-row/card chunks or isolate article blocks
    // ABCB renders items in <div class="views-row"> or <article> or card containers
    const rowSplits = html.split(/(?:<div[^>]*class="[^"]*views-row[^"]*"|<article[^>]*>)/i);

    // If structured rows found, parse each container individually
    if (rowSplits.length > 1) {
      for (let i = 1; i < rowSplits.length; i++) {
        const container = rowSplits[i];
        const linkMatch = container.match(/href="(\/news\/\d{4}\/[^"#?]+)"[^>]*>([\s\S]*?)<\/a>/i);
        if (!linkMatch) continue;

        const rawPath = linkMatch[1];
        const title = linkMatch[2].replace(/<[^>]+>/g, '').trim();
        if (!title || title.length < 5) continue;

        let canonicalUrl;
        try {
          canonicalUrl = normalizeCanonicalUrl(`https://www.abcb.gov.au${rawPath}`);
        } catch {
          continue;
        }

        if (seenUrls.has(canonicalUrl)) continue;
        seenUrls.add(canonicalUrl);

        // Date strictly within THIS card container
        const dateMatch = container.match(/\b(?:\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/i);
        const publicationDate = dateMatch ? dateMatch[0].trim() : null;

        items.push({
          sourceAuthority: 'Australian Building Codes Board',
          title,
          canonicalUrl,
          publicationDate,
          rawSlug: rawPath.split('/').pop()
        });
      }
    } else {
      // Fallback: Anchor-driven with tight contextual boundary (max 250 chars)
      const articleRegex = /href="(\/news\/\d{4}\/[^"#?]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while ((match = articleRegex.exec(html)) !== null) {
        const rawPath = match[1];
        const title = match[2].replace(/<[^>]+>/g, '').trim();
        if (!title || title.length < 5) continue;

        let canonicalUrl;
        try {
          canonicalUrl = normalizeCanonicalUrl(`https://www.abcb.gov.au${rawPath}`);
        } catch {
          continue;
        }

        if (seenUrls.has(canonicalUrl)) continue;
        seenUrls.add(canonicalUrl);

        // Date search strictly within immediate 250 characters
        const startIdx = Math.max(0, match.index - 250);
        const endIdx = Math.min(html.length, match.index + 250);
        const snippet = html.substring(startIdx, endIdx);
        const dateMatch = snippet.match(/\b(?:\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/i);
        const publicationDate = dateMatch ? dateMatch[0].trim() : null;

        items.push({
          sourceAuthority: 'Australian Building Codes Board',
          title,
          canonicalUrl,
          publicationDate,
          rawSlug: rawPath.split('/').pop()
        });
      }
    }

    if (items.length === 0) {
      return {
        source: 'ABCB',
        error: 'STRUCTURE_ANOMALY: 0 articles extracted from ABCB. Potential page redesign.',
        items: []
      };
    }

    return { source: 'ABCB', error: null, items: items.slice(0, 8) };
  } catch (err) {
    clearTimeout(timeout);
    return {
      source: 'ABCB',
      error: err.name === 'AbortError' ? 'Timeout (12s)' : err.message,
      items: []
    };
  }
}
