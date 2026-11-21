export type CronEndpointPath =
  | '/api/cron/publish-scheduled'
  | '/api/cron/cleanup-uploads'
  | '/api/cron/process-email-outbox';

export interface CronAdapterResult {
  ok: boolean;
  skipped?: boolean;
  status: number;
  endpoint: CronEndpointPath;
  body?: unknown;
  error?: string;
}

export function resolveCronTargetBaseUrl(): string | null {
  const raw =
    process.env.URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    '';
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function isNetlifyCronEnabled(
  endpoint: CronEndpointPath,
  envOverrides?: Record<string, string | undefined>
): { enabled: boolean; reason?: string } {
  const env = envOverrides ?? process.env;
  const netlifyContext = env.CONTEXT?.trim().toLowerCase();

  if (netlifyContext && netlifyContext !== 'production') {
    return {
      enabled: false,
      reason: `Scheduled cron jobs are disabled in '${netlifyContext}' context.`,
    };
  }

  if (env.STROVYN_CRON_ENABLED?.trim().toLowerCase() !== 'true') {
    return {
      enabled: false,
      reason: 'Scheduled cron execution is disabled (set STROVYN_CRON_ENABLED=true to enable).',
    };
  }

  if (
    endpoint === '/api/cron/publish-scheduled' &&
    env.STROVYN_CRON_PUBLISH_ENABLED?.trim().toLowerCase() === 'false'
  ) {
    return { enabled: false, reason: 'Scheduled article publisher is explicitly disabled.' };
  }

  if (
    endpoint === '/api/cron/cleanup-uploads' &&
    env.STROVYN_CRON_CLEANUP_ENABLED?.trim().toLowerCase() === 'false'
  ) {
    return { enabled: false, reason: 'Scheduled upload cleanup is explicitly disabled.' };
  }

  if (
    endpoint === '/api/cron/process-email-outbox' &&
    env.STROVYN_CRON_EMAIL_OUTBOX_ENABLED?.trim().toLowerCase() === 'false'
  ) {
    return { enabled: false, reason: 'Scheduled email outbox worker is explicitly disabled.' };
  }

  return { enabled: true };
}

/**
 * Thin Netlify Scheduled Function adapter that triggers the existing
 * CRON_SECRET-protected POST `/api/cron/*` endpoints without duplicating
 * publication, cleanup, or outbox business logic.
 */
export async function invokeAuthenticatedCronEndpoint(
  endpoint: CronEndpointPath,
  options?: {
    fetchImpl?: typeof fetch;
    cronSecret?: string;
    baseUrl?: string;
    timeoutMs?: number;
    envOverrides?: Record<string, string | undefined>;
  }
): Promise<CronAdapterResult> {
  const gate = isNetlifyCronEnabled(endpoint, options?.envOverrides);
  if (!gate.enabled) {
    return {
      ok: true,
      skipped: true,
      status: 200,
      endpoint,
      body: { skipped: true, reason: gate.reason },
    };
  }

  const secret = (options?.cronSecret ?? process.env.CRON_SECRET ?? '').trim();
  if (!secret || secret.length < 24) {
    return {
      ok: false,
      status: 503,
      endpoint,
      error: 'CRON_SECRET is missing or shorter than 24 characters.',
    };
  }

  const baseUrl = options?.baseUrl ?? resolveCronTargetBaseUrl();
  if (!baseUrl) {
    return {
      ok: false,
      status: 503,
      endpoint,
      error: 'Target site URL (URL or NEXT_PUBLIC_SITE_URL) is not configured.',
    };
  }

  const fetchFn = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 20_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchFn(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    const body = await res.json().catch(() => null);
    return {
      ok: res.ok,
      status: res.status,
      endpoint,
      body,
      ...(res.ok ? {} : { error: `Cron endpoint returned HTTP ${res.status}` }),
    };
  } catch (err) {
    return {
      ok: false,
      status: 502,
      endpoint,
      error: err instanceof Error ? err.message : 'Scheduled cron request failed.',
    };
  } finally {
    clearTimeout(timer);
  }
}
