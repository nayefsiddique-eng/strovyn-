import { NextResponse } from 'next/server';
import {
  assertSameOriginCsrf,
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
} from '@/lib/cms/http';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';
import { requireStaffSession } from '@/lib/cms/staffAuth';
import { UuidParamSchema } from '@/lib/cms/validators';
import {
  getAdminInsuranceEnquiryDetail,
  updateAdminInsuranceEnquiry,
  type UpdateAdminInsuranceEnquiryPatch,
} from '@/lib/cms/insuranceService';

const PRIVATE_NO_STORE = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  try {
    await enforceCmsRateLimit(req, 'admin_insurance_enq_detail', 60, 60_000);
    const staff = await requireStaffSession({ action: 'insurance:read' });

    const { id } = await context.params;
    const parsedId = UuidParamSchema.safeParse(id);
    if (!parsedId.success) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid enquiry identifier.');
    }

    const detail = await getAdminInsuranceEnquiryDetail(staff, parsedId.data);
    return NextResponse.json(
      { success: true, enquiry: detail },
      { headers: PRIVATE_NO_STORE }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'admin_insurance_enq_patch', 40, 60_000);
    const staff = await requireStaffSession({ action: 'insurance:manage' });

    const { id } = await context.params;
    const parsedId = UuidParamSchema.safeParse(id);
    if (!parsedId.success) {
      throw new EditorialHttpError(400, 'BAD_REQUEST', 'Invalid enquiry identifier.');
    }

    const bodyResult = await readJsonBodyWithLimit(req, 32 * 1024);
    if (!bodyResult.ok) {
      throw new EditorialHttpError(
        bodyResult.status === 413 ? 413 : 400,
        bodyResult.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        bodyResult.error || 'Invalid JSON request body.'
      );
    }

    const patch = (bodyResult.data ?? {}) as UpdateAdminInsuranceEnquiryPatch;
    const updated = await updateAdminInsuranceEnquiry(staff, parsedId.data, patch);
    return NextResponse.json(
      { success: true, enquiry: updated },
      { headers: PRIVATE_NO_STORE }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
