import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const FORBIDDEN_TEMPLATE_PATTERNS = [
  'placeholder',
  'your_supabase_',
  'your-supabase-',
  'your_service_role',
  'your-service-role',
  'your_anon',
  'your-anon',
  'your-project',
  'your_project',
  'replace_with',
  'replace-with',
  '_here',
  '-here',
  'example',
  'changeme',
  '<',
  '>',
] as const;

// Standard Supabase JWT (3 base64url segments starting with header `eyJ`)
const SUPABASE_JWT_REGEX =
  /^eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/;
// Modern Supabase API keys
const SUPABASE_PUBLISHABLE_KEY_REGEX = /^sb_publishable_[A-Za-z0-9_-]{16,}$/;
const SUPABASE_SECRET_KEY_REGEX = /^sb_secret_[A-Za-z0-9_-]{16,}$/;

function containsTemplatePattern(value: string): boolean {
  const lower = value.toLowerCase();
  return FORBIDDEN_TEMPLATE_PATTERNS.some((pattern) => lower.includes(pattern));
}

function isValidSupabaseUrl(rawUrl: string | undefined): rawUrl is string {
  if (!rawUrl) return false;
  const trimmed = rawUrl.trim();
  if (!trimmed || containsTemplatePattern(trimmed)) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.username || parsed.password) return false;

    const isLocalHost =
      parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    const isHttps = parsed.protocol === 'https:' && parsed.hostname.includes('.');
    const isLocalHttp = parsed.protocol === 'http:' && isLocalHost;

    return isHttps || isLocalHttp;
  } catch {
    return false;
  }
}

function isValidKeyStructure(
  rawKey: string | undefined,
  expectedKind: 'anon' | 'service_role'
): rawKey is string {
  if (!rawKey) return false;
  const trimmed = rawKey.trim();
  if (!trimmed || /\s/.test(trimmed) || containsTemplatePattern(trimmed)) {
    return false;
  }

  if (SUPABASE_JWT_REGEX.test(trimmed)) {
    return true;
  }

  if (expectedKind === 'anon') {
    return SUPABASE_PUBLISHABLE_KEY_REGEX.test(trimmed);
  }

  return SUPABASE_SECRET_KEY_REGEX.test(trimmed);
}

/**
 * Checks whether standard Supabase URL + public anon/publishable key
 * configuration is valid (needed by server-side `supabase.auth.getUser()`).
 */
export function isSupabaseAnonConfigured(): boolean {
  return (
    isValidSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    isValidKeyStructure(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'anon')
  );
}

/**
 * Checks whether the server-only Supabase service-role configuration is present.
 * Never falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export function isServiceRoleConfigured(): boolean {
  return (
    isValidSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    isValidKeyStructure(process.env.SUPABASE_SERVICE_ROLE_KEY, 'service_role')
  );
}

/**
 * Checks whether BOTH normal Supabase Auth client configuration and
 * server-only service-role configuration are valid before authenticating staff.
 */
export function isCmsSupabaseConfigured(): boolean {
  return isSupabaseAnonConfigured() && isServiceRoleConfigured();
}

/**
 * Creates a privileged server-only Supabase client authenticated with
 * `SUPABASE_SERVICE_ROLE_KEY`. Bypasses RLS and must ONLY be called after
 * verifying caller authorization (verified Supabase Auth session + active
 * `staff_users` role, or authenticated cron secret).
 */
export function createServiceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (
    !isValidSupabaseUrl(url) ||
    !isValidKeyStructure(serviceRoleKey, 'service_role')
  ) {
    throw new Error(
      'Supabase service-role client is unavailable due to missing or invalid server configuration.'
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
