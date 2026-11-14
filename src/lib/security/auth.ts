import crypto from 'crypto';

export interface SessionPayload {
  role: 'admin';
  exp: number; // Expiration epoch in ms
  jti: string; // Unique token identifier for session rotation / invalidation
}

// In-memory revoked session JTI set (supplemented by Supabase if configured)
const revokedSessions = new Set<string>();

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
 * Validates master admin key using constant-time comparison
 */
export function verifyAdminKey(providedKey: string): boolean {
  const masterKey = getAdminKey();
  if (!masterKey || typeof providedKey !== 'string') return false;

  const masterBuf = Buffer.from(masterKey, 'utf-8');
  const providedBuf = Buffer.from(providedKey, 'utf-8');

  if (masterBuf.length !== providedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(masterBuf, providedBuf);
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

  // Recompute HMAC
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

    // Check expiry
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) {
      return null;
    }

    // Check revocation
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
 * Explicitly invalidates a session token
 */
export function invalidateSession(token: string | undefined | null): boolean {
  const payload = verifySessionToken(token);
  if (payload && payload.jti) {
    revokedSessions.add(payload.jti);
    return true;
  }
  return false;
}
