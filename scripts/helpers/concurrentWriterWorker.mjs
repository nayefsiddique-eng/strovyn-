/**
 * Helper Worker Process for Parallel Concurrent Writes
 * Usage: node scripts/helpers/concurrentWriterWorker.mjs <ledgerPath> <recordId> <recordTitle>
 */

import { HistoryLedger } from '../lib/historyLedger.mjs';

const [,, ledgerPath, recordId, recordTitle] = process.argv;

try {
  const ledger = new HistoryLedger(ledgerPath);
  ledger.load();
  ledger.registerDiscovered({
    sourceAuthority: 'Concurrent Worker',
    title: recordTitle,
    canonicalUrl: `https://test.local/announcements/${recordId}`,
    publicationDate: '16 Nov 2026'
  });
  ledger.save();
  console.log(`WORKER_WRITE_SUCCESS:${recordId}`);
  process.exit(0);
} catch (err) {
  console.error(`WORKER_WRITE_ERROR:${recordId}:${err.message}`);
  process.exit(1);
}
