import { NextResponse } from 'next/server';
import { setVacancyPublicationStatus } from '@/lib/cms/careersService';
import {
  assertSameOriginCsrf,
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
  revalidatePublicCareersPaths,
} from '@/lib/cms/http';
import { resolveAuthenticatedStaff } from '@/lib/cms/staffAuth';
import { UuidParamSchema } from '@/lib/cms/validators';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';

const MAX_PUBLISH_BYTES = 16 * 1024;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, context: RouteContext) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'careers_publish', 60, 60_000);

    const { id } = await context.params;
    const parsedId = UuidParamSchema.safeParse(id);
    if (!parsedId.success) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid vacancy identifier.');
    }

    const staff = await resolveAuthenticatedStaff();
    const bodyCheck = await readJsonBodyWithLimit(req, MAX_PUBLISH_BYTES);
    if (!bodyCheck.ok) {
      throw new EditorialHttpError(
        bodyCheck.status === 413 ? 413 : 400,
        bodyCheck.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        bodyCheck.error ?? 'Invalid request body.'
      );
    }

    const vacancy = await setVacancyPublicationStatus(
      staff,
      parsedId.data,
      bodyCheck.data
    );
    revalidatePublicCareersPaths();
    return NextResponse.json({ success: true, vacancy });
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
