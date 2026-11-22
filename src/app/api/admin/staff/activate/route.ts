import { NextResponse } from 'next/server';
import {
  assertSameOriginCsrf,
  mapCmsErrorToResponse,
} from '@/lib/cms/http';
import { StaffAuthError } from '@/lib/cms/staffAuth';
import { completeEmployeeActivation } from '@/lib/cms/staffManagementService';
import { createClient as createSessionSupabaseClient } from '@/lib/supabase/server';

const PRIVATE_NO_STORE = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

export async function POST(req: Request) {
  try {
    assertSameOriginCsrf(req);
    const supabase = await createSessionSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw new StaffAuthError(
        401,
        'UNAUTHENTICATED',
        'Open your invitation link from your email first to establish a verified session.'
      );
    }

    const staff = await completeEmployeeActivation({
      id: user.id,
      email: user.email ?? null,
    });

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
      { headers: PRIVATE_NO_STORE }
    );
  } catch (err) {
    return mapCmsErrorToResponse(err);
  }
}
