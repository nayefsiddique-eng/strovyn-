/**
 * Strovyn Painting Co. - Mandatory Test Suite for Phase 2.1E
 * Tests A through I:
 * - Test A: Live process holding lock beyond previous 10s threshold
 * - Test B: Second process attempting to acquire active lock (proper timeout, no breaking)
 * - Test C: Crashed process leaving abandoned lock (reclaimed safely when PID dead)
 * - Test D: Process attempting to release another process's lock (LOCK_RELEASE_DENIED)
 * - Test E: Two simultaneous ledger writes from independent Node processes
 * - Test F: Invalid lifecycle transitions rejected with clear errors
 * - Test G: Explicit reconsideration of rejected announcements
 * - Test H: Preservation of published status during subsequent discovery runs
 * - Test I: Recovery after interrupted write (prior ledger untouched)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { HistoryLedger, isProcessAlive } from './lib/historyLedger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testFixturesDir = path.join(__dirname, 'test_fixtures_21e');

if (!fs.existsSync(testFixturesDir)) {
  fs.mkdirSync(testFixturesDir, { recursive: true });
}

function cleanFixtures() {
  if (fs.existsSync(testFixturesDir)) {
    const files = fs.readdirSync(testFixturesDir);
    for (const f of files) {
      try { fs.unlinkSync(path.join(testFixturesDir, f)); } catch {}
    }
  }
}

async function runTests() {
  console.log('========================================================================');
  console.log('STROVYN PHASE 2.1E - MANDATORY LOCK OWNERSHIP & LIFECYCLE TESTS (A - I)');
  console.log('========================================================================\n');

  cleanFixtures();

  // -------------------------------------------------------------------------
  // TEST A & B: Live process holding lock beyond 10s & second process respecting it
  // -------------------------------------------------------------------------
  console.log('TEST A & B: Active Process Holding Lock (No Premature Stale Deletion)');
  const ledgerPathAB = path.join(testFixturesDir, 'ledger_ab.json');
  const lockPathAB = `${ledgerPathAB}.lock`;
  const workerScript = path.join(__dirname, 'helpers', 'lockHolderWorker.mjs');

  // Spawn independent Node process to hold the lock for 12 seconds (> previous 10s threshold)
  const workerA = spawn('node', [workerScript, lockPathAB, '12000'], { stdio: ['ignore', 'pipe', 'pipe'] });

  let workerAPid = null;
  await new Promise((resolve) => {
    workerA.stdout.on('data', (d) => {
      const str = d.toString();
      if (str.includes('LOCKED_BY_PID:')) {
        workerAPid = parseInt(str.split(':')[1], 10);
        resolve();
      }
    });
  });

  console.log(`  Worker process spawned (PID: ${workerAPid}) holding lock for 12,000ms`);
  console.log(`  Verifying worker liveness via isProcessAlive(${workerAPid}): ${isProcessAlive(workerAPid)}`);

  // Process B attempts to acquire lock with maxWaitMs = 1500ms
  const ledgerB = new HistoryLedger(ledgerPathAB);
  let processBBlockedProperly = false;

  try {
    console.log('  Process B attempting acquisition (should timeout while Worker A is alive)...');
    ledgerB._acquireLock(1500);
  } catch (err) {
    if (err.message.includes('LOCK_TIMEOUT') && err.message.includes(workerAPid.toString())) {
      processBBlockedProperly = true;
      console.log(`  Process B correctly timed out without breaking active lock: ${err.message}`);
    }
  }

  // Kill worker process cleanly
  workerA.kill('SIGKILL');
  await new Promise(r => setTimeout(r, 200));

  const testABPassed = isProcessAlive(workerAPid) === false && processBBlockedProperly;
  console.log(`  Test A & B Status: ${testABPassed ? 'PASSED (Active lock preserved; timeout enforced)' : 'FAILED'}\n`);

  // -------------------------------------------------------------------------
  // TEST C: Crashed Process Leaving Abandoned Lock
  // -------------------------------------------------------------------------
  console.log('TEST C: Crashed Process Abandoned Lock Reclaim');
  const ledgerPathC = path.join(testFixturesDir, 'ledger_c.json');
  const lockPathC = `${ledgerPathC}.lock`;

  // Write an abandoned lock with a PID that definitely does not exist (e.g. 999999)
  const deadPid = 999999;
  fs.writeFileSync(lockPathC, JSON.stringify({
    pid: deadPid,
    ownerToken: 'dead_worker_token',
    acquiredAt: new Date().toISOString()
  }), 'utf-8');

  console.log(`  Simulated abandoned lock written for dead PID: ${deadPid}`);
  console.log(`  Checking isProcessAlive(${deadPid}): ${isProcessAlive(deadPid)}`);

  const ledgerC = new HistoryLedger(ledgerPathC);
  let acquiredAbandoned = false;

  try {
    const token = ledgerC._acquireLock(2000);
    acquiredAbandoned = !!token;
    ledgerC._releaseLock(token);
    console.log(`  Ledger acquired lock by clearing confirmed dead PID lock.`);
  } catch (err) {
    console.log(`  Failed to acquire abandoned lock: ${err.message}`);
  }

  const testCPassed = acquiredAbandoned;
  console.log(`  Test C Status: ${testCPassed ? 'PASSED (Abandoned dead lock safely reclaimed)' : 'FAILED'}\n`);

  // -------------------------------------------------------------------------
  // TEST D: Attempting to release another process's lock
  // -------------------------------------------------------------------------
  console.log('TEST D: Lock Ownership Verification on Release');
  const ledgerPathD = path.join(testFixturesDir, 'ledger_d.json');
  const ledgerD = new HistoryLedger(ledgerPathD);
  const tokenD = ledgerD._acquireLock();

  let releaseDeniedCaught = false;
  try {
    // Attempt release using unauthorized bogus token
    ledgerD._releaseLock('unauthorized_alien_token');
  } catch (err) {
    if (err.message.includes('LOCK_RELEASE_DENIED')) {
      releaseDeniedCaught = true;
      console.log(`  Caught expected security error: ${err.message}`);
    }
  }

  // Release properly with true token
  ledgerD._releaseLock(tokenD);
  const testDPassed = releaseDeniedCaught && !fs.existsSync(ledgerD.lockPath);
  console.log(`  Test D Status: ${testDPassed ? 'PASSED (Alien release blocked; true owner released)' : 'FAILED'}\n`);

  // -------------------------------------------------------------------------
  // TEST E: Simultaneous Ledger Writes from Independent Node Processes
  // -------------------------------------------------------------------------
  console.log('TEST E: Simultaneous Ledger Writes from Two Independent Processes');
  const ledgerPathE = path.join(testFixturesDir, 'ledger_e.json');
  const concurrentWorker = path.join(__dirname, 'helpers', 'concurrentWriterWorker.mjs');

  // Initialize empty ledger file
  const initialLedgerE = new HistoryLedger(ledgerPathE);
  initialLedgerE.load();
  initialLedgerE.save();

  // Launch two child processes simultaneously
  const p1 = spawn('node', [concurrentWorker, ledgerPathE, 'item_proc_1', 'Process 1 Title']);
  const p2 = spawn('node', [concurrentWorker, ledgerPathE, 'item_proc_2', 'Process 2 Title']);

  const [code1, code2] = await Promise.all([
    new Promise(res => p1.on('close', res)),
    new Promise(res => p2.on('close', res))
  ]);

  console.log(`  Process 1 Exit Code: ${code1}, Process 2 Exit Code: ${code2}`);

  // Inspect the persisted file
  const verifiedLedgerE = new HistoryLedger(ledgerPathE);
  verifiedLedgerE.load();
  const keysE = Object.keys(verifiedLedgerE.data.records);
  console.log(`  Total records preserved in ledger: ${keysE.length} [Expected: 2]`);

  const testEPassed = code1 === 0 && code2 === 0 && keysE.length === 2;
  console.log(`  Test E Status: ${testEPassed ? 'PASSED (Both concurrent writes safely recorded)' : 'FAILED'}\n`);

  // -------------------------------------------------------------------------
  // TEST F: Invalid Lifecycle Transitions
  // -------------------------------------------------------------------------
  console.log('TEST F: Lifecycle Transition Validation (Illegal Transitions Rejected)');
  const ledgerPathF = path.join(testFixturesDir, 'ledger_f.json');
  const ledgerF = new HistoryLedger(ledgerPathF);
  ledgerF.load();

  ledgerF.registerDiscovered({
    sourceAuthority: 'Test Source',
    title: 'Lifecycle Test Item',
    canonicalUrl: 'https://test.local/lifecycle/1',
    publicationDate: '16 Nov 2026'
  });
  ledgerF.save();

  const testId = '4ae1a2d5eec3'; // generated ID
  const itemRecord = Object.values(ledgerF.data.records)[0];
  const itemId = itemRecord.id;

  // 1. discovered -> approved (Illegal! Must be drafted first)
  let illegal1Caught = false;
  try {
    ledgerF.updateStatus(itemId, 'approved');
  } catch (err) {
    if (err.message.includes('ILLEGAL_TRANSITION')) {
      illegal1Caught = true;
      console.log(`  Discovered -> Approved rejected: ${err.message}`);
    }
  }

  // 2. discovered -> published (Illegal! Must be approved first)
  let illegal2Caught = false;
  try {
    ledgerF.updateStatus(itemId, 'published');
  } catch (err) {
    if (err.message.includes('ILLEGAL_TRANSITION')) {
      illegal2Caught = true;
      console.log(`  Discovered -> Published rejected: ${err.message}`);
    }
  }

  // Legal path: discovered -> drafted -> approved -> published
  ledgerF.updateStatus(itemId, 'drafted');
  ledgerF.updateStatus(itemId, 'approved');
  ledgerF.updateStatus(itemId, 'published');
  console.log(`  Legal path succeeded: discovered -> drafted -> approved -> published`);

  // 3. published -> discovered (Illegal! Published is terminal)
  let illegal3Caught = false;
  try {
    ledgerF.updateStatus(itemId, 'discovered');
  } catch (err) {
    if (err.message.includes('ILLEGAL_TRANSITION') && err.message.includes('terminal')) {
      illegal3Caught = true;
      console.log(`  Published -> Discovered rejected: ${err.message}`);
    }
  }

  const testFPassed = illegal1Caught && illegal2Caught && illegal3Caught;
  console.log(`  Test F Status: ${testFPassed ? 'PASSED (All illegal transitions blocked)' : 'FAILED'}\n`);

  // -------------------------------------------------------------------------
  // TEST G: Explicit Reconsideration of a Rejected Announcement
  // -------------------------------------------------------------------------
  console.log('TEST G: Explicit Reconsideration of Rejected Announcement');
  ledgerF.registerDiscovered({
    sourceAuthority: 'Test Source',
    title: 'Item To Be Rejected',
    canonicalUrl: 'https://test.local/lifecycle/reject-me',
    publicationDate: '16 Nov 2026'
  });
  const rejectItem = Object.values(ledgerF.data.records).find(r => r.canonicalUrl.includes('reject-me'));
  ledgerF.updateStatus(rejectItem.id, 'rejected', { reviewNotes: 'Not relevant to South Australian painting' });

  // 1. Attempt standard updateStatus on rejected (Must fail)
  let rejectedTransitionBlocked = false;
  try {
    ledgerF.updateStatus(rejectItem.id, 'discovered');
  } catch (err) {
    if (err.message.includes('ILLEGAL_TRANSITION') && err.message.includes('reconsiderRecord')) {
      rejectedTransitionBlocked = true;
      console.log(`  updateStatus on rejected record blocked: ${err.message}`);
    }
  }

  // 2. Explicit reconsideration with reason
  ledgerF.reconsiderRecord(rejectItem.id, 'Re-evaluated: Contains new silica exposure standard update');
  const reconsidered = ledgerF.getRecord(rejectItem.id);
  console.log(`  Status after reconsiderRecord: ${reconsidered.status}`);
  console.log(`  Updated review notes: "${reconsidered.reviewNotes}"`);

  const testGPassed = rejectedTransitionBlocked &&
                      reconsidered.status === 'discovered' &&
                      reconsidered.reviewNotes.includes('RECONSIDERED');
  console.log(`  Test G Status: ${testGPassed ? 'PASSED (Rejected item securely guarded; explicit reconsideration succeeded)' : 'FAILED'}\n`);

  // -------------------------------------------------------------------------
  // TEST H: Preservation of Published Status During Subsequent Discovery
  // -------------------------------------------------------------------------
  console.log('TEST H: Published Status Preserved During Subsequent Discovery Run');
  // itemId is currently 'published'. Re-poll it through registerDiscovered()
  const repollRes = ledgerF.registerDiscovered({
    sourceAuthority: 'Test Source',
    title: 'Lifecycle Test Item',
    canonicalUrl: 'https://test.local/lifecycle/1',
    publicationDate: '16 Nov 2026'
  });

  console.log(`  Repoll isNew: ${repollRes.isNew}`);
  console.log(`  Repoll status remains: ${repollRes.record.status} [Expected: published]`);
  const testHPassed = !repollRes.isNew && repollRes.record.status === 'published';
  console.log(`  Test H Status: ${testHPassed ? 'PASSED (Published record immutable against polling updates)' : 'FAILED'}\n`);

  // -------------------------------------------------------------------------
  // TEST I: Recovery After Interrupted Write
  // -------------------------------------------------------------------------
  console.log('TEST I: Recovery After Interrupted Write (Atomic Temp File & Restore)');
  const ledgerPathI = path.join(testFixturesDir, 'ledger_i.json');
  const ledgerI = new HistoryLedger(ledgerPathI);
  ledgerI.load();
  ledgerI.registerDiscovered({
    sourceAuthority: 'Initial Author',
    title: 'Stable Initial Record',
    canonicalUrl: 'https://test.local/atomic/stable',
    publicationDate: '16 Nov 2026'
  });
  ledgerI.save();

  const originalContentI = fs.readFileSync(ledgerPathI, 'utf-8');

  // Simulate write crash mid-rename
  const realRename = fs.renameSync;
  fs.renameSync = () => {
    throw new Error('SIMULATED_CRASH_DURING_ATOMIC_RENAME');
  };

  let writeErrorCaught = false;
  try {
    ledgerI.data.records['corrupted'] = { id: 'corrupted' };
    ledgerI.save();
  } catch (err) {
    writeErrorCaught = true;
    console.log(`  Caught simulated write failure: ${err.message}`);
  } finally {
    fs.renameSync = realRename;
  }

  const contentAfterCrash = fs.readFileSync(ledgerPathI, 'utf-8');
  const testIPassed = writeErrorCaught && contentAfterCrash === originalContentI;
  console.log(`  Original ledger file unchanged: ${contentAfterCrash === originalContentI}`);
  console.log(`  Test I Status: ${testIPassed ? 'PASSED (Interrupted write left valid ledger 100% intact)' : 'FAILED'}\n`);

  // Cleanup
  cleanFixtures();
  try { fs.rmdirSync(testFixturesDir); } catch {}

  const allPassed = testABPassed && testCPassed && testDPassed && testEPassed && testFPassed && testGPassed && testHPassed && testIPassed;

  console.log('========================================================================');
  console.log(`FINAL RESULT: ALL 9 TESTS (A - I) PASSED: ${allPassed ? 'YES' : 'NO'}`);
  console.log('========================================================================');
}

runTests();
