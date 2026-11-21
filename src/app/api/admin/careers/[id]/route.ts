import { NextResponse } from 'next/server';
import {
  getVacancyByIdForAdmin,
  updateVacancyRecord,
} from '@/lib/cms/careersService';
import {
  assertSameOriginCsrf,
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
  revalidatePublicCareersPaths,
} from '@/lib/cms/http';
import { requireStaffSession, resolveAuthenticatedStaff } from '@/lib/cms/staffAuth';
import { UuidParamSchema } from '@/lib/cms/validators';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';

const MAX_UPDATE_BYTES = 32 * 1024;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseVacancyId(rawId: string): string {
  const parsed = UuidParamSchema.safeParse(rawId);
  if (!parsed.success) {
    throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid vacancy identifier.');
  }
  return parsed.data;
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const vacancyId = parseVacancyId(id);
    const staff = await requireStaffSession({ action: 'career:read' });
    const vacancy = await getVacancyByIdForAdmin(staff, vacancyId);
    return NextResponse.json(
      { success: true, vacancy },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'careers_update', 60, 60_000);

    const { id } = await context.params;
    const vacancyId = parseVacancyId(id);
    const staff = await resolveAuthenticatedStaff();

    const bodyCheck = await readJsonBodyWithLimit(req, MAX_UPDATE_BYTES);
    if (!bodyCheck.ok) {
      throw new EditorialHttpError(
        bodyCheck.status === 413 ? 413 : 400,
        bodyCheck.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        bodyCheck.error ?? 'Invalid request body.'
      );
    }

    const vacancy = await updateVacancyRecord(staff, vacancyId, bodyCheck.data);
    revalidatePublicCareersPaths();
    return NextResponse.json({ success: true, vacancy });
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
