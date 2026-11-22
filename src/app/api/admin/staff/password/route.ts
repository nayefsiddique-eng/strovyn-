import { NextResponse } from 'next/server';
import {
  assertSameOriginCsrf,
  mapCmsErrorToResponse,
} from '@/lib/cms/http';
import { resolveAuthenticatedStaff } from '@/lib/cms/staffAuth';
import { recordPasswordUpdatedAudit } from '@/lib/cms/staffManagementService';

const PRIVATE_NO_STORE = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

export async function POST(req: Request) {
  try {
    assertSameOriginCsrf(req);
    const staff = await resolveAuthenticatedStaff();
    await recordPasswordUpdatedAudit(staff);
    return NextResponse.json(
      { success: true },
      { headers: PRIVATE_NO_STORE }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
