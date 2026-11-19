import { NextResponse } from 'next/server';
import { EditorialHttpError, mapCmsErrorToResponse } from '@/lib/cms/http';
import { getAuthenticatedMediaAccess } from '@/lib/cms/mediaService';
import { requireStaffSession } from '@/lib/cms/staffAuth';
import { UuidParamSchema } from '@/lib/cms/validators';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const PRIVATE_MEDIA_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

export async function GET(req: Request, context: RouteContext) {
  try {
    await requireStaffSession({ action: 'article:read_unpublished' });

    const { id } = await context.params;
    const idCheck = UuidParamSchema.safeParse(id);
    if (!idCheck.success) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid media asset identifier.');
    }

    const access = await getAuthenticatedMediaAccess(idCheck.data);
    if (!access.signedUrl) {
      throw new EditorialHttpError(500, 'STORAGE_ERROR', 'Unable to resolve media delivery URL.');
    }

    const url = new URL(req.url);
    if (url.searchParams.get('format') === 'json') {
      return NextResponse.json(
        {
          success: true,
          id: access.id,
          visibility: access.visibility,
          signedUrl: access.signedUrl,
          signedExpiresAt: access.signedExpiresAt,
        },
        { headers: PRIVATE_MEDIA_HEADERS }
      );
    }

    return NextResponse.redirect(access.signedUrl, {
      status: 307,
      headers: PRIVATE_MEDIA_HEADERS,
    });
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
