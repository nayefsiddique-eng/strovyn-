import { NextResponse } from 'next/server';
import {
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
} from '@/lib/cms/http';
import { requireStaffSession } from '@/lib/cms/staffAuth';
import { UuidParamSchema } from '@/lib/cms/validators';
import { downloadAdminIncidentAttachment } from '@/lib/cms/insuranceService';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  try {
    await enforceCmsRateLimit(req, 'admin_incident_attachment_dl', 30, 60_000);
    const staff = await requireStaffSession({ action: 'insurance:read' });

    const { id } = await context.params;
    const parsedId = UuidParamSchema.safeParse(id);
    if (!parsedId.success) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid attachment identifier.');
    }

    const { bytes, mimeType, fileName } = await downloadAdminIncidentAttachment(
      staff,
      parsedId.data
    );

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
