import { NextResponse } from 'next/server';
import {
  assertSameOriginCsrf,
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
} from '@/lib/cms/http';
import {
  createEditorialDraft,
  listEditorialArticles,
} from '@/lib/cms/editorialService';
import { requireStaffSession } from '@/lib/cms/staffAuth';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';

const MAX_ARTICLE_JSON_BYTES = 256 * 1024; // 256KB

export async function GET(req: Request) {
  try {
    const staff = await requireStaffSession({ action: 'article:read_unpublished' });
    const url = new URL(req.url);
    const rawQuery: Record<string, unknown> = {};
    for (const key of ['page', 'pageSize', 'status', 'category', 'search', 'sortBy', 'sortOrder']) {
      const val = url.searchParams.get(key);
      if (val !== null && val !== '') {
        rawQuery[key] = val;
      }
    }

    const result = await listEditorialArticles(staff, rawQuery);
    return NextResponse.json(
      { success: true, ...result },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'articles_create', 60, 60_000);
    const staff = await requireStaffSession({ action: 'article:create_draft' });

    const bodyCheck = await readJsonBodyWithLimit(req, MAX_ARTICLE_JSON_BYTES);
    if (!bodyCheck.ok) {
      const status = bodyCheck.status === 413 ? 413 : 400;
      const code = status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST';
      throw new EditorialHttpError(
        status,
        code,
        bodyCheck.error ?? 'Invalid request body.'
      );
    }

    const article = await createEditorialDraft(staff, bodyCheck.data);
    return NextResponse.json({ success: true, article }, { status: 201 });
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
