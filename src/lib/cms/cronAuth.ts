import 'server-only';
import crypto from 'node:crypto';
import { EditorialHttpError } from './http';

const MIN_CRON_SECRET_LENGTH = 24;

function sha256Buffer(value: string): Buffer {
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

export function extractCronBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization')?.trim();
  if (authHeader && /^Bearer\s+/i.test(authHeader)) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    return token || null;
  }
  const altHeader = req.headers.get('x-cron-secret')?.trim();
  return altHeader || null;
}

/**
 * Fail-closed verification for automated operational cron endpoints.
 * Compares SHA-256 digests via `crypto.timingSafeEqual` so timing side-channels
 * are eliminated and browser-exposed `NEXT_PUBLIC_*` keys are never accepted.
 */
export function assertCronAuthorized(req: Request): void {
  const configured = process.env.CRON_SECRET?.trim() ?? '';
  if (!configured || configured.length < MIN_CRON_SECRET_LENGTH) {
    throw new EditorialHttpError(
      503,
      'INTERNAL_ERROR',
      'Operational cron secret (CRON_SECRET) is not configured on the server.'
    );
  }

  const provided = extractCronBearerToken(req);
  if (!provided) {
    throw new EditorialHttpError(
      401,
      'FORBIDDEN',
      'Missing operational cron authorization token.'
    );
  }

  const expectedDigest = sha256Buffer(configured);
  const providedDigest = sha256Buffer(provided);
  if (!crypto.timingSafeEqual(expectedDigest, providedDigest)) {
    throw new EditorialHttpError(
      401,
      'FORBIDDEN',
      'Invalid operational cron authorization token.'
    );
  }
}

export const CRON_NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;
