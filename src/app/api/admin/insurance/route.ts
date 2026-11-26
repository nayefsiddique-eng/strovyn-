import { NextResponse } from 'next/server';
import {
  assertSameOriginCsrf,
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
} from '@/lib/cms/http';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';
import { requireStaffSession } from '@/lib/cms/staffAuth';
import {
  getAdminInsuranceRecord,
  saveAdminInsuranceRecord,
  type UpdateInsuranceInput,
} from '@/lib/cms/insuranceService';

const PRIVATE_NO_STORE = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

export async function GET() {
  try {
    const staff = await requireStaffSession({ action: 'insurance:read' });
    const record = await getAdminInsuranceRecord(staff);
    return NextResponse.json(
      { success: true, insurance: record },
      { headers: PRIVATE_NO_STORE }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'admin_insurance_save', 30, 60_000);
    const staff = await requireStaffSession({ action: 'insurance:manage' });

    const bodyResult = await readJsonBodyWithLimit(req, 32 * 1024);
    if (!bodyResult.ok) {
      throw new EditorialHttpError(
        bodyResult.status === 413 ? 413 : 400,
        bodyResult.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        bodyResult.error || 'Invalid JSON request body.'
      );
    }

    const body = (bodyResult.data ?? {}) as UpdateInsuranceInput;
    const record = await saveAdminInsuranceRecord(staff, body);

    return NextResponse.json(
      { success: true, insurance: record },
      { status: 200, headers: PRIVATE_NO_STORE }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
