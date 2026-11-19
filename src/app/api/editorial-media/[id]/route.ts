import { NextResponse } from 'next/server';
import { isServiceRoleConfigured } from '@/lib/supabase/serviceRole';
import { EditorialHttpError } from '@/lib/cms/http';
import { resolvePublishedEditorialMediaBytes } from '@/lib/cms/mediaService';
import { UuidParamSchema } from '@/lib/cms/validators';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const GATED_MEDIA_SECURITY_HEADERS = {
  'Cache-Control': 'private, no-store',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
} as const;

/**
 * Public publication-gated image delivery endpoint.
 * Never exposes private storage objects directly and always enforces live
 * PostgreSQL publication state (`status = 'published'`, `published_at <= NOW()`,
 * authoritative article reference, active non-deleted asset).
 * Archiving or deleting the referencing article/asset revokes access immediately (404).
 */
export async function GET(_req: Request, context: RouteContext) {
  if (!isServiceRoleConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Editorial media service unavailable.' },
      { status: 503, headers: GATED_MEDIA_SECURITY_HEADERS }
    );
  }

  try {
    const { id } = await context.params;
    const idCheck = UuidParamSchema.safeParse(id);
    if (!idCheck.success) {
      return NextResponse.json(
        { success: false, error: 'Media asset not found.' },
        { status: 404, headers: GATED_MEDIA_SECURITY_HEADERS }
      );
    }

    const resolved = await resolvePublishedEditorialMediaBytes(idCheck.data);
    if (!resolved) {
      return NextResponse.json(
        { success: false, error: 'Media asset not found.' },
        { status: 404, headers: GATED_MEDIA_SECURITY_HEADERS }
      );
    }

    return new NextResponse(new Uint8Array(resolved.buffer), {
      status: 200,
      headers: {
        'Content-Type': resolved.mimeType,
        'Content-Length': String(resolved.byteSize),
        ...GATED_MEDIA_SECURITY_HEADERS,
      },
    });
  } catch (err) {
    if (err instanceof EditorialHttpError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status, headers: GATED_MEDIA_SECURITY_HEADERS }
      );
    }
    console.error('[CMS-2.3] Public gated media delivery failed:', err);
    return NextResponse.json(
      { success: false, error: 'Unable to load editorial media asset.' },
      { status: 500, headers: GATED_MEDIA_SECURITY_HEADERS }
    );
  }
}
