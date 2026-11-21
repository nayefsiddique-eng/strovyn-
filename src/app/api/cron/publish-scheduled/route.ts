import { NextResponse } from 'next/server';
import { assertCronAuthorized, CRON_NO_STORE_HEADERS } from '@/lib/cms/cronAuth';
import { EditorialHttpError } from '@/lib/cms/http';
import { runScheduledArticlePublisher } from '@/lib/cms/scheduledPublisherService';

async function handlePublishScheduled(req: Request) {
  try {
    assertCronAuthorized(req);

    const url = new URL(req.url);
    const limitParam = url.searchParams.get('limit');
    const limit =
      limitParam !== null && /^\d+$/.test(limitParam)
        ? Math.min(Math.max(Number(limitParam), 1), 100)
        : 25;

    const summary = await runScheduledArticlePublisher({ limit });
    return NextResponse.json(
      {
        success: true,
        job: 'publish_scheduled_articles',
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
  return handlePublishScheduled(req);
}
