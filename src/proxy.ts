import { createServerClient } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { escapeHtml } from '@/lib/security/escapeHtml';
import {
  requireStaffSession,
  StaffAuthError,
} from '@/lib/cms/staffAuth';
import {
  createServiceRoleClient,
  isCmsSupabaseConfigured,
} from '@/lib/supabase/serviceRole';

const PREVIEW_SECURITY_HEADERS: Record<string, string> = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

function applyPreviewSecurityHeaders(res: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(PREVIEW_SECURITY_HEADERS)) {
    res.headers.set(key, value);
  }
  return res;
}

function buildAuthErrorHtmlResponse(
  status: number,
  title: string,
  message: string
): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="robots" content="noindex, nofollow, noarchive" />
  <title>${escapeHtml(title)} | STROVYN</title>
</head>
<body style="margin:0;background:#F7F5F0;color:#1D1D1B;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;">
  <main style="max-width:520px;width:100%;background:#FFFFFF;border:1px solid rgba(154,148,138,0.4);padding:32px;">
    <p style="margin:0 0 12px 0;font-family:monospace;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:#8E6B47;">STROVYN EDITORIAL PREVIEW</p>
    <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:500;">${escapeHtml(title)}</h1>
    <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:rgba(29,29,27,0.78);">${escapeHtml(message)}</p>
    <a href="/insights" style="display:inline-block;padding:10px 18px;border:1px solid #1D1D1B;color:#1D1D1B;text-decoration:none;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;">Return to Public Insights</a>
  </main>
</body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...PREVIEW_SECURITY_HEADERS,
    },
  });
}

export async function proxy(request: NextRequest) {
  const cookiesToApply: Array<{
    name: string;
    value: string;
    options?: Record<string, unknown>;
  }> = [];

  try {
    await requireStaffSession(
      { action: 'article:read_unpublished' },
      {
        isConfigured: isCmsSupabaseConfigured,
        getAuthenticatedUser: async () => {
          try {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
            const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
            const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
              cookies: {
                getAll() {
                  return request.cookies.getAll();
                },
                setAll(cookiesList) {
                  cookiesToApply.push(...cookiesList);
                },
              },
            });
            const {
              data: { user },
              error,
            } = await supabase.auth.getUser();
            if (error || !user) return null;
            return { id: user.id, email: user.email ?? null };
          } catch {
            throw new StaffAuthError(
              503,
              'AUTH_SERVICE_UNAVAILABLE',
              'Unable to verify staff authentication session.'
            );
          }
        },
        findStaffByAuthUserId: async (authUserId) => {
          const serviceClient = createServiceRoleClient();
          const { data, error } = await serviceClient
            .from('staff_users')
            .select(
              'id, auth_user_id, email, full_name, role, is_active, last_login_at, created_at, updated_at'
            )
            .eq('auth_user_id', authUserId)
            .maybeSingle();

          if (error) {
            throw new StaffAuthError(
              500,
              'STAFF_LOOKUP_FAILED',
              'Unable to verify staff authorization record.'
            );
          }
          return data ?? null;
        },
      }
    );

    const nextRes = applyPreviewSecurityHeaders(NextResponse.next());
    for (const c of cookiesToApply) {
      nextRes.cookies.set(c.name, c.value, c.options);
    }
    return nextRes;
  } catch (err) {
    if (err instanceof StaffAuthError) {
      const heading =
        err.status === 401
          ? 'Staff Authentication Required'
          : err.status === 403
            ? 'Editorial Preview Forbidden'
            : 'Editorial Service Unavailable';
      return buildAuthErrorHtmlResponse(err.status, heading, err.message);
    }

    return buildAuthErrorHtmlResponse(
      503,
      'Editorial Service Unavailable',
      'Unable to verify active editorial staff credentials.'
    );
  }
}

export const config = {
  matcher: ['/admin/insights/preview/:path*'],
};
