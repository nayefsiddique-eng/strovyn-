import { NextResponse } from 'next/server';
import {
  assertSameOriginCsrf,
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
  revalidatePublicPortfolioPaths,
} from '@/lib/cms/http';
import {
  createProjectRecord,
  listProjectsForAdmin,
} from '@/lib/cms/projectsService';
import { requireStaffSession } from '@/lib/cms/staffAuth';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';

const MAX_PROJECT_JSON_BYTES = 64 * 1024;

export async function GET() {
  try {
    const staff = await requireStaffSession({ action: 'project:read' });
    const projects = await listProjectsForAdmin(staff);
    return NextResponse.json(
      { success: true, projects },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'projects_create', 30, 60_000);
    const staff = await requireStaffSession({ action: 'project:create_draft' });

    const bodyCheck = await readJsonBodyWithLimit(req, MAX_PROJECT_JSON_BYTES);
    if (!bodyCheck.ok) {
      const status = bodyCheck.status === 413 ? 413 : 400;
      throw new EditorialHttpError(
        status,
        status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        bodyCheck.error ?? 'Invalid request body.'
      );
    }

    const project = await createProjectRecord(staff, bodyCheck.data);
    revalidatePublicPortfolioPaths(project.slug);
    return NextResponse.json({ success: true, project }, { status: 201 });
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
