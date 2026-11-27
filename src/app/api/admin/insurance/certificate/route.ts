import { NextResponse } from 'next/server';
import {
  assertSameOriginCsrf,
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
} from '@/lib/cms/http';
import { requireStaffSession } from '@/lib/cms/staffAuth';
import {
  downloadComplianceCertificate,
  uploadComplianceCertificate,
} from '@/lib/cms/insuranceService';

export async function POST(req: Request) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'admin_insurance_cert_upload', 10, 60_000);
    const staff = await requireStaffSession({ action: 'insurance:manage' });

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', 'A valid file blob is required.');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = (file as { name?: string }).name || 'certificate.pdf';
    const mimeType = file.type || 'application/pdf';

    const result = await uploadComplianceCertificate(staff, {
      buffer,
      fileName,
      mimeType,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}

export async function GET(req: Request) {
  try {
    await enforceCmsRateLimit(req, 'admin_insurance_cert_download', 30, 60_000);
    const staff = await requireStaffSession({ action: 'insurance:read' });

    const url = new URL(req.url);
    const path = url.searchParams.get('path');

    if (!path) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', 'Missing path parameter.');
    }

    const { bytes, mimeType, fileName } = await downloadComplianceCertificate(staff, path);

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
