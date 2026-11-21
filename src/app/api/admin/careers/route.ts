import { NextResponse } from 'next/server';
import {
  createVacancyDraft,
  listVacanciesForAdmin,
} from '@/lib/cms/careersService';
import {
  assertSameOriginCsrf,
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
} from '@/lib/cms/http';
import { requireStaffSession, resolveAuthenticatedStaff } from '@/lib/cms/staffAuth';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';

const MAX_CREATE_BYTES = 32 * 1024;

export async function GET(req: Request) {
  try {
    const staff = await requireStaffSession({ action: 'career:read' });
    const url = new URL(req.url);
    const filter = url.searchParams.get('filter');
    const search = url.searchParams.get('search');

    const vacancies = await listVacanciesForAdmin(staff, { filter, search });
    return NextResponse.json(
      { success: true, vacancies },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'careers_create', 30, 60_000);

    const staff = await resolveAuthenticatedStaff();
    const bodyCheck = await readJsonBodyWithLimit(req, MAX_CREATE_BYTES);
    if (!bodyCheck.ok) {
      throw new EditorialHttpError(
        bodyCheck.status === 413 ? 413 : 400,
        bodyCheck.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        bodyCheck.error ?? 'Invalid request body.'
      );
    }

    const vacancy = await createVacancyDraft(staff, bodyCheck.data);
    return NextResponse.json({ success: true, vacancy }, { status: 201 });
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
