import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  isSupabaseAnonConfigured,
  isValidSupabaseKeyStructure,
  isValidSupabaseUrl,
} from './config';

export const isPublicSupabaseConfigured = isSupabaseAnonConfigured;

/**
 * Creates a cookie-free anonymous Supabase client strictly for public read
 * paths (`status = 'published'`). Uses only the public anon key.
 */
export function createPublicSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (
    !isValidSupabaseUrl(url) ||
    !isValidSupabaseKeyStructure(anonKey, 'anon')
  ) {
    throw new Error(
      'Public Supabase client is unavailable due to missing or invalid configuration.'
    );
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
