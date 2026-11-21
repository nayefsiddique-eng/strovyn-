import { NextResponse } from 'next/server';
import {
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
} from '@/lib/cms/http';
import { requireStaffSession } from '@/lib/cms/staffAuth';
import { downloadAuthorizedSubmissionAttachment } from '@/lib/cms/submissionsService';
import { UuidParamSchema } from '@/lib/cms/validators';

type RouteContext = {
  params: Promise<{ table: string; id: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  try {
    await enforceCmsRateLimit(req, 'submissions_attachment_download', 30, 60_000);

    const { table, id } = await context.params;
    if (table !== 'quotes' && table !== 'applications') {
      throw new EditorialHttpError(
        400,
        'BAD_REQUEST',
        'Invalid submission attachment table.'
      );
    }

    const parsedId = UuidParamSchema.safeParse(id);
    if (!parsedId.success) {
      throw new EditorialHttpError(
        400,
        'BAD_REQUEST',
        'Invalid submission identifier.'
      );
    }

    const staff = await requireStaffSession({
      action: 'submission:download_attachment',
    });

    const { bytes, mimeType, fileName } =
      await downloadAuthorizedSubmissionAttachment(staff, table, parsedId.data);

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(bytes.byteLength),
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
    });
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
