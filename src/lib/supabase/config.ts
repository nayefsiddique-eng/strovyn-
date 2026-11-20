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

const SUPABASE_JWT_REGEX =
  /^eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/;
const SUPABASE_PUBLISHABLE_KEY_REGEX = /^sb_publishable_[A-Za-z0-9_-]{16,}$/;
const SUPABASE_SECRET_KEY_REGEX = /^sb_secret_[A-Za-z0-9_-]{16,}$/;

function containsTemplatePattern(value: string): boolean {
  const lower = value.toLowerCase();
  return FORBIDDEN_TEMPLATE_PATTERNS.some((pattern) => lower.includes(pattern));
}

export function isValidSupabaseUrl(rawUrl: string | undefined): rawUrl is string {
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

export function isValidSupabaseKeyStructure(
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
 * configuration is valid.
 */
export function isSupabaseAnonConfigured(): boolean {
  return (
    isValidSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    isValidSupabaseKeyStructure(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'anon')
  );
}
