/**
 * Strovyn Painting Co. - Persistent History Ledger
 * File: scripts/lib/historyLedger.mjs
 *
 * Manages atomic, concurrency-safe read/write operations for scripts/data/history.json.
 *
 * Features:
 * 1. Ownership-aware locking: Lock file contains { pid, ownerToken, acquiredAt, hostname }.
 * 2. Cross-platform process liveness checking:
 *    - Uses process.kill(pid, 0) to check whether the process is genuinely alive.
 *    - Never deletes a lock solely due to elapsed time if the owning process is running.
 *    - Safely reclaims abandoned locks ONLY when the owning PID is confirmed dead.
 * 3. Lock ownership protection: A process can only release a lock matching its own ownerToken.
 * 4. Explicit Lifecycle State Machine:
 *    - 'discovered' -> 'drafted' | 'rejected'
 *    - 'drafted'    -> 'approved' | 'rejected' | 'discovered' (re-draft)
 *    - 'approved'   -> 'published' | 'drafted' | 'rejected'
 *    - 'published'  -> (terminal / protected; cannot be altered by discovery or draft)
 *    - 'rejected'   -> 'discovered' (ONLY via explicit reconsiderRecord() call)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { normalizeCanonicalUrl } from './urlNormalizer.mjs';

export const VALID_STATUSES = new Set([
  'discovered',
  'drafted',
  'approved',
  'published',
  'rejected'
]);

/**
 * Strict state transition matrix
 */
export const ALLOWED_TRANSITIONS = {
  discovered: new Set(['drafted', 'rejected']),
  drafted:    new Set(['approved', 'rejected', 'discovered']),
  approved:   new Set(['published', 'drafted', 'rejected']),
  published:  new Set([]), // Terminal state: cannot transition via standard updateStatus
  rejected:   new Set([])  // Must be explicitly reconsidered via reconsiderRecord()
};

export function generateStableId(canonicalUrl) {
  const normalized = normalizeCanonicalUrl(canonicalUrl);
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 12);
}

/**
 * Cross-platform check whether a PID is currently running
 */
export function isProcessAlive(pid) {
  if (!pid || typeof pid !== 'number' || pid <= 0) return false;
  try {
    // Signal 0 tests for existence without killing the process
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means process exists but we lack permission to signal it (still alive!)
    if (err.code === 'EPERM') return true;
    // ESRCH means No such process (dead)
    if (err.code === 'ESRCH') return false;
    return false;
  }
}

