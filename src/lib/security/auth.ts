import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface SessionPayload {
  role: 'admin';
  exp: number; // Expiration epoch in ms
  jti: string; // Unique token identifier for session rotation / invalidation
}

interface RevokedSessionEntry {
  jti: string;
  exp: number;
}

const REVOKED_STORE_FILE = path.join(
  process.cwd(),
  'private_storage',
  'security',
  'revoked_sessions.json'
);

/**
 * Process-local revocation map backed by local disk persistence on writable Node hosts.
 * NOTE: On horizontally scaled multi-instance serverless hosts without a shared database
 * service-role store, revoking an active cookie affects the handling instance unless backed
 * by Redis/Supabase service-role storage. Short session TTLs limit exposure.
 */
const revokedSessions = new Map<string, number>();
let diskLoaded = false;

function pruneExpiredRevocations(now: number): void {
  for (const [jti, exp] of revokedSessions.entries()) {
    if (exp <= now) {
      revokedSessions.delete(jti);
    }
  }
}

function loadRevocationsFromDisk(): void {
  if (diskLoaded) return;
  diskLoaded = true;
  try {
    if (!fs.existsSync(REVOKED_STORE_FILE)) return;
    const raw = fs.readFileSync(REVOKED_STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as RevokedSessionEntry[];
    const now = Date.now();
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (entry && typeof entry.jti === 'string' && typeof entry.exp === 'number' && entry.exp > now) {
          revokedSessions.set(entry.jti, entry.exp);
        }
      }
    }
  } catch {
    // Non-fatal in read-only or cold environments
  }
}

function persistRevocationsToDisk(): void {
  const now = Date.now();
  pruneExpiredRevocations(now);
  try {
    const dir = path.dirname(REVOKED_STORE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const entries: RevokedSessionEntry[] = [];
    for (const [jti, exp] of revokedSessions.entries()) {
      if (exp > now) entries.push({ jti, exp });
    }
    fs.writeFileSync(REVOKED_STORE_FILE, JSON.stringify(entries), 'utf-8');
  } catch {
    // Non-fatal in read-only serverless filesystems
  }
}

export function getAdminKey(): string | null {
  const key = process.env.STROVYN_ADMIN_KEY;
  if (!key || key.trim().length === 0) {
    return null; // Fail closed if missing in ANY environment
  }
  return key.trim();
}

export function getSessionSecret(): Buffer | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.trim().length === 0) {
    return null; // Fail closed if missing in ANY environment
  }
  return Buffer.from(secret.trim(), 'utf-8');
}

/**
 * Validates master admin key using constant-time SHA-256 digest comparison
 * so length differences never short-circuit timing.
 */
export function verifyAdminKey(providedKey: string): boolean {
  const masterKey = getAdminKey();
  if (!masterKey || typeof providedKey !== 'string') return false;

  const masterDigest = crypto.createHash('sha256').update(masterKey, 'utf-8').digest();
  const providedDigest = crypto.createHash('sha256').update(providedKey, 'utf-8').digest();

  return crypto.timingSafeEqual(masterDigest, providedDigest);
}

/**
 * Creates an HMAC-SHA256 signed session token
 * Expiry defaults to 8 hours
 */
export function createSessionToken(ttlMs: number = 8 * 60 * 60 * 1000): string | null {
  const secret = getSessionSecret();
  if (!secret) return null;

  const payload: SessionPayload = {
    role: 'admin',
    exp: Date.now() + ttlMs,
    jti: crypto.randomBytes(16).toString('hex'),
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadB64);
  const signatureB64 = hmac.digest('base64url');

  return `${payloadB64}.${signatureB64}`;
}

/**
 * Verifies HMAC-SHA256 signature, expiry, and revocation using timingSafeEqual
 */
export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signatureB64] = parts;
  const secret = getSessionSecret();
  if (!secret) return null;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadB64);
  const expectedSignatureB64 = hmac.digest('base64url');

  const providedSigBuf = Buffer.from(signatureB64, 'utf-8');
  const expectedSigBuf = Buffer.from(expectedSignatureB64, 'utf-8');

  if (providedSigBuf.length !== expectedSigBuf.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(providedSigBuf, expectedSigBuf)) {
    return null;
  }

  try {
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const payload: SessionPayload = JSON.parse(payloadJson);

    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) {
      return null;
    }

    loadRevocationsFromDisk();
    if (payload.jti && revokedSessions.has(payload.jti)) {
      return null;
    }

    if (payload.role !== 'admin') {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Explicitly invalidates a session token and records its JTI until expiration.
 */
export function invalidateSession(token: string | undefined | null): boolean {
  const payload = verifySessionToken(token);
  if (payload && payload.jti) {
    loadRevocationsFromDisk();
    revokedSessions.set(payload.jti, payload.exp);
    persistRevocationsToDisk();
    return true;
  }
  return false;
}
