import { NextResponse } from 'next/server';
import { reorderVacancies } from '@/lib/cms/careersService';
import {
  assertSameOriginCsrf,
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
  revalidatePublicCareersPaths,
} from '@/lib/cms/http';
import { resolveAuthenticatedStaff } from '@/lib/cms/staffAuth';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';

const MAX_REORDER_BYTES = 32 * 1024;

export async function PATCH(req: Request) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'careers_reorder', 60, 60_000);

    const staff = await resolveAuthenticatedStaff();
    const bodyCheck = await readJsonBodyWithLimit(req, MAX_REORDER_BYTES);
    if (!bodyCheck.ok) {
      throw new EditorialHttpError(
        bodyCheck.status === 413 ? 413 : 400,
        bodyCheck.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        bodyCheck.error ?? 'Invalid request body.'
      );
    }

    const result = await reorderVacancies(staff, bodyCheck.data);
    revalidatePublicCareersPaths();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
