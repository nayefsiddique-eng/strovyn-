import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveDeploymentEnvironment } from '@/lib/config/envIsolation';
import {
  createServiceRoleClient,
  isServiceRoleConfigured,
} from '@/lib/supabase/serviceRole';
import {
  sendNotificationEmail,
  type ResendSendClient,
  type SendEmailResult,
} from './client';
import {
  buildApplicationNotificationEmail,
  buildContactEnquiryNotificationEmail,
  buildCustomerAcknowledgmentEmail,
  buildQuoteNotificationEmail,
} from './templates';

export type OutboxSubmissionType =
  | 'quote_request'
  | 'job_application'
  | 'customer_feedback';

export type OutboxRecipientKind = 'default' | 'recruitment' | 'customer_ack';

const MAX_BACKOFF_MINUTES = 60;
const DEFAULT_MAX_ATTEMPTS = 5;

export function computeOutboxBackoffMinutes(nextAttempt: number): number {
  const safe = Math.max(1, Math.floor(nextAttempt));
  return Math.min(MAX_BACKOFF_MINUTES, 2 ** safe);
}

function isMissingOutboxSchemaError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === '42P01' ||
    err.code === '42883' ||
    err.code === 'PGRST202' ||
    err.code === 'PGRST205' ||
    Boolean(err.message && err.message.includes('email_notification_outbox'))
  );
}

function isPermanentDeliveryError(res: SendEmailResult): boolean {
  if (!res.configured) {
    return false; // Missing env config should stay pending/retryable once configured
  }
  if (!res.error) return false;
  return /\b(400|401|403|404|422)\b|invalid.*(email|recipient|sender|domain)/i.test(
    res.error
  );
}

