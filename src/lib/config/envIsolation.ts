export type DeploymentEnvironment = 'development' | 'deploy-preview' | 'production';

const STAGING_SUPABASE_REF = 'euhgtzblwyogmqdldmni';

export function resolveDeploymentEnvironment(): DeploymentEnvironment {
  const netlifyContext = process.env.CONTEXT?.trim().toLowerCase();
  if (netlifyContext === 'production') {
    return 'production';
  }
  if (
    netlifyContext === 'deploy-preview' ||
    netlifyContext === 'branch-deploy'
  ) {
    return 'deploy-preview';
  }
  if (process.env.NODE_ENV === 'production') {
    return process.env.PRODUCTION_DEPLOYMENT === 'true'
      ? 'production'
      : 'deploy-preview';
  }
  return 'development';
}

export function isStagingSupabaseUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return url.toLowerCase().includes(STAGING_SUPABASE_REF);
}

export function isConfiguredProductionSupabaseUrl(
  url: string | undefined | null,
  prodRefOverride?: string
): boolean {
  if (!url) return false;
  const prodRef = (
    prodRefOverride ??
    process.env.PRODUCTION_SUPABASE_REF ??
    ''
  )
    .trim()
    .toLowerCase();
  if (!prodRef) return false;
  return url.toLowerCase().includes(prodRef);
}

/**
 * Enforces strict Supabase environment isolation across runtime paths:
 * - Production cannot connect to `strovyn-staging` (`euhgtzblwyogmqdldmni`).
 * - Deploy Previews / Development cannot connect to a configured production
 *   Supabase project ref (`PRODUCTION_SUPABASE_REF`).
 */
export function assertEnvironmentIsolation(options?: {
  env?: DeploymentEnvironment;
  supabaseUrl?: string;
  productionSupabaseRef?: string;
}): { ok: true; environment: DeploymentEnvironment } {
  const environment = options?.env ?? resolveDeploymentEnvironment();
  const supabaseUrl = options?.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

  if (
    environment === 'production' &&
    isStagingSupabaseUrl(supabaseUrl) &&
    process.env.ALLOW_STAGING_IN_PRODUCTION !== 'true'
  ) {
    throw new Error(
      'Production environment cannot connect to the staging Supabase project (euhgtzblwyogmqdldmni).'
    );
  }

  if (
    environment !== 'production' &&
    isConfiguredProductionSupabaseUrl(supabaseUrl, options?.productionSupabaseRef) &&
    process.env.ALLOW_PROD_IN_PREVIEW !== 'true'
  ) {
    throw new Error(
      `${environment} environment cannot connect to the production Supabase project.`
    );
  }

  return { ok: true, environment };
}
