import { NextResponse } from 'next/server';
import { saveAiArticleAsDraft } from '@/lib/cms/aiStudioService';
import {
  assertSameOriginCsrf,
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
} from '@/lib/cms/http';
import { requireStaffSession } from '@/lib/cms/staffAuth';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';

const MAX_SAVE_ARTICLE_BYTES = 64 * 1024;

export async function POST(req: Request) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'ai_studio_save_article', 20, 60_000);

    const staff = await requireStaffSession({ action: 'article:create_draft' });
    const bodyCheck = await readJsonBodyWithLimit(req, MAX_SAVE_ARTICLE_BYTES);
    if (!bodyCheck.ok) {
      throw new EditorialHttpError(
        bodyCheck.status === 413 ? 413 : 400,
        bodyCheck.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        bodyCheck.error ?? 'Invalid request body.'
      );
    }

    const article = await saveAiArticleAsDraft(staff, bodyCheck.data);
    return NextResponse.json(
      { success: true, article },
      {
        status: 201,
        headers: { 'Cache-Control': 'private, no-store' },
      }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
