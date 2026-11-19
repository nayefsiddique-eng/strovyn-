export const EDITORIAL_PRIVATE_MEDIA_BUCKET = 'editorial-media';
export const EDITORIAL_MEDIA_BUCKET = EDITORIAL_PRIVATE_MEDIA_BUCKET;
export const FORBIDDEN_CUSTOMER_BUCKET = 'customer-documents';

const CANONICAL_PUBLIC_MEDIA_REF_REGEX =
  /^\/api\/editorial-media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const STAFF_PREVIEW_MEDIA_REF_REGEX =
  /^\/api\/admin\/insights\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const UUID_STRING_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Canonical stable media URL stored in article records (`featured_image_url`,
 * `og_image_url`, `content_json`). Always resolves through the publication-gated
 * `/api/editorial-media/<id>` delivery handler (returns 404 unless a referencing
 * article is legitimately published).
 */
export function buildCanonicalEditorialMediaRef(assetId: string): string {
  const trimmed = assetId.trim().toLowerCase();
  if (!UUID_STRING_REGEX.test(trimmed)) {
    throw new Error('Invalid editorial media asset UUID.');
  }
  return `/api/editorial-media/${trimmed}`;
}

export function buildStaffMediaPreviewRef(assetId: string): string {
  const trimmed = assetId.trim().toLowerCase();
  if (!UUID_STRING_REGEX.test(trimmed)) {
    throw new Error('Invalid editorial media asset UUID.');
  }
  return `/api/admin/insights/media/${trimmed}`;
}

export function parseEditorialMediaRef(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  const match =
    trimmed.match(CANONICAL_PUBLIC_MEDIA_REF_REGEX) ??
    trimmed.match(STAFF_PREVIEW_MEDIA_REF_REGEX);
  return match ? match[1].toLowerCase() : null;
}

function resolveConfiguredSupabaseOrigin(
  configuredUrl?: string
): { hostname: string; protocol: string } | null {
  const candidate = (configuredUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return {
      hostname: parsed.hostname,
      protocol: parsed.protocol,
    };
  } catch {
    return null;
  }
}

function isMatchingSupabaseUrl(
  parsed: URL,
  configured: { hostname: string; protocol: string } | null
): boolean {
  if (!configured) return false;
  if (parsed.hostname !== configured.hostname) return false;
  if (parsed.protocol === 'https:') return true;
  return (
    configured.protocol === 'http:' &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
    parsed.protocol === 'http:'
  );
}

/**
 * Authoritative persistent image URL validator shared by both client editor UI
 * and server schemas/sanitizers:
 *  - Unconditionally rejects `customer-documents`, traversal, control chars, SVG,
 *    ALL Supabase Storage bucket `/public/...` links (public or private), and
 *    temporary `/sign/` URLs so direct storage URLs or expiring signed tokens are
 *    never saved in article content
 *  - Allows safe bundled `/images/<name>.(jpg|jpeg|png|webp)`
 *  - Allows canonical publication-gated `/api/editorial-media/<uuid>` references
 *  - Allows HTTPS `images.unsplash.com` editorial stock URLs
 */
export function validateApprovedEditorialMediaUrl(
  rawUrl: string
): { valid: true; url: string } | { valid: false; reason: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 1000) {
    return { valid: false, reason: 'Image URL length is invalid.' };
  }

  if (/[\x00-\x1f\s"'<>\\]/.test(trimmed)) {
    return { valid: false, reason: 'Image URL contains unsafe characters.' };
  }

  const lower = trimmed.toLowerCase();
  if (lower.includes(FORBIDDEN_CUSTOMER_BUCKET)) {
    return {
      valid: false,
      reason: 'Customer documents bucket URLs are strictly prohibited in editorial content.',
    };
  }

  if (trimmed.startsWith('/images/')) {
    if (trimmed.includes('..')) {
      return { valid: false, reason: 'Path traversal is not permitted in image path.' };
    }
    if (!/\.(jpe?g|png|webp)$/i.test(trimmed)) {
      return { valid: false, reason: 'Local editorial images must use .jpg, .png, or .webp.' };
    }
    return { valid: true, url: trimmed };
  }

  const canonicalMatch = trimmed.match(CANONICAL_PUBLIC_MEDIA_REF_REGEX);
  if (canonicalMatch) {
    return { valid: true, url: buildCanonicalEditorialMediaRef(canonicalMatch[1]) };
  }

  if (trimmed.startsWith('/api/admin/insights/media/')) {
    return {
      valid: false,
      reason:
        'Staff preview media URLs cannot be saved persistently; use /api/editorial-media/<id>.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: 'Malformed image URL.' };
  }

  if (parsed.pathname.includes('..')) {
    return { valid: false, reason: 'Path traversal is not permitted in image URL.' };
  }

  if (parsed.pathname.startsWith('/storage/v1/object/')) {
    return {
      valid: false,
      reason:
        'Direct Supabase Storage or temporary signed URLs cannot be stored in editorial articles; use /api/editorial-media/<id>.',
    };
  }

  if (parsed.protocol === 'https:' && parsed.hostname === 'images.unsplash.com') {
    return { valid: true, url: parsed.toString() };
  }

  return {
    valid: false,
    reason: 'Image URL host is not in the approved editorial media allowlist.',
  };
}

/**
 * Validates URLs suitable for staff-only SSR preview rendering: accepts every
 * persistently approved editorial URL PLUS authenticated `/api/admin/insights/media/<id>`
 * and short-lived signed URLs issued for the private `editorial-media` bucket on
 * the configured Supabase host.
 */
export function isApprovedPreviewImageUrl(
  rawUrl: string,
  configuredSupabaseUrl?: string
): boolean {
  const persistent = validateApprovedEditorialMediaUrl(rawUrl);
  if (persistent.valid) {
    return true;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 2000 || /[\x00-\x1f\s"'<>\\]/.test(trimmed)) {
    return false;
  }
  if (trimmed.toLowerCase().includes(FORBIDDEN_CUSTOMER_BUCKET)) {
    return false;
  }

  if (STAFF_PREVIEW_MEDIA_REF_REGEX.test(trimmed)) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    const configured = resolveConfiguredSupabaseOrigin(configuredSupabaseUrl);
    if (!isMatchingSupabaseUrl(parsed, configured)) {
      return false;
    }
    if (parsed.pathname.includes('..')) return false;

    const signedPrefix = `/storage/v1/object/sign/${EDITORIAL_PRIVATE_MEDIA_BUCKET}/`;
    if (!parsed.pathname.startsWith(signedPrefix)) return false;
    if (!/\.(jpe?g|png|webp)$/i.test(parsed.pathname)) return false;
    return parsed.searchParams.has('token');
  } catch {
    return false;
  }
}
