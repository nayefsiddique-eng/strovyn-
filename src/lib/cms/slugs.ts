const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'edit',
  'index',
  'media',
  'new',
  'preview',
  'static',
]);

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MIN_SLUG_LENGTH = 3;
export const MAX_SLUG_LENGTH = 96;

/**
 * Generates a URL-safe kebab-case slug bounded to [3..96] characters.
 */
export function generateSlug(input: string): string {
  const normalized = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const clipped = normalized.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, '');
  return clipped;
}

export function isValidSlug(slug: string): boolean {
  if (typeof slug !== 'string') return false;
  if (slug.length < MIN_SLUG_LENGTH || slug.length > MAX_SLUG_LENGTH) return false;
  if (!SLUG_REGEX.test(slug)) return false;
  if (RESERVED_SLUGS.has(slug)) return false;
  return true;
}