export class HistoryLedger {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    this.dirPath = path.dirname(this.filePath);
    this.lockPath = `${this.filePath}.lock`;
    this.currentOwnerToken = null;
    this.data = {
      version: '1.0.0',
      lastUpdated: null,
      records: {}
    };
  }

  /**
   * Acquire an ownership-aware file lock with retry.
   * Lock metadata includes PID, unique ownerToken, and timestamp.
   */
  _acquireLock(maxWaitMs = 5000) {
    const start = Date.now();
    const ownerToken = `owner_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tempLockPath = `${this.lockPath}.${ownerToken}.tmp`;

    while (true) {
      try {
        const lockPayload = JSON.stringify({
          pid: process.pid,
          ownerToken,
          hostname: os.hostname(),
          acquiredAt: new Date().toISOString(),
          acquiredTimestamp: Date.now()
        }, null, 2);

        // Write unique temp file
        fs.writeFileSync(tempLockPath, lockPayload, 'utf-8');

        // wx atomic open: fails if lockPath already exists
        const fd = fs.openSync(this.lockPath, 'wx');
        fs.writeSync(fd, lockPayload);
        fs.closeSync(fd);

        // Clean up temp
        try { fs.unlinkSync(tempLockPath); } catch {}

        this.currentOwnerToken = ownerToken;
        return ownerToken;
      } catch (err) {
        // Clean up temp on failure
        try { if (fs.existsSync(tempLockPath)) fs.unlinkSync(tempLockPath); } catch {}

        if (err.code === 'EEXIST') {
          // Lock already exists. Inspect lock ownership and process liveness
          let existingLock = null;
          try {
            const rawLock = fs.readFileSync(this.lockPath, 'utf-8');
            existingLock = JSON.parse(rawLock);
          } catch {
            // Lock file was in the middle of being written or corrupted
          }

          if (existingLock && existingLock.pid) {
            // Check if the process holding the lock is still alive on this machine
            const isSameHost = !existingLock.hostname || existingLock.hostname === os.hostname();
            if (isSameHost) {
              const alive = isProcessAlive(existingLock.pid);
              if (!alive) {
                // Owning process is DEAD -> Safe to reclaim abandoned lock
                try {
                  fs.unlinkSync(this.lockPath);
                  continue; // Retry lock acquisition immediately
                } catch {
                  // Concurrently unlinked by another process
                  continue;
                }
              }
              // Owning process is ALIVE -> DO NOT BREAK LOCK regardless of elapsed time
            }
          }

          if (Date.now() - start > maxWaitMs) {
            const holderInfo = existingLock ? `PID ${existingLock.pid}` : 'Unknown Process';
            throw new Error(`LOCK_TIMEOUT: Lock held by active ${holderInfo} on ${this.lockPath} (waited ${maxWaitMs}ms)`);
          }

          // Backoff before retry
          const waitTill = new Date(new Date().getTime() + 60);
          while (waitTill > new Date()) {}
        } else {
          throw err;
        }
      }
    }
  }

  /**
   * Safe lock release: Only the process that acquired the lock can release it.
   */
  _releaseLock(ownerToken = this.currentOwnerToken) {
    if (!ownerToken) return;

    try {
      if (fs.existsSync(this.lockPath)) {
        let lockData = null;
        try {
          lockData = JSON.parse(fs.readFileSync(this.lockPath, 'utf-8'));
        } catch {
          // Unparseable lock file
        }

        if (lockData && lockData.ownerToken) {
          if (lockData.ownerToken === ownerToken) {
            fs.unlinkSync(this.lockPath);
            this.currentOwnerToken = null;
          } else {
            // Refuse to delete another process's lock
            throw new Error(`LOCK_RELEASE_DENIED: Attempted to release lock owned by '${lockData.ownerToken}' using '${ownerToken}'`);
          }
        } else {
          // Legacy or unformatted lock
          fs.unlinkSync(this.lockPath);
          this.currentOwnerToken = null;
        }
      }
    } catch (err) {
      if (err.message.startsWith('LOCK_RELEASE_DENIED')) throw err;
      // Other fs errors (e.g. file already unlinked) can be safely ignored
    }
  }

  /**
   * Load and strictly validate the JSON ledger.
   * If missing, initializes empty structure without writing.
   * If malformed, throws an explicit error (NEVER silently resets corrupted data).
   */
  load() {
    if (!fs.existsSync(this.filePath)) {
      this.data = {
        version: '1.0.0',
        lastUpdated: null,
        records: {}
      };
      return this.data;
    }

    const content = fs.readFileSync(this.filePath, 'utf-8');
    if (!content.trim()) {
      throw new Error(`MALFORMED_LEDGER: History file at ${this.filePath} is empty.`);
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw new Error(`MALFORMED_LEDGER: Failed to parse JSON in ${this.filePath}: ${err.message}`);
    }

    if (!parsed || typeof parsed !== 'object' || !parsed.records || typeof parsed.records !== 'object') {
      throw new Error(`MALFORMED_LEDGER: Schema invalid in ${this.filePath} (missing records object)`);
    }

    // Validate individual record schemas
    for (const [id, rec] of Object.entries(parsed.records)) {
      if (!rec.id || rec.id !== id || !rec.canonicalUrl || !VALID_STATUSES.has(rec.status)) {
        throw new Error(`MALFORMED_RECORD: Record ${id} has invalid structure or status '${rec?.status}'`);
      }
    }

    this.data = parsed;
    return this.data;
  }

  /**
   * Atomic save: acquires lock, re-reads latest ledger to merge concurrent records,
   * writes to temp file first, validates JSON, and renames atomically.
   */
  save() {
    if (!fs.existsSync(this.dirPath)) {
      fs.mkdirSync(this.dirPath, { recursive: true });
    }

    const token = this._acquireLock();
    try {
      // Re-read latest state from disk while holding lock to merge concurrent writes
      if (fs.existsSync(this.filePath)) {
        try {
          const fresh = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
          if (fresh && fresh.records) {
            // Merge in records written by other processes while preserving newer in-memory updates
            for (const [id, rec] of Object.entries(fresh.records)) {
              if (!this.data.records[id]) {
                this.data.records[id] = rec;
              }
            }
          }
        } catch {
          // If disk file is unreadable, proceed with in-memory state
        }
      }

      this.data.lastUpdated = new Date().toISOString();
      const serialized = JSON.stringify(this.data, null, 2);

      // Verify that serialized string is valid JSON
      JSON.parse(serialized);

      const tempPath = `${this.filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
      fs.writeFileSync(tempPath, serialized, 'utf-8');

      // Atomic rename
      fs.renameSync(tempPath, this.filePath);
    } finally {
      this._releaseLock(token);
    }
  }

  getRecord(id) {
    return this.data.records[id] || null;
  }

  hasRecord(id) {
    return !!this.data.records[id];
  }

  /**
   * Registers a newly discovered announcement if not already present.
   * If already present, updates lastObserved timestamp WITHOUT touching the existing status.
   */
  registerDiscovered(announcement) {
    const canonicalUrl = normalizeCanonicalUrl(announcement.canonicalUrl);
    const id = generateStableId(canonicalUrl);
    const now = new Date().toISOString();

    if (this.data.records[id]) {
      // Monotonic safety: Update observation timestamp, but NEVER overwrite status, drafts, or references
      this.data.records[id].lastObserved = now;
      return { isNew: false, record: this.data.records[id] };
    }

    const newRecord = {
      id,
      sourceAuthority: announcement.sourceAuthority,
      title: announcement.title.trim(),
      canonicalUrl,
      publicationDate: announcement.publicationDate || null,
      firstDiscovered: now,
      lastObserved: now,
      status: 'discovered',
      draftReference: null,
      publicationReference: null,
      reviewNotes: null
    };

    this.data.records[id] = newRecord;
    return { isNew: true, record: newRecord };
  }

  /**
   * Strictly validates and executes a lifecycle transition.
   * Disallows illegal transitions according to ALLOWED_TRANSITIONS matrix.
   */
  updateStatus(id, newStatus, metadata = {}) {
    const rec = this.data.records[id];
    if (!rec) {
      throw new Error(`RECORD_NOT_FOUND: Cannot update status for missing record '${id}'`);
    }

    if (!VALID_STATUSES.has(newStatus)) {
      throw new Error(`INVALID_STATUS: '${newStatus}' is not one of: ${Array.from(VALID_STATUSES).join(', ')}`);
    }

    const currentStatus = rec.status;

    // Reject no-op attempts that violate terminal states
    if (currentStatus === 'published' && newStatus !== 'published') {
      throw new Error(`ILLEGAL_TRANSITION: Record '${id}' is 'published' (terminal). Published records cannot be transitioned.`);
    }

    if (currentStatus === 'rejected') {
      throw new Error(`ILLEGAL_TRANSITION: Record '${id}' is 'rejected'. Rejected records cannot transition via updateStatus(); use reconsiderRecord().`);
    }

    // Check transition validity
    const allowed = ALLOWED_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.has(newStatus)) {
      throw new Error(`ILLEGAL_TRANSITION: Cannot transition record '${id}' from '${currentStatus}' to '${newStatus}'. Allowed: [${Array.from(allowed || []).join(', ')}]`);
    }

    rec.status = newStatus;
    rec.lastObserved = new Date().toISOString();

    if (metadata.draftReference !== undefined) rec.draftReference = metadata.draftReference;
    if (metadata.publicationReference !== undefined) rec.publicationReference = metadata.publicationReference;
    if (metadata.reviewNotes !== undefined) rec.reviewNotes = metadata.reviewNotes;

    return rec;
  }

  /**
   * Explicit operator action to reconsider a previously rejected announcement.
   * Safely transitions 'rejected' -> 'discovered' with mandatory review notes.
   */
  reconsiderRecord(id, operatorReason) {
    const rec = this.data.records[id];
    if (!rec) {
      throw new Error(`RECORD_NOT_FOUND: Cannot reconsider missing record '${id}'`);
    }

    if (rec.status !== 'rejected') {
      throw new Error(`INVALID_RECONSIDERATION: Only 'rejected' records can be reconsidered. Current status is '${rec.status}'.`);
    }

    if (!operatorReason || typeof operatorReason !== 'string' || operatorReason.trim().length < 5) {
      throw new Error(`REASON_REQUIRED: Explicit operator reason required to reconsider rejected announcement '${id}'`);
    }

    rec.status = 'discovered';
    rec.lastObserved = new Date().toISOString();
    rec.reviewNotes = `RECONSIDERED: ${operatorReason.trim()} (Previous notes: ${rec.reviewNotes || 'none'})`;

    return rec;
  }
}
