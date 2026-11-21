import { NextResponse } from 'next/server';
import { assertCronAuthorized, CRON_NO_STORE_HEADERS } from '@/lib/cms/cronAuth';
import { EditorialHttpError } from '@/lib/cms/http';
import { cleanupExpiredCustomerDocumentUploads } from '@/lib/db/mockData';

async function handleCleanupUploads(req: Request) {
  try {
    assertCronAuthorized(req);

    const url = new URL(req.url);
    const limitParam = url.searchParams.get('limit');
    const graceParam = url.searchParams.get('graceSeconds');

    const limit =
      limitParam !== null && /^\d+$/.test(limitParam)
        ? Math.min(Math.max(Number(limitParam), 1), 200)
        : 50;
    const graceSeconds =
      graceParam !== null && /^\d+$/.test(graceParam)
        ? Math.min(Math.max(Number(graceParam), 0), 86400)
        : 0;

    const summary = await cleanupExpiredCustomerDocumentUploads({
      limit,
      graceSeconds,
    });

    return NextResponse.json(
      {
        success: true,
        job: 'cleanup_expired_customer_uploads',
        ...summary,
      },
      { status: 200, headers: CRON_NO_STORE_HEADERS }
    );
  } catch (err) {
    if (err instanceof EditorialHttpError) {
      return NextResponse.json(
        {
          success: false,
          code: err.code,
          error: err.message,
        },
        { status: err.status, headers: CRON_NO_STORE_HEADERS }
      );
    }
    return NextResponse.json(
      {
        success: false,
        code: 'INTERNAL_ERROR',
        error: 'Unexpected cron execution error.',
      },
      { status: 500, headers: CRON_NO_STORE_HEADERS }
    );
  }
}

export async function POST(req: Request) {
  return handleCleanupUploads(req);
}
