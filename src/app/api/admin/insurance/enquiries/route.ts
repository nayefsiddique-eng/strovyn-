import { NextResponse } from 'next/server';
import {
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
} from '@/lib/cms/http';
import { requireStaffSession } from '@/lib/cms/staffAuth';
import {
  listAdminInsuranceEnquiries,
  type InsuranceEnquiryStatus,
  type ListInsuranceEnquiriesFilter,
} from '@/lib/cms/insuranceService';

const PRIVATE_NO_STORE = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

export async function GET(req: Request) {
  try {
    await enforceCmsRateLimit(req, 'admin_insurance_enq_list', 60, 60_000);
    const staff = await requireStaffSession({ action: 'insurance:read' });

    const url = new URL(req.url);
    const kindParam = url.searchParams.get('kind') || 'all';
    const statusParam = url.searchParams.get('status') || 'all';
    const searchParam = url.searchParams.get('search') || '';

    const filter: ListInsuranceEnquiriesFilter = {
      search: searchParam.slice(0, 120),
      kind:
        kindParam === 'information_request' ||
        kindParam === 'incident_report' ||
        kindParam === 'urgent'
          ? kindParam
          : 'all',
      status: statusParam as 'all' | InsuranceEnquiryStatus,
    };

    const data = await listAdminInsuranceEnquiries(staff, filter);
    return NextResponse.json(
      { success: true, ...data },
      { headers: PRIVATE_NO_STORE }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
