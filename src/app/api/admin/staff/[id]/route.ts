import { NextResponse } from 'next/server';
import {
  assertSameOriginCsrf,
  EditorialHttpError,
  enforceCmsRateLimit,
  mapCmsErrorToResponse,
} from '@/lib/cms/http';
import { readJsonBodyWithLimit } from '@/lib/security/requestLimits';
import { requireStaffSession } from '@/lib/cms/staffAuth';
import { updateStaffMember } from '@/lib/cms/staffManagementService';
import type { EditorialRole } from '@/lib/cms/roles';

const PRIVATE_NO_STORE = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOriginCsrf(req);
    await enforceCmsRateLimit(req, 'staff_update', 30, 60_000);
    const staff = await requireStaffSession({ action: 'staff:manage' });
    const { id } = await context.params;
    const bodyResult = await readJsonBodyWithLimit(req, 16 * 1024);
    if (!bodyResult.ok) {
      throw new EditorialHttpError(
        bodyResult.status === 413 ? 413 : 400,
        bodyResult.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        bodyResult.error || 'Invalid JSON request body.'
      );
    }
    const body = (bodyResult.data ?? {}) as {
      role?: EditorialRole;
      isActive?: boolean;
    };

    const updated = await updateStaffMember(staff, id, {
      role: body.role,
      isActive: body.isActive,
    });

    return NextResponse.json(
      { success: true, staff: updated },
      { headers: PRIVATE_NO_STORE }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
