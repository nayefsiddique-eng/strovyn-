/**
 * Helper Worker Process for Concurrency & Stale Lock Tests
 * Usage: node scripts/helpers/lockHolderWorker.mjs <lockPath> <holdMs>
 */

import fs from 'fs';
import os from 'os';

const [,, lockPath, holdMsArg] = process.argv;
const holdMs = parseInt(holdMsArg || '1000', 10);

if (!lockPath) {
  console.error('lockPath required');
  process.exit(1);
}

const ownerToken = `worker_${process.pid}_${Date.now()}`;
const payload = JSON.stringify({
  pid: process.pid,
  ownerToken,
  hostname: os.hostname(),
  acquiredAt: new Date().toISOString(),
  acquiredTimestamp: Date.now()
}, null, 2);

try {
  fs.writeFileSync(lockPath, payload, { flag: 'wx' });
  console.log(`LOCKED_BY_PID:${process.pid}:${ownerToken}`);

  // Hold lock for the requested duration
  setTimeout(() => {
    try {
      if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
    } catch {}
    console.log(`RELEASED_BY_PID:${process.pid}`);
    process.exit(0);
  }, holdMs);
} catch (err) {
  console.error('WORKER_LOCK_FAILED:', err.message);
  process.exit(2);
}
