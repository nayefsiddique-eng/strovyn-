import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createServiceRoleClient,
  isServiceRoleConfigured,
} from '@/lib/supabase/serviceRole';
import { revalidatePublicInsightsPaths } from './http';

const DEFAULT_BATCH_LIMIT = 10;
const MAX_BATCH_LIMIT = 50;
const DEFAULT_LEASE_SECONDS = 120;
const MAX_BACKOFF_MINUTES = 60;

export interface ScheduledPublishItemResult {
  articleId: string;
  slug: string;
  outcome: 'published' | 'skipped_already_published' | 'failed';
  error?: string;
  nextRetryAt?: string;
}

export interface ScheduledPublisherSummary {
  ok: boolean;
  skipped?: boolean;
  claimed: number;
  published: number;
  skippedAlreadyPublished: number;
  failed: number;
  executedAtUtc: string;
  results: ScheduledPublishItemResult[];
}

interface DueScheduledArticleRow {
  id: string;
  slug: string;
  title: string;
  scheduled_at: string;
  publish_attempts: number | null;
  claim_token: string;
  lease_expires_at: string;
}

export function computeRetryBackoffMinutes(nextAttempts: number): number {
  const safeAttempts = Math.max(1, Math.floor(nextAttempts));
  return Math.min(MAX_BACKOFF_MINUTES, 2 ** safeAttempts);
}

async function claimDueArticles(
  client: SupabaseClient,
  limit: number,
  leaseSeconds: number
): Promise<DueScheduledArticleRow[]> {
  const rpcRes = await client.rpc('cms_claim_due_scheduled_articles', {
    p_limit: limit,
    p_lease_seconds: leaseSeconds,
  });

  if (rpcRes.error || !Array.isArray(rpcRes.data)) {
    throw new Error(
      rpcRes.error?.message ??
        'Scheduled article claim RPC (cms_claim_due_scheduled_articles) failed or is unavailable.'
    );
  }

  return rpcRes.data as DueScheduledArticleRow[];
}

async function releaseArticleClaim(
  client: SupabaseClient,
  articleId: string,
  claimToken: string
): Promise<void> {
  try {
    await client.rpc('cms_release_article_publish_claim', {
      p_article_id: articleId,
      p_claim_token: claimToken,
    });
  } catch {
    // Lease will expire automatically after lease_expires_at if release fails
  }
}

export async function runScheduledArticlePublisher(
  options?: { limit?: number; leaseSeconds?: number },
  clientOverride?: SupabaseClient
): Promise<ScheduledPublisherSummary> {
  const executedAtUtc = new Date().toISOString();
  const limit = Math.min(
    MAX_BATCH_LIMIT,
    Math.max(1, Math.floor(options?.limit ?? DEFAULT_BATCH_LIMIT))
  );
  const leaseSeconds = Math.min(
    900,
    Math.max(15, Math.floor(options?.leaseSeconds ?? DEFAULT_LEASE_SECONDS))
  );

  if (!clientOverride && !isServiceRoleConfigured()) {
    return {
      ok: false,
      skipped: true,
      claimed: 0,
      published: 0,
      skippedAlreadyPublished: 0,
      failed: 0,
      executedAtUtc,
      results: [],
    };
  }

  const client = clientOverride ?? createServiceRoleClient();
  const dueRows = await claimDueArticles(client, limit, leaseSeconds);

  let published = 0;
  let skippedAlreadyPublished = 0;
  let failed = 0;
  const results: ScheduledPublishItemResult[] = [];

  for (const row of dueRows) {
    try {
      const { error: rpcErr } = await client.rpc('cms_transition_article_status', {
        p_article_id: row.id,
        p_to_status: 'published',
        p_actor_staff_id: null,
        p_actor_type: 'cron',
        p_scheduled_at: null,
        p_note: `Automated scheduled publication at ${executedAtUtc}`,
      });

      if (!rpcErr) {
        published += 1;
        revalidatePublicInsightsPaths(row.slug);
        results.push({
          articleId: row.id,
          slug: row.slug,
          outcome: 'published',
        });
        continue;
      }

      const msg = rpcErr.message || 'Scheduled publication transition failed.';
      if (/attempted published -> published|already in/i.test(msg)) {
        skippedAlreadyPublished += 1;
        results.push({
          articleId: row.id,
          slug: row.slug,
          outcome: 'skipped_already_published',
        });
        continue;
      }

      // Record bounded backoff retry state without exposing the article publicly
      const nextAttempts = (row.publish_attempts ?? 0) + 1;
      const backoffMinutes = computeRetryBackoffMinutes(nextAttempts);
      const nextRetryAt = new Date(
        Date.now() + backoffMinutes * 60_000
      ).toISOString();
      const safeError = msg.slice(0, 400);

      await client
        .from('articles')
        .update({
          publish_attempts: nextAttempts,
          last_publish_error: safeError,
          next_retry_at: nextRetryAt,
        })
        .eq('id', row.id)
        .eq('status', 'scheduled');

      failed += 1;
      results.push({
        articleId: row.id,
        slug: row.slug,
        outcome: 'failed',
        error: safeError,
        nextRetryAt,
      });
    } finally {
      await releaseArticleClaim(client, row.id, row.claim_token);
    }
  }

  return {
    ok: failed === 0,
    claimed: dueRows.length,
    published,
    skippedAlreadyPublished,
    failed,
    executedAtUtc,
    results,
  };
}
