import { NextResponse } from 'next/server';
import { mapCmsErrorToResponse } from '@/lib/cms/http';
import { requireStaffSession } from '@/lib/cms/staffAuth';
import { listCustomerFeedbackForAdmin } from '@/lib/cms/submissionsService';

export async function GET(req: Request) {
  try {
    const staff = await requireStaffSession({ action: 'submission:read' });
    const url = new URL(req.url);
    const result = await listCustomerFeedbackForAdmin(staff, {
      page: url.searchParams.get('page'),
      pageSize: url.searchParams.get('pageSize'),
      status: url.searchParams.get('status'),
      search: url.searchParams.get('search'),
    });
    return NextResponse.json(
      { success: true, ...result },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
