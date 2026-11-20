import { NextResponse } from 'next/server';
import {
  assertSameOriginCsrf,
  mapCmsErrorToResponse,
} from '@/lib/cms/http';
import { resolveAuthenticatedStaff } from '@/lib/cms/staffAuth';
import { createClient as createSessionSupabaseClient } from '@/lib/supabase/server';

const PRIVATE_SESSION_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

/**
 * Verifies the caller's Supabase Auth cookie session against `staff_users`
 * and returns a minimal role projection for client UI hydration.
 */
export async function GET() {
  try {
    const staff = await resolveAuthenticatedStaff();
    return NextResponse.json(
      {
        success: true,
        staff: {
          id: staff.id,
          email: staff.email,
          full_name: staff.full_name,
          role: staff.role,
        },
      },
      { headers: PRIVATE_SESSION_HEADERS }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}

/**
 * Signs out the active Supabase Auth SSR session with fail-closed same-origin CSRF verification.
 */
export async function DELETE(req: Request) {
  try {
    assertSameOriginCsrf(req);
    const supabase = await createSessionSupabaseClient();
    await supabase.auth.signOut();
    return NextResponse.json(
      { success: true, signedOut: true },
      { headers: PRIVATE_SESSION_HEADERS }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