export async function enqueueAndAttemptEmailNotification(
  params: {
    submissionType: OutboxSubmissionType;
    submissionId: string;
    idempotencyKey: string;
    recipientKind?: OutboxRecipientKind;
    subject: string;
    html: string;
    to?: string;
    replyTo?: string;
  },
  deps?: {
    clientOverride?: SupabaseClient;
    resendClient?: ResendSendClient | null;
    retryDelayMs?: number;
  }
): Promise<SendEmailResult & { outboxStatus?: 'pending' | 'sent' | 'failed_permanent' }> {
  const recipientKind = params.recipientKind ?? 'default';
  const useDb = Boolean(deps?.clientOverride) || isServiceRoleConfigured();

  let outboxId: string | null = null;
  let existingStatus: 'pending' | 'sent' | 'failed_permanent' | null = null;
  let existingAttempts = 0;

  if (useDb) {
    try {
      const client = deps?.clientOverride ?? createServiceRoleClient();
      const { data: existing, error: selErr } = await client
        .from('email_notification_outbox')
        .select('id, status, attempts')
        .eq('submission_type', params.submissionType)
        .eq('idempotency_key', params.idempotencyKey)
        .maybeSingle();

      if (selErr) {
        if (resolveDeploymentEnvironment() === 'production') {
          console.error(
            '[EMAIL OUTBOX CRITICAL] Outbox unavailable in production; durable retry degraded:',
            selErr.message
          );
        } else if (!isMissingOutboxSchemaError(selErr)) {
          console.warn('[EMAIL OUTBOX] Lookup error:', selErr.message);
        }
      } else if (existing) {
        outboxId = existing.id as string;
        existingStatus = existing.status as 'pending' | 'sent' | 'failed_permanent';
        existingAttempts = Number(existing.attempts ?? 0);
        if (existingStatus === 'sent' || existingStatus === 'failed_permanent') {
          return {
            success: existingStatus === 'sent',
            configured: true,
            attempts: 0,
            outboxStatus: existingStatus,
          };
        }
      } else {
        const { data: inserted, error: insErr } = await client
          .from('email_notification_outbox')
          .insert({
            submission_type: params.submissionType,
            submission_id: params.submissionId,
            idempotency_key: params.idempotencyKey,
            recipient_kind: recipientKind,
            status: 'pending',
            attempts: 0,
            max_attempts: DEFAULT_MAX_ATTEMPTS,
          })
          .select('id, status, attempts')
          .single();

        if (!insErr && inserted) {
          outboxId = inserted.id as string;
          existingStatus = 'pending';
          existingAttempts = 0;
        } else if (insErr && resolveDeploymentEnvironment() === 'production') {
          console.error(
            '[EMAIL OUTBOX CRITICAL] Failed to record outbox entry in production:',
            insErr.message
          );
        }
      }
    } catch (err) {
      if (resolveDeploymentEnvironment() === 'production') {
        console.error(
          '[EMAIL OUTBOX CRITICAL] Outbox exception in production:',
          err instanceof Error ? err.message : String(err)
        );
      }
      // Never fail customer submission if outbox insert encounters a transient error
    }
  }

  const sendRes = await sendNotificationEmail(
    {
      subject: params.subject,
      html: params.html,
      to: params.to,
      recipientKind: recipientKind === 'customer_ack' ? 'default' : recipientKind,
      replyTo: params.replyTo,
      idempotencyKey: params.idempotencyKey,
    },
    {
      ...(deps && 'resendClient' in deps ? { resendClient: deps.resendClient } : {}),
      ...(deps?.retryDelayMs !== undefined ? { retryDelayMs: deps.retryDelayMs } : {}),
    }
  );

  if (outboxId && useDb) {
    try {
      const client = deps?.clientOverride ?? createServiceRoleClient();
      const nextAttempts = existingAttempts + 1;
      if (sendRes.success) {
        await client
          .from('email_notification_outbox')
          .update({
            status: 'sent',
            attempts: nextAttempts,
            provider_message_id: sendRes.messageId ?? null,
            sent_at: new Date().toISOString(),
            claim_token: null,
            claim_expires_at: null,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', outboxId);
        return { ...sendRes, outboxStatus: 'sent' };
      }

      const permanent =
        isPermanentDeliveryError(sendRes) || nextAttempts >= DEFAULT_MAX_ATTEMPTS;
      const nextRetryAt = new Date(
        Date.now() + computeOutboxBackoffMinutes(nextAttempts) * 60_000
      ).toISOString();

      await client
        .from('email_notification_outbox')
        .update({
          status: permanent ? 'failed_permanent' : 'pending',
          attempts: nextAttempts,
          next_retry_at: nextRetryAt,
          claim_token: null,
          claim_expires_at: null,
          last_error: (sendRes.error ?? 'Delivery skipped or failed').slice(0, 300),
          updated_at: new Date().toISOString(),
        })
        .eq('id', outboxId);

      return {
        ...sendRes,
        outboxStatus: permanent ? 'failed_permanent' : 'pending',
      };
    } catch {
      // ignore outbox update failure
    }
  }

  return sendRes;
}

async function buildOutboxEmailForRecord(
  client: SupabaseClient,
  submissionType: OutboxSubmissionType,
  submissionId: string,
  recipientKind: OutboxRecipientKind
): Promise<{ subject: string; html: string; to?: string; replyTo?: string } | null> {
  if (submissionType === 'quote_request') {
    const { data } = await client
      .from('quote_requests')
      .select(
        'full_name, email, phone, project_location, service_required, preferred_contact, description, attachment_url'
      )
      .eq('id', submissionId)
      .maybeSingle();
    if (!data) return null;
    if (recipientKind === 'customer_ack') {
      return {
        to: data.email as string,
        ...buildCustomerAcknowledgmentEmail({
          recipientName: data.full_name as string,
          submissionType: 'quote',
        }),
      };
    }
    return {
      replyTo: data.email as string,
      ...buildQuoteNotificationEmail({
        fullName: data.full_name as string,
        email: data.email as string,
        phone: data.phone as string,
        projectLocation: (data.project_location as string) || undefined,
        serviceRequired: data.service_required as string,
        preferredContact: (data.preferred_contact as string) || 'email',
        description: data.description as string,
        hasAttachment: Boolean(data.attachment_url),
      }),
    };
  }

  if (submissionType === 'job_application') {
    const { data } = await client
      .from('job_applications')
      .select(
        'applicant_name, email, phone, cover_letter, cv_url, job_opening_id'
      )
      .eq('id', submissionId)
      .maybeSingle();
    if (!data) return null;
    if (recipientKind === 'customer_ack') {
      return {
        to: data.email as string,
        ...buildCustomerAcknowledgmentEmail({
          recipientName: data.applicant_name as string,
          submissionType: 'application',
        }),
      };
    }
    let positionTitle = 'Painting Position';
    if (data.job_opening_id) {
      const { data: opening } = await client
        .from('job_openings')
        .select('title')
        .eq('id', data.job_opening_id as string)
        .maybeSingle();
      if (opening?.title) {
        positionTitle = opening.title as string;
      }
    }
    return {
      replyTo: data.email as string,
      ...buildApplicationNotificationEmail({
        fullName: data.applicant_name as string,
        email: data.email as string,
        phone: data.phone as string,
        position: positionTitle,
        hasResume: Boolean(data.cv_url),
      }),
    };
  }

  const { data } = await client
    .from('customer_feedback')
    .select('name, email, project_reference, rating, message')
    .eq('id', submissionId)
    .maybeSingle();
  if (!data) return null;
  if (recipientKind === 'customer_ack' && data.email) {
    return {
      to: data.email as string,
      ...buildCustomerAcknowledgmentEmail({
        recipientName: data.name as string,
        submissionType: 'feedback',
      }),
    };
  }
  return {
    ...(data.email ? { replyTo: data.email as string } : {}),
    ...buildContactEnquiryNotificationEmail({
      customerName: data.name as string,
      projectReference: (data.project_reference as string) || undefined,
      rating: Number(data.rating ?? 5),
      message: data.message as string,
    }),
  };
}

export interface EmailOutboxWorkerSummary {
  ok: boolean;
  reconciled: number;
  claimed: number;
  sent: number;
  retried: number;
  failedPermanent: number;
}

export async function runEmailOutboxWorker(
  options?: { limit?: number; leaseSeconds?: number; reconcileLookbackHours?: number },
  deps?: {
    clientOverride?: SupabaseClient;
    resendClient?: ResendSendClient | null;
    retryDelayMs?: number;
  }
): Promise<EmailOutboxWorkerSummary> {
  if (!deps?.clientOverride && !isServiceRoleConfigured()) {
    return { ok: false, reconciled: 0, claimed: 0, sent: 0, retried: 0, failedPermanent: 0 };
  }

  const client = deps?.clientOverride ?? createServiceRoleClient();
  const limit = Math.min(50, Math.max(1, Math.floor(options?.limit ?? 10)));
  const leaseSeconds = Math.min(600, Math.max(15, Math.floor(options?.leaseSeconds ?? 60)));
  const lookbackHours = Math.min(
    720,
    Math.max(1, Math.floor(options?.reconcileLookbackHours ?? 168))
  );

  let reconciled = 0;
  try {
    const { data: recCount, error: recErr } = await client.rpc(
      'cms_reconcile_missing_email_outbox',
      {
        p_lookback_hours: lookbackHours,
        p_limit: 100,
      }
    );
    if (recErr) {
      if (resolveDeploymentEnvironment() === 'production') {
        console.error(
          '[EMAIL OUTBOX CRITICAL] Reconciliation RPC failed in production:',
          recErr.message
        );
      } else if (!isMissingOutboxSchemaError(recErr)) {
        console.warn('[EMAIL OUTBOX] Reconciliation warning:', recErr.message);
      }
    } else if (typeof recCount === 'number') {
      reconciled = recCount;
    }
  } catch (err) {
    if (resolveDeploymentEnvironment() === 'production') {
      console.error(
        '[EMAIL OUTBOX CRITICAL] Reconciliation exception in production:',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  const { data: rows, error: claimErr } = await client.rpc(
    'cms_claim_due_email_outbox',
    {
      p_limit: limit,
      p_lease_seconds: leaseSeconds,
    }
  );

  if (claimErr || !Array.isArray(rows)) {
    throw new Error(
      claimErr?.message ??
        'Email outbox claim RPC (cms_claim_due_email_outbox) failed or is unavailable.'
    );
  }

  let sent = 0;
  let retried = 0;
  let failedPermanent = 0;

  for (const row of rows as Array<{
    id: string;
    submission_type: OutboxSubmissionType;
    submission_id: string;
    idempotency_key: string;
    recipient_kind: OutboxRecipientKind;
    attempts: number;
    max_attempts: number;
    claim_token: string;
  }>) {
    const emailContent = await buildOutboxEmailForRecord(
      client,
      row.submission_type,
      row.submission_id,
      row.recipient_kind
    );

    if (!emailContent) {
      await client
        .from('email_notification_outbox')
        .update({
          status: 'failed_permanent',
          claim_token: null,
          claim_expires_at: null,
          last_error: 'Referenced submission record no longer exists.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .eq('claim_token', row.claim_token);
      failedPermanent += 1;
      continue;
    }

    const sendRes = await sendNotificationEmail(
      {
        ...emailContent,
        recipientKind:
          row.recipient_kind === 'customer_ack' ? 'default' : row.recipient_kind,
        idempotencyKey: row.idempotency_key,
      },
      {
        ...(deps && 'resendClient' in deps ? { resendClient: deps.resendClient } : {}),
        ...(deps?.retryDelayMs !== undefined ? { retryDelayMs: deps.retryDelayMs } : {}),
      }
    );

    const nextAttempts = Number(row.attempts ?? 0) + 1;

    if (sendRes.success) {
      await client
        .from('email_notification_outbox')
        .update({
          status: 'sent',
          attempts: nextAttempts,
          provider_message_id: sendRes.messageId ?? null,
          sent_at: new Date().toISOString(),
          claim_token: null,
          claim_expires_at: null,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .eq('claim_token', row.claim_token);
      sent += 1;
      continue;
    }

    const permanent =
      isPermanentDeliveryError(sendRes) || nextAttempts >= Number(row.max_attempts ?? 5);
    const nextRetryAt = new Date(
      Date.now() + computeOutboxBackoffMinutes(nextAttempts) * 60_000
    ).toISOString();

    await client
      .from('email_notification_outbox')
      .update({
        status: permanent ? 'failed_permanent' : 'pending',
        attempts: nextAttempts,
        next_retry_at: nextRetryAt,
        claim_token: null,
        claim_expires_at: null,
        last_error: (sendRes.error ?? 'Email delivery failed').slice(0, 300),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('claim_token', row.claim_token);

    if (permanent) failedPermanent += 1;
    else retried += 1;
  }

  return {
    ok: failedPermanent === 0,
    reconciled,
    claimed: rows.length,
    sent,
    retried,
    failedPermanent,
  };
}
