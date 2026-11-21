import { NextResponse } from 'next/server';
import { applyAiSuggestionsToProject } from '@/lib/cms/aiStudioService';
import {
  assertSameOriginCsrf,
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
  revalidatePublicPortfolioPaths,
} from '@/lib/cms/http';
import { requireStaffSession } from '@/lib/cms/staffAuth';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';

const MAX_APPLY_PROJECT_BYTES = 64 * 1024;

export async function POST(req: Request) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'ai_studio_apply_project', 30, 60_000);

    const staff = await requireStaffSession({ action: 'ai_studio:use' });
    const bodyCheck = await readJsonBodyWithLimit(req, MAX_APPLY_PROJECT_BYTES);
    if (!bodyCheck.ok) {
      throw new EditorialHttpError(
        bodyCheck.status === 413 ? 413 : 400,
        bodyCheck.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        bodyCheck.error ?? 'Invalid request body.'
      );
    }

    const project = await applyAiSuggestionsToProject(staff, bodyCheck.data);
    if (project.visibility_status === 'published') {
      revalidatePublicPortfolioPaths(project.slug);
    }
    return NextResponse.json(
      { success: true, project },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
