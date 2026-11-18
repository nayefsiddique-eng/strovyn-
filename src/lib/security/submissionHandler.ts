import { sendNotificationEmail } from '@/lib/resend/client';
import {
  getRecentSubmissionRecord,
  saveSubmissionRecord,
  withSubmissionLock,
} from '@/lib/security/rateLimiter';

export interface NotificationEmailPayload {
  subject: string;
  html: string;
}

export interface SubmissionOutcome {
  status: 200 | 201;
  id: string;
  createdAt: string;
  notified: boolean;
  deduplicated: boolean;
}

const DEFAULT_DEDUP_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Executes a submission workflow safely:
 * - Serializes concurrent requests with the same dedupKey in-process
 * - Returns cached idempotent result on recent retries (retrying email if needed)
 * - Persists once via persistFn (which also accepts dedupKey for DB-level unique index support)
 * - Isolates email notification failures so a stored submission never returns 500
 */
export async function executeIdempotentSubmission(options: {
  dedupKey: string;
  logLabel: string;
  persistFn: (idempotencyKey: string) => Promise<{ id: string; createdAt: string; deduplicated?: boolean }>;
  emailPayload: NotificationEmailPayload;
  ttlMs?: number;
}): Promise<SubmissionOutcome> {
  const { dedupKey, logLabel, persistFn, emailPayload, ttlMs = DEFAULT_DEDUP_TTL_MS } = options;

  return withSubmissionLock(dedupKey, async () => {
    const existingRecord = getRecentSubmissionRecord(dedupKey, ttlMs);
    if (existingRecord) {
      let notified = existingRecord.notified;
      if (!notified) {
        try {
          const retryNotify = await sendNotificationEmail(emailPayload);
          notified = Boolean(retryNotify.success);
          if (notified) {
            saveSubmissionRecord(dedupKey, { ...existingRecord, notified: true });
          }
        } catch (err) {
          console.warn(
            `${logLabel} notification retry failed:`,
            err instanceof Error ? err.message : 'Unknown error'
          );
        }
      }
      return {
        status: 200,
        id: existingRecord.id,
        createdAt: existingRecord.createdAt,
        notified,
        deduplicated: true,
      };
    }

    const saved = await persistFn(dedupKey);
    const isDuplicate = Boolean(saved.deduplicated);

    const baseRecord = {
      id: saved.id,
      createdAt: saved.createdAt,
      notified: isDuplicate,
      storedAt: Date.now(),
    };
    saveSubmissionRecord(dedupKey, baseRecord);

    if (isDuplicate) {
      return {
        status: 200,
        id: saved.id,
        createdAt: saved.createdAt,
        notified: false,
        deduplicated: true,
      };
    }

    let notified = false;
    try {
      const notifyResult = await sendNotificationEmail(emailPayload);
      notified = Boolean(notifyResult.success);
      if (notified) {
        saveSubmissionRecord(dedupKey, { ...baseRecord, notified: true });
      } else {
        console.warn(
          `${logLabel} ${saved.id} persisted, but owner email notification was not delivered (configured=${Boolean(notifyResult.configured)}).`
        );
      }
    } catch (notifyErr) {
      console.warn(
        `${logLabel} ${saved.id} persisted, but email notification threw:`,
        notifyErr instanceof Error ? notifyErr.message : 'Unknown error'
      );
    }

    return {
      status: 201,
      id: saved.id,
      createdAt: saved.createdAt,
      notified,
      deduplicated: false,
    };
  });
}
