/**
 * Strovyn Painting Co. - URL Normalization Utility
 * Normalizes canonical URLs for stable identification:
 * - Validates allowed protocols (https: only, or http: during local testing)
 * - Lowercases hostname/domain only
 * - Preserves exact casing of pathname
 * - Removes URL hash/fragments
 * - Strips marketing tracking query parameters (utm_*, fbclid, gclid, etc.)
 * - Preserves and sorts meaningful query parameters
 * - Strips trailing slash on path (unless root)
 */

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'msclkid',
  '_ga',
  '_gl',
  'ref',
  'source'
]);

export function normalizeCanonicalUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('INVALID_URL: URL must be a non-empty string');
  }

  const trimmed = rawUrl.trim();

  // Reject invalid or dangerous schemes
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('file:') ||
    trimmed.startsWith('blob:')
  ) {
    throw new Error(`UNSUPPORTED_SCHEME: ${trimmed}`);
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`MALFORMED_URL: Cannot parse ${trimmed}`);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`UNSUPPORTED_PROTOCOL: ${parsed.protocol}`);
  }

  // Hostname is lowercased automatically by WHATWG URL standard
  const hostname = parsed.hostname.toLowerCase();

  // Pathname: preserve exact case, remove redundant trailing slash (except root '/')
  let pathname = parsed.pathname;
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  // Filter and sort query parameters
  const searchParams = new URLSearchParams(parsed.search);
  const cleanParams = new URLSearchParams();

  // Sort keys alphabetically for deterministic normalization
  const sortedKeys = Array.from(searchParams.keys()).sort();
  for (const key of sortedKeys) {
    if (!TRACKING_PARAMS.has(key.toLowerCase())) {
      const values = searchParams.getAll(key);
      for (const val of values) {
        cleanParams.append(key, val);
      }
    }
  }

  const queryString = cleanParams.toString();
  const search = queryString ? `?${queryString}` : '';

  // Omit default ports (80 for http, 443 for https)
  const port = (parsed.port && parsed.port !== '80' && parsed.port !== '443') ? `:${parsed.port}` : '';

  return `${parsed.protocol}//${hostname}${port}${pathname}${search}`;
}
