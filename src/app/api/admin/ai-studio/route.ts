import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  getAiProviderStatus,
  getAiUsageSnapshot,
} from '@/lib/cms/aiStudioProvider';
import { generateAiStudioContent } from '@/lib/cms/aiStudioService';
import {
  assertSameOriginCsrf,
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
} from '@/lib/cms/http';
import { requireStaffSession } from '@/lib/cms/staffAuth';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';

const MAX_AI_REQUEST_BYTES = 32 * 1024;

export async function GET() {
  try {
    const staff = await requireStaffSession({ action: 'ai_studio:use' });
    return NextResponse.json(
      {
        success: true,
        provider: getAiProviderStatus(),
        usage: getAiUsageSnapshot(staff.id),
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'ai_studio_generate', 20, 60_000);

    const staff = await requireStaffSession({ action: 'ai_studio:use' });
    const bodyCheck = await readJsonBodyWithLimit(req, MAX_AI_REQUEST_BYTES);
    if (!bodyCheck.ok) {
      throw new EditorialHttpError(
        bodyCheck.status === 413 ? 413 : 400,
        bodyCheck.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        bodyCheck.error ?? 'Some project details need attention. Review the highlighted fields.',
        undefined,
        { requestId, retryable: false }
      );
    }

    const result = await generateAiStudioContent(staff, bodyCheck.data, { requestId });
    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    if (err instanceof EditorialHttpError && !err.requestId) {
      err.requestId = requestId;
    }
    return mapCmsErrorToResponse(err);
  }
}
