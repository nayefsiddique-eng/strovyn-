import { NextResponse } from 'next/server';
import { transitionEditorialArticle } from '@/lib/cms/editorialService';
import {
  assertSameOriginCsrf,
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
  revalidatePublicInsightsPaths,
} from '@/lib/cms/http';
import { resolveAuthenticatedStaff } from '@/lib/cms/staffAuth';
import { UuidParamSchema } from '@/lib/cms/validators';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';

const MAX_TRANSITION_JSON_BYTES = 16 * 1024; // 16KB

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, context: RouteContext) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'articles_transition', 60, 60_000);

    const { id } = await context.params;
    const idParsed = UuidParamSchema.safeParse(id);
    if (!idParsed.success) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid article identifier.');
    }

    const staff = await resolveAuthenticatedStaff();
    const bodyCheck = await readJsonBodyWithLimit(req, MAX_TRANSITION_JSON_BYTES);
    if (!bodyCheck.ok) {
      const status = bodyCheck.status === 413 ? 413 : 400;
      const code = status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST';
      throw new EditorialHttpError(
        status,
        code,
        bodyCheck.error ?? 'Invalid request body.'
      );
    }

    const article = await transitionEditorialArticle(
      staff,
      idParsed.data,
      bodyCheck.data
    );
    revalidatePublicInsightsPaths(typeof article.slug === 'string' ? article.slug : null);
    return NextResponse.json({ success: true, article });
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
