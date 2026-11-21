import { NextResponse } from 'next/server';
import {
  assertSameOriginCsrf,
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
  revalidatePublicPortfolioPaths,
} from '@/lib/cms/http';
import {
  getProjectByIdForAdmin,
  updateProjectRecord,
} from '@/lib/cms/projectsService';
import { requireStaffSession, resolveAuthenticatedStaff } from '@/lib/cms/staffAuth';
import { UuidParamSchema } from '@/lib/cms/validators';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';

const MAX_PROJECT_UPDATE_BYTES = 64 * 1024;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseProjectId(rawId: string): string {
  const parsed = UuidParamSchema.safeParse(rawId);
  if (!parsed.success) {
    throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid project identifier.');
  }
  return parsed.data;
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const projectId = parseProjectId(id);
    const staff = await requireStaffSession({ action: 'project:read' });
    const project = await getProjectByIdForAdmin(staff, projectId);
    return NextResponse.json(
      { success: true, project },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'projects_update', 60, 60_000);

    const { id } = await context.params;
    const projectId = parseProjectId(id);
    const staff = await resolveAuthenticatedStaff();

    const bodyCheck = await readJsonBodyWithLimit(req, MAX_PROJECT_UPDATE_BYTES);
    if (!bodyCheck.ok) {
      const status = bodyCheck.status === 413 ? 413 : 400;
      throw new EditorialHttpError(
        status,
        status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        bodyCheck.error ?? 'Invalid request body.'
      );
    }

    const project = await updateProjectRecord(staff, projectId, bodyCheck.data);
    revalidatePublicPortfolioPaths(project.slug);
    return NextResponse.json({ success: true, project });
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
