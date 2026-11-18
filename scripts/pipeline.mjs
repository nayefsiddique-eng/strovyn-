/**
 * Strovyn Painting Co. - Master Research Pipeline Orchestrator
 * File: scripts/pipeline.mjs
 *
 * Polls the three priority Australian authorities (ABCB, Safe Work Australia, Standards Australia),
 * normalizes canonical URLs, registers discoveries in the persistent ledger (scripts/data/history.json),
 * and reports newly discovered dispatches versus previously recorded announcements.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { fetchABCBUpdates } from './adapters/abcb.mjs';
import { fetchSafeWorkAustraliaUpdates } from './adapters/safeWorkAustralia.mjs';
import { fetchStandardsAustraliaUpdates } from './adapters/standardsAustralia.mjs';
import { HistoryLedger } from './lib/historyLedger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Keyword taxonomy relevant to fine architectural painting, coatings, and residential building standards
export const TRADE_KEYWORDS = [
  'paint', 'coating', 'surface', 'plaster', 'render', 'ncc', 'national construction code',
  'as/nzs', 'standard', 'standards', 'exposure', 'chemical', 'lead', 'silica', 'voc',
  'safety', 'scaffold', 'fall', 'residential', 'building', 'energy', 'condensation',
  'waterproofing', 'moisture', 'durability', 'corrigenda', 'quality'
];

export function classifyRelevance(title) {
  const lower = title.toLowerCase();
  const matched = TRADE_KEYWORDS.filter(kw => lower.includes(kw));
  return {
    isRelevant: matched.length > 0,
    matchedKeywords: matched
  };
}

export async function runPipeline({ ledgerPath, quiet = false } = {}) {
  const defaultLedgerPath = path.join(__dirname, 'data', 'history.json');
  const targetLedgerPath = ledgerPath || defaultLedgerPath;

  const ledger = new HistoryLedger(targetLedgerPath);
  ledger.load();

  if (!quiet) {
    console.log('========================================================================');
    console.log('STROVYN PAINTING CO. - AUSTRALIAN INDUSTRY UPDATES PIPELINE');
    console.log('Ledger Path:', targetLedgerPath);
    console.log('Timestamp:  ', new Date().toISOString());
    console.log('========================================================================\n');
  }

  const adapters = [
    { name: 'Australian Building Codes Board (ABCB)', fn: fetchABCBUpdates },
    { name: 'Safe Work Australia', fn: fetchSafeWorkAustraliaUpdates },
    { name: 'Standards Australia', fn: fetchStandardsAustraliaUpdates }
  ];

  const newlyDiscovered = [];
  const previouslySeen = [];
  const sourceErrors = [];

  for (const adapter of adapters) {
    if (!quiet) process.stdout.write(`Querying ${adapter.name}... `);
    const start = Date.now();
    const result = await adapter.fn();
    const duration = Date.now() - start;

    if (result.error) {
      if (!quiet) console.log(`[FAILED] (${duration}ms) - ${result.error}`);
      sourceErrors.push({ source: adapter.name, error: result.error });
      continue;
    }

    if (!quiet) console.log(`[OK] (${duration}ms) - ${result.items.length} items parsed`);

    for (const item of result.items) {
      const { isNew, record } = ledger.registerDiscovered(item);
      const relevance = classifyRelevance(item.title);

      const enriched = {
        ...record,
        isRelevant: relevance.isRelevant,
        matchedKeywords: relevance.matchedKeywords
      };

      if (isNew) {
        newlyDiscovered.push(enriched);
      } else {
        previouslySeen.push(enriched);
      }
    }
  }

  // Atomic save to persistent ledger
  ledger.save();

  if (!quiet) {
    console.log('\n------------------------------------------------------------------------');
    console.log('EXECUTION SUMMARY:');
    console.log(`Newly Discovered Items:   ${newlyDiscovered.length}`);
    console.log(`Previously Processed:     ${previouslySeen.length}`);
    console.log(`Source Errors Encountered: ${sourceErrors.length}`);
    console.log('------------------------------------------------------------------------\n');

    if (newlyDiscovered.length > 0) {
      console.log('NEW ANNOUNCEMENTS RECORDED IN LEDGER:');
      newlyDiscovered.forEach((item, idx) => {
        console.log(`\n[${idx + 1}] ID: ${item.id} | Source: ${item.sourceAuthority}`);
        console.log(`    Title:     ${item.title}`);
        console.log(`    Date:      ${item.publicationDate || 'None'}`);
        console.log(`    URL:       ${item.canonicalUrl}`);
        console.log(`    Status:    ${item.status}`);
        console.log(`    Relevant?  ${item.isRelevant ? `YES (${item.matchedKeywords.join(', ')})` : 'NO'}`);
      });
    } else {
      console.log('No new announcements discovered. All items match existing history records.');
    }

    console.log('\n========================================================================');
    console.log('Pipeline execution finished cleanly. Ledger safely updated.');
    console.log('========================================================================');
  }

  return {
    newlyDiscovered,
    previouslySeen,
    sourceErrors,
    totalRecordsInLedger: Object.keys(ledger.data.records).length
  };
}

// Direct execution guard
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runPipeline().catch(err => {
    console.error('Fatal Pipeline Error:', err);
    process.exit(1);
  });
}
