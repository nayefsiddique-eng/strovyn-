import { NextResponse } from 'next/server';
import {
  getEditorialArticleById,
  updateEditorialArticle,
} from '@/lib/cms/editorialService';
import {
  assertSameOriginCsrf,
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
} from '@/lib/cms/http';
import {
  requireStaffSession,
  resolveAuthenticatedStaff,
} from '@/lib/cms/staffAuth';
import { UuidParamSchema } from '@/lib/cms/validators';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';

const MAX_ARTICLE_UPDATE_BYTES = 256 * 1024; // 256KB

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseArticleId(rawId: string): string {
  const parsed = UuidParamSchema.safeParse(rawId);
  if (!parsed.success) {
    throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid article identifier.');
  }
  return parsed.data;
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const articleId = parseArticleId(id);
    const staff = await requireStaffSession({ action: 'article:read_unpublished' });
    const article = await getEditorialArticleById(staff, articleId);

    return NextResponse.json(
      { success: true, article },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'articles_update', 90, 60_000);

    const { id } = await context.params;
    const articleId = parseArticleId(id);
    const staff = await resolveAuthenticatedStaff();

    const bodyCheck = await readJsonBodyWithLimit(req, MAX_ARTICLE_UPDATE_BYTES);
    if (!bodyCheck.ok) {
      const status = bodyCheck.status === 413 ? 413 : 400;
      const code = status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST';
      throw new EditorialHttpError(
        status,
        code,
        bodyCheck.error ?? 'Invalid request body.'
      );
    }

    const article = await updateEditorialArticle(staff, articleId, bodyCheck.data);
    return NextResponse.json({ success: true, article });
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
