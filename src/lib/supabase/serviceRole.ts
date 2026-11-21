import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertEnvironmentIsolation } from '@/lib/config/envIsolation';
import {
  isSupabaseAnonConfigured,
  isValidSupabaseKeyStructure,
  isValidSupabaseUrl,
} from './config';

export { isSupabaseAnonConfigured };

/**
 * Checks whether the server-only Supabase service-role configuration is present.
 * Never falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export function isServiceRoleConfigured(): boolean {
  return (
    isValidSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    isValidSupabaseKeyStructure(process.env.SUPABASE_SERVICE_ROLE_KEY, 'service_role')
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

  assertEnvironmentIsolation({ supabaseUrl: url });

  if (
    !isValidSupabaseUrl(url) ||
    !isValidSupabaseKeyStructure(serviceRoleKey, 'service_role')
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
