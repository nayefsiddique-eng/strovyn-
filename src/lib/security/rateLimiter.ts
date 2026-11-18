import fs from 'fs';
import path from 'path';

interface RateLimitRecord {
  timestamps: number[];
}

const MEMORY_CACHE = new Map<string, number[]>();
const PERSISTENT_STORE_DIR = path.join(process.cwd(), 'private_storage', 'ratelimits');

function getStoreFilePath(key: string): string {
  // Sanitize key for filesystem
  const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(PERSISTENT_STORE_DIR, `${safeKey}.json`);
}

/**
 * Multi-layer rate limiter:
 * 1. Fast in-memory check
 * 2. Serverless/Persistent local file fallback (when Supabase/Redis is not configured)
 *
 * NOTE FOR SERVERLESS HOSTING:
 * In stateless multi-instance environments (Vercel, AWS Lambda), an external persistent
 * store (Upstash Redis or Supabase `rate_limits` table) should be used.
 * When unconfigured, this limiter enforces per-instance limits and records persistent local state.
 */
export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; retryAfterSec?: number }> {
  const now = Date.now();
  const windowStart = now - windowMs;

  let timestamps: number[] = [];

  // Check memory first
  if (MEMORY_CACHE.has(identifier)) {
    timestamps = (MEMORY_CACHE.get(identifier) || []).filter((t) => t > windowStart);
  } else {
    // Attempt reading from persistent file
    try {
      const filePath = getStoreFilePath(identifier);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed: RateLimitRecord = JSON.parse(raw);
        timestamps = (parsed.timestamps || []).filter((t) => t > windowStart);
      }
    } catch {
      timestamps = [];
    }
  }

  if (timestamps.length >= limit) {
    const oldest = timestamps[0];
    const retryAfterSec = Math.ceil((oldest + windowMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: retryAfterSec > 0 ? retryAfterSec : 1,
    };
  }

  // Record hit
  timestamps.push(now);
  MEMORY_CACHE.set(identifier, timestamps);

  // Async persist without blocking
  try {
    if (!fs.existsSync(PERSISTENT_STORE_DIR)) {
      fs.mkdirSync(PERSISTENT_STORE_DIR, { recursive: true });
    }
    const filePath = getStoreFilePath(identifier);
    fs.writeFileSync(filePath, JSON.stringify({ timestamps }, null, 2), 'utf-8');
  } catch {
    // Non-fatal if filesystem is readonly in certain serverless environments
  }

  return {
    allowed: true,
    remaining: limit - timestamps.length,
  };
}

export interface SubmissionDedupRecord {
  id: string;
  createdAt: string;
  notified: boolean;
  storedAt: number;
}

const DEDUP_CACHE = new Map<string, SubmissionDedupRecord>();
const IN_FLIGHT_LOCKS = new Map<string, Promise<unknown>>();

/**
 * Coalesces / serializes concurrent in-process operations sharing the same dedupKey
 * so two simultaneous POST requests cannot both bypass the persistence check.
 */
export async function withSubmissionLock<T>(
  dedupKey: string,
  task: () => Promise<T>
): Promise<T> {
  const previous = IN_FLIGHT_LOCKS.get(dedupKey);
  const run = async (): Promise<T> => {
    if (previous) {
      try {
        await previous;
      } catch {
        // Proceed cleanly even if the prior in-flight request failed
      }
    }
    return task();
  };

  const promise = run();
  IN_FLIGHT_LOCKS.set(dedupKey, promise);
  try {
    return await promise;
  } finally {
    if (IN_FLIGHT_LOCKS.get(dedupKey) === promise) {
      IN_FLIGHT_LOCKS.delete(dedupKey);
    }
  }
}

/**
 * Reads a recent persisted quote record within ttlMs so retries (e.g. after an
 * email timeout/failure or double-click) never create duplicate database rows.
 */
export function getRecentSubmissionRecord(
  dedupKey: string,
  ttlMs: number
): SubmissionDedupRecord | null {
  const now = Date.now();
  const cached = DEDUP_CACHE.get(dedupKey);
  if (cached) {
    if (now - cached.storedAt <= ttlMs) return cached;
    DEDUP_CACHE.delete(dedupKey);
  }

  try {
    const filePath = getStoreFilePath(dedupKey);
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as SubmissionDedupRecord;
      if (parsed && now - parsed.storedAt <= ttlMs) {
        DEDUP_CACHE.set(dedupKey, parsed);
        return parsed;
      }
      // Remove expired record file cleanly
      fs.unlinkSync(filePath);
    }
  } catch {
    // Non-fatal in read-only or corrupt cache conditions
  }

  return null;
}

/**
 * Saves or updates a quote idempotency record for duplicate-retry protection.
 */
export function saveSubmissionRecord(
  dedupKey: string,
  record: SubmissionDedupRecord
): void {
  DEDUP_CACHE.set(dedupKey, record);
  try {
    if (!fs.existsSync(PERSISTENT_STORE_DIR)) {
      fs.mkdirSync(PERSISTENT_STORE_DIR, { recursive: true });
    }
    fs.writeFileSync(getStoreFilePath(dedupKey), JSON.stringify(record, null, 2), 'utf-8');
  } catch {
    // Non-fatal in read-only environments
  }
}
