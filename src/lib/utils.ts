/**
 * General purpose utilities for Strovyn Painting Co.
 */

type ClassValue =
  | string
  | number
  | bigint
  | boolean
  | undefined
  | null
  | { [key: string]: boolean | string | number | undefined | null }
  | ClassValue[];

/**
 * Merges class names into a single clean space-delimited string.
 * Template literal and array-safe without external clsx dependency.
 */
export function cn(...inputs: ClassValue[]): string {
  const result: string[] = [];

  const process = (val: ClassValue): void => {
    if (!val && val !== 0) return;
    if (typeof val === 'string' || typeof val === 'number') {
      const trimmed = String(val).trim();
      if (trimmed) result.push(trimmed);
    } else if (Array.isArray(val)) {
      val.forEach(process);
    }
  };

  inputs.forEach(process);
  return result.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Formats a Date object, ISO string, or timestamp into an architectural editorial date.
 */
export function formatDate(
  date: string | number | Date,
  options: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }
): string {
  try {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', options).format(d);
  } catch {
    return '';
  }
}

/**
 * Truncates text cleanly at a given maximum character length with an ellipsis or custom suffix.
 */
export function truncateText(text: string, maxLength: number, suffix: string = '...'): string {
  if (!text || text.length <= maxLength) return text || '';
  const effectiveLength = Math.max(0, maxLength - suffix.length);
  const truncated = text.slice(0, effectiveLength).trim();
  return `${truncated}${suffix}`;
}

/**
 * Generates an SEO and URL-friendly kebab-case slug from a raw title or string.
 */
export function generateSlug(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Computes estimated reading time in minutes and total word count for editorial content.
 */
export function getReadingTime(
  content: string,
  wordsPerMinute: number = 200
): { minutes: number; words: number; text: string } {
  if (!content) {
    return { minutes: 0, words: 0, text: '0 min read' };
  }

  // Strip HTML / Markdown tags if present
  const stripped = content.replace(/<[^>]*>/g, ' ');
  const words = stripped.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / wordsPerMinute));

  return {
    minutes,
    words,
    text: `${minutes} min read`,
  };
}
