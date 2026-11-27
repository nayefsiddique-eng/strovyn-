import { NextResponse } from 'next/server';
import {
  assertSameOriginCsrf,
  EditorialHttpError,
  mapCmsErrorToResponse,
} from '@/lib/cms/http';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import {
  submitPublicInsuranceEnquiry,
  type PublicInsuranceSubmissionInput,
  type UploadedPhotoBuffer,
} from '@/lib/cms/insuranceService';

const PRIVATE_NO_STORE = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

export async function GET() {
  return NextResponse.json(
    { success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } },
    { status: 405, headers: PRIVATE_NO_STORE }
  );
}

export async function POST(req: Request) {
  try {
    assertSameOriginCsrf(req);

    const clientIp =
      req.headers.get('x-nf-client-connection-ip')?.trim() ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'local-client';

    // Strict server-side rate limiting: max 6 submissions per 10 minutes per IP
    const rate = await checkRateLimit(`public_insurance_enq_${clientIp}`, 6, 10 * 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message:
              'Too many insurance submissions from your connection. Please wait a few minutes or contact our Adelaide team on WhatsApp (+61 406 646 061).',
          },
        },
        { status: 429, headers: PRIVATE_NO_STORE }
      );
    }

    const contentType = (req.headers.get('content-type') || '').toLowerCase();
    const headerIdem = req.headers.get('idempotency-key')?.trim() || null;

    let input: PublicInsuranceSubmissionInput;
    const photos: UploadedPhotoBuffer[] = [];

    if (contentType.includes('multipart/form-data')) {
      const contentLength = Number(req.headers.get('content-length') || 0);
      if (contentLength > 24 * 1024 * 1024) {
        throw new EditorialHttpError(
          413,
          'PAYLOAD_TOO_LARGE',
          'Submission exceeds the maximum size limit of 20 MB.'
        );
      }

      const form = await req.formData();
      input = {
        enquiry_kind: String(form.get('enquiry_kind') || ''),
        full_name: String(form.get('full_name') || ''),
        email: String(form.get('email') || ''),
        phone: form.get('phone') ? String(form.get('phone')) : null,
        project_location: form.get('project_location') ? String(form.get('project_location')) : null,
        request_type: form.get('request_type') ? String(form.get('request_type')) : null,
        message: form.get('message') ? String(form.get('message')) : null,
        incident_date: form.get('incident_date') ? String(form.get('incident_date')) : null,
        incident_category: form.get('incident_category') ? String(form.get('incident_category')) : null,
        incident_description: form.get('incident_description')
          ? String(form.get('incident_description'))
          : null,
        disclaimer_acknowledged:
          String(form.get('disclaimer_acknowledged') || '').toLowerCase() === 'true',
        idempotency_key: form.get('idempotency_key')
          ? String(form.get('idempotency_key'))
          : headerIdem,
        website: form.get('website') ? String(form.get('website')) : null,
      };

      const fileEntries = form.getAll('photos');
      for (const entry of fileEntries) {
        if (entry instanceof Blob && entry.size > 0) {
          const buf = Buffer.from(await entry.arrayBuffer());
          const fileName = (entry as { name?: string }).name || 'incident-photo.jpg';
          photos.push({
            buffer: buf,
            originalName: fileName,
            mimeType: entry.type || 'application/octet-stream',
          });
        }
      }
    } else if (contentType.includes('application/json')) {
      const bodyResult = await readJsonBodyWithLimit(req, 32 * 1024);
      if (!bodyResult.ok) {
        throw new EditorialHttpError(
          bodyResult.status === 413 ? 413 : 400,
          bodyResult.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
          bodyResult.error || 'Invalid JSON submission body.'
        );
      }
      const raw = (bodyResult.data ?? {}) as Record<string, unknown>;
      input = {
        enquiry_kind: String(raw.enquiry_kind || ''),
        full_name: String(raw.full_name || ''),
        email: String(raw.email || ''),
        phone: raw.phone ? String(raw.phone) : null,
        project_location: raw.project_location ? String(raw.project_location) : null,
        request_type: raw.request_type ? String(raw.request_type) : null,
        message: raw.message ? String(raw.message) : null,
        incident_date: raw.incident_date ? String(raw.incident_date) : null,
        incident_category: raw.incident_category ? String(raw.incident_category) : null,
        incident_description: raw.incident_description ? String(raw.incident_description) : null,
        disclaimer_acknowledged: raw.disclaimer_acknowledged === true,
        idempotency_key: raw.idempotency_key ? String(raw.idempotency_key) : headerIdem,
        website: raw.website ? String(raw.website) : null,
      };
    } else {
      throw new EditorialHttpError(
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        'Expected application/json or multipart/form-data.'
      );
    }

    const result = await submitPublicInsuranceEnquiry(input, photos);
    return NextResponse.json(
      {
        success: true,
        submission: {
          referenceCode: result.referenceCode,
          enquiryKind: result.enquiryKind,
          attachmentCount: result.attachmentCount,
          createdAt: result.createdAt,
        },
      },
      { status: result.deduplicated ? 200 : 201, headers: PRIVATE_NO_STORE }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
