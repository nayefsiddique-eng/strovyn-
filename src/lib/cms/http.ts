import 'server-only';
import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { StaffAuthError } from './staffAuth';

export type EditorialHttpErrorCode =
  | 'BAD_REQUEST'
  | 'CSRF_FAILED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'ARTICLE_INCOMPLETE'
  | 'INVALID_TRANSITION'
  | 'SCHEDULING_DEFERRED'
  | 'RATE_LIMITED'
  | 'STORAGE_ERROR'
  | 'INTERNAL_ERROR';

export class EditorialHttpError extends Error {
  readonly status: number;
  readonly code: EditorialHttpErrorCode;
  readonly retryAfterSec?: number;

  constructor(
    status: number,
    code: EditorialHttpErrorCode,
    message: string,
    retryAfterSec?: number
  ) {
    super(message);
    this.name = 'EditorialHttpError';
    this.status = status;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

/**
 * Fail-closed same-origin CSRF guard matching existing `/api/admin/photos` rules.
 */
export function verifySameOriginCsrf(req: Request): boolean {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (!origin || !host) {
    return false;
  }

  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.host === host;
  } catch {
    return false;
  }
}

export function assertSameOriginCsrf(req: Request): void {
  if (!verifySameOriginCsrf(req)) {
    throw new EditorialHttpError(
      403,
      'CSRF_FAILED',
      'CSRF validation failed: Origin header missing or mismatched.'
    );
  }
}

export function extractClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return 'local-client';
}

export async function enforceCmsRateLimit(
  req: Request,
  bucket: string,
  limit: number = 60,
  windowMs: number = 60_000
): Promise<void> {
  const clientIp = extractClientIp(req);
  const result = await checkRateLimit(`cms_${bucket}_${clientIp}`, limit, windowMs);
  if (!result.allowed) {
    throw new EditorialHttpError(
      429,
      'RATE_LIMITED',
      'Too many editorial requests. Please wait before retrying.',
      result.retryAfterSec
    );
  }
}

/**
 * Maps known CMS/Auth/Postgres errors into consistent safe HTTP JSON responses.
 * Never leaks SQL queries, secrets, env keys, or stack traces.
 */
export function mapCmsErrorToResponse(err: unknown): NextResponse {
  if (err instanceof StaffAuthError) {
    return NextResponse.json(
      {
        success: false,
        code: err.code,
        error: err.message,
      },
      {
        status: err.status,
        headers: {
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          'X-Robots-Tag': 'noindex, nofollow, noarchive',
        },
      }
    );
  }

  if (err instanceof EditorialHttpError) {
    const headers: Record<string, string> = {};
    if (err.retryAfterSec) {
      headers['Retry-After'] = String(err.retryAfterSec);
    }
    return NextResponse.json(
      {
        success: false,
        code: err.code,
        error: err.message,
      },
      { status: err.status, headers }
    );
  }

  if (typeof err === 'object' && err !== null && 'code' in err) {
    const pgErr = err as { code?: unknown; message?: unknown };
    if (pgErr.code === '23505') {
      return NextResponse.json(
        {
          success: false,
          code: 'CONFLICT',
          error: 'An article or resource with this unique identifier already exists.',
        },
        { status: 409 }
      );
    }
    if (pgErr.code === '22P02' || pgErr.code === '23502' || pgErr.code === '23514') {
      return NextResponse.json(
        {
          success: false,
          code: 'BAD_REQUEST',
          error: 'Request violates data validation or integrity rules.',
        },
        { status: 400 }
      );
    }
  }

  console.error('[CMS-2] Unhandled editorial engine error:', err);
  return NextResponse.json(
    {
      success: false,
      code: 'INTERNAL_ERROR',
      error: 'An unexpected internal error occurred.',
    },
    { status: 500 }
  );
}
