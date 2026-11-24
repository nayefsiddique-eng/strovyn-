import { NextResponse } from 'next/server';
import {
  assertSameOriginCsrf,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
} from '@/lib/cms/http';
import { requireStaffSession } from '@/lib/cms/staffAuth';
import {
  resendStaffInvitation,
  resolveTrustedInvitationOrigin,
} from '@/lib/cms/staffManagementService';

const PRIVATE_NO_STORE = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'staff_resend_invite', 20, 60_000);
    const staff = await requireStaffSession({ action: 'staff:manage' });
    const { id } = await context.params;
    const origin = resolveTrustedInvitationOrigin(req.url);

    const invitation = await resendStaffInvitation(staff, id, origin);
    return NextResponse.json(
      { success: true, invitation },
      { headers: PRIVATE_NO_STORE }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
