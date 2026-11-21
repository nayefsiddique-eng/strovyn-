import 'server-only';
import { Resend } from 'resend';

const EMAIL_ADDRESS_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const NAMED_EMAIL_RE = /^[^<>\r\n]+\s<([^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)>$/;
const HEADER_INJECTION_RE = /[\r\n\0]/;
const MAX_RETRY_ATTEMPTS = 2;

export interface ResendSendClient {
  emails: {
    send: (
      payload: {
        from: string;
        to: string[];
        subject: string;
        html: string;
        replyTo?: string;
        headers?: Record<string, string>;
      },
      options?: { idempotencyKey?: string }
    ) => Promise<{ data?: { id?: string } | null; error?: { message: string; statusCode?: number } | null }>;
  };
}

export interface SendEmailResult {
  success: boolean;
  configured: boolean;
  attempts: number;
  messageId?: string;
  error?: string;
}

const resendApiKey = process.env.RESEND_API_KEY?.trim();
export const resend = resendApiKey ? new Resend(resendApiKey) : null;

export function sanitizeEmailHeaderValue(value: string): string {
  return value.replace(/[\r\n\0]+/g, ' ').trim();
}

export function isValidEmailAddress(raw: string | undefined | null): boolean {
  if (!raw || HEADER_INJECTION_RE.test(raw)) return false;
  const trimmed = raw.trim();
  if (EMAIL_ADDRESS_RE.test(trimmed)) return true;
  const named = trimmed.match(NAMED_EMAIL_RE);
  return Boolean(named && EMAIL_ADDRESS_RE.test(named[1]));
}

export function resolveNotificationRecipient(
  kind: 'default' | 'recruitment' = 'default'
): string | null {
  const candidate =
    kind === 'recruitment'
      ? process.env.RECRUITMENT_EMAIL?.trim() ||
        process.env.NOTIFICATION_EMAIL?.trim() ||
        process.env.ADMIN_EMAIL?.trim()
      : process.env.NOTIFICATION_EMAIL?.trim() || process.env.ADMIN_EMAIL?.trim();

  if (!candidate || !isValidEmailAddress(candidate)) {
    return null;
  }
  return sanitizeEmailHeaderValue(candidate);
}

export function resolveSenderAddress(): string | null {
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
  if (!fromEmail || !isValidEmailAddress(fromEmail)) {
    return null;
  }
  return sanitizeEmailHeaderValue(fromEmail);
}

function isTransientResendFailure(statusCode?: number, message?: string): boolean {
  if (statusCode && (statusCode === 429 || statusCode >= 500)) {
    return true;
  }
  if (message && /(timeout|network|rate.?limit|temporar|econnreset|5\d\d)/i.test(message)) {
    return true;
  }
  return false;
}

export async function sendNotificationEmail(
  {
    subject,
    html,
    to,
    recipientKind = 'default',
    replyTo,
    idempotencyKey,
  }: {
    subject: string;
    html: string;
    to?: string;
    recipientKind?: 'default' | 'recruitment';
    replyTo?: string;
    idempotencyKey?: string;
  },
  deps?: {
    resendClient?: ResendSendClient | null;
    retryDelayMs?: number;
  }
): Promise<SendEmailResult> {
  const activeClient: ResendSendClient | null =
    deps && 'resendClient' in deps
      ? (deps.resendClient ?? null)
      : (resend as unknown as ResendSendClient | null);

  if (!activeClient) {
    console.info('[RESEND NOTICE] Email delivery skipped: RESEND_API_KEY not configured.');
    return { success: false, configured: false, attempts: 0 };
  }

  const fromEmail = resolveSenderAddress();
  if (!fromEmail) {
    console.warn('[RESEND NOTICE] Email delivery skipped: RESEND_FROM_EMAIL missing or invalid.');
    return {
      success: false,
      configured: false,
      attempts: 0,
      error: 'Sender address (RESEND_FROM_EMAIL) is not configured or invalid.',
    };
  }

  const resolvedTo = to
    ? isValidEmailAddress(to)
      ? sanitizeEmailHeaderValue(to)
      : null
    : resolveNotificationRecipient(recipientKind);

  if (!resolvedTo) {
    console.warn('[RESEND NOTICE] Email delivery skipped: destination email missing or invalid.');
    return {
      success: false,
      configured: false,
      attempts: 0,
      error: 'Notification recipient is not configured or invalid.',
    };
  }

  const safeSubject = sanitizeEmailHeaderValue(subject).slice(0, 200);
  const safeReplyTo =
    replyTo && isValidEmailAddress(replyTo)
      ? sanitizeEmailHeaderValue(replyTo)
      : undefined;
  const retryDelayMs = deps?.retryDelayMs ?? 150;

  let attempts = 0;
  let lastError = 'Unknown Resend error';

  for (let i = 0; i <= MAX_RETRY_ATTEMPTS; i += 1) {
    attempts += 1;
    try {
      const result = await activeClient.emails.send(
        {
          from: fromEmail,
          to: [resolvedTo],
          subject: safeSubject,
          html,
          ...(safeReplyTo ? { replyTo: safeReplyTo } : {}),
        },
        idempotencyKey ? { idempotencyKey } : undefined
      );

      if (!result.error) {
        return {
          success: true,
          configured: true,
          attempts,
          messageId: result.data?.id,
        };
      }

      lastError = result.error.message || 'Resend API rejected request';
      if (
        i < MAX_RETRY_ATTEMPTS &&
        isTransientResendFailure(result.error.statusCode, lastError)
      ) {
        await new Promise((r) => setTimeout(r, retryDelayMs * (i + 1)));
        continue;
      }
      break;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : 'Network error';
      if (i < MAX_RETRY_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, retryDelayMs * (i + 1)));
        continue;
      }
    }
  }

  console.error('[RESEND ERROR] Email delivery failed without leaking PII:', {
    attempts,
    error: lastError.slice(0, 180),
  });

  return {
    success: false,
    configured: true,
    attempts,
    error: lastError,
  };
}

export async function sendOptionalCustomerAcknowledgment(
  params: {
    to: string;
    subject: string;
    html: string;
    idempotencyKey?: string;
  },
  deps?: {
    resendClient?: ResendSendClient | null;
    retryDelayMs?: number;
  }
): Promise<SendEmailResult> {
  if (process.env.RESEND_SEND_ACKNOWLEDGMENTS !== 'true') {
    return { success: false, configured: false, attempts: 0 };
  }
  return sendNotificationEmail(
    {
      to: params.to,
      subject: params.subject,
      html: params.html,
      idempotencyKey: params.idempotencyKey ? `${params.idempotencyKey}:ack` : undefined,
    },
    deps
  );
}
