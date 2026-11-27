import { NextResponse } from 'next/server';
import {
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
} from '@/lib/cms/http';
import { requireStaffSession } from '@/lib/cms/staffAuth';
import {
  exportAdminInsuranceEnquiriesCsv,
  type InsuranceEnquiryStatus,
  type ListInsuranceEnquiriesFilter,
} from '@/lib/cms/insuranceService';

export async function GET(req: Request) {
  try {
    await enforceCmsRateLimit(req, 'admin_insurance_export', 10, 60_000);
    const staff = await requireStaffSession({ action: 'insurance:export' });

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

    const { csv, filename } = await exportAdminInsuranceEnquiriesCsv(staff, filter);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
    });
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
