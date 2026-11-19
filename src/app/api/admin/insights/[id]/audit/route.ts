import { NextResponse } from 'next/server';
import { getArticleAuditHistory } from '@/lib/cms/editorialService';
import { EditorialHttpError, mapCmsErrorToResponse } from '@/lib/cms/http';
import { requireStaffSession } from '@/lib/cms/staffAuth';
import { UuidParamSchema } from '@/lib/cms/validators';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const idParsed = UuidParamSchema.safeParse(id);
    if (!idParsed.success) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid article identifier.');
    }

    await requireStaffSession({ action: 'article:read_unpublished' });
    const audit = await getArticleAuditHistory(idParsed.data);

    return NextResponse.json(
      { success: true, ...audit },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
