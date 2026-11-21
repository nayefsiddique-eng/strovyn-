import { NextResponse } from 'next/server';
import {
  assertSameOriginCsrf,
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
} from '@/lib/cms/http';
import { requireStaffSession, resolveAuthenticatedStaff } from '@/lib/cms/staffAuth';
import {
  getQuoteRequestByIdForAdmin,
  updateQuoteRequestForAdmin,
} from '@/lib/cms/submissionsService';
import { UuidParamSchema } from '@/lib/cms/validators';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';

const MAX_UPDATE_BYTES = 16 * 1024;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const parsedId = UuidParamSchema.safeParse(id);
    if (!parsedId.success) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid quote identifier.');
    }
    const staff = await requireStaffSession({ action: 'submission:read' });
    const quote = await getQuoteRequestByIdForAdmin(staff, parsedId.data);
    return NextResponse.json(
      { success: true, quote },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'submissions_quotes_update', 60, 60_000);

    const { id } = await context.params;
    const parsedId = UuidParamSchema.safeParse(id);
    if (!parsedId.success) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid quote identifier.');
    }

    const staff = await resolveAuthenticatedStaff();
    const bodyCheck = await readJsonBodyWithLimit(req, MAX_UPDATE_BYTES);
    if (!bodyCheck.ok) {
      throw new EditorialHttpError(
        bodyCheck.status === 413 ? 413 : 400,
        bodyCheck.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        bodyCheck.error ?? 'Invalid request body.'
      );
    }

    const quote = await updateQuoteRequestForAdmin(
      staff,
      parsedId.data,
      bodyCheck.data
    );
    return NextResponse.json(
      { success: true, quote },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
