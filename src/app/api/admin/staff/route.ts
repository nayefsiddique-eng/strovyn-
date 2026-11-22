import { NextResponse } from 'next/server';
import {
  assertSameOriginCsrf,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
} from '@/lib/cms/http';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';
import { requireStaffSession } from '@/lib/cms/staffAuth';
import {
  inviteEmployee,
  listStaffDirectory,
} from '@/lib/cms/staffManagementService';
import type { EditorialRole } from '@/lib/cms/roles';

const PRIVATE_NO_STORE = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

export async function GET() {
  try {
    const staff = await requireStaffSession({ action: 'staff:manage' });
    const directory = await listStaffDirectory(staff);
    return NextResponse.json(
      { success: true, ...directory },
      { headers: PRIVATE_NO_STORE }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'staff_invite', 20, 60_000);
    const staff = await requireStaffSession({ action: 'staff:manage' });
    const bodyResult = await readJsonBodyWithLimit(req, 16 * 1024);
    const body = (bodyResult.ok && bodyResult.data ? bodyResult.data : {}) as {
      fullName?: string;
      email?: string;
      role?: EditorialRole;
    };

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      new URL(req.url).origin;

    const invitation = await inviteEmployee(staff, {
      fullName: String(body.fullName || ''),
      email: String(body.email || ''),
      role: (body.role || 'editor') as EditorialRole,
      redirectOrigin: origin,
    });

    return NextResponse.json(
      { success: true, invitation },
      { status: 201, headers: PRIVATE_NO_STORE }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
