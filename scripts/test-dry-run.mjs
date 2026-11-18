/**
 * Strovyn Painting Co. - Australian Construction Industry Research Pipeline
 * Master Dry-Run Orchestrator: Tests ABCB, Safe Work Australia, and Standards Australia
 */

import { fetchABCBUpdates } from './adapters/abcb.mjs';
import { fetchSafeWorkAustraliaUpdates } from './adapters/safeWorkAustralia.mjs';
import { fetchStandardsAustraliaUpdates } from './adapters/standardsAustralia.mjs';
import crypto from 'crypto';

// Keyword taxonomy relevant to fine architectural painting, coatings, and residential building standards
const TRADE_KEYWORDS = [
  'paint', 'coating', 'surface', 'plaster', 'render', 'ncc', 'national construction code',
  'as/nzs', 'standard', 'standards', 'exposure', 'chemical', 'lead', 'silica', 'voc',
  'safety', 'scaffold', 'fall', 'residential', 'building', 'energy', 'condensation',
  'waterproofing', 'moisture', 'durability', 'corrigenda', 'quality'
];

function generateItemId(canonicalUrl) {
  return crypto.createHash('sha256').update(canonicalUrl.trim().toLowerCase()).digest('hex').substring(0, 12);
}

function classifyRelevance(title) {
  const lower = title.toLowerCase();
  const matched = TRADE_KEYWORDS.filter(kw => lower.includes(kw));
  return {
    isRelevant: matched.length > 0,
    matchedKeywords: matched
  };
}

async function runDryRun() {
  console.log('========================================================================');
  console.log('STROVYN PAINTING CO. - AUSTRALIAN INDUSTRY UPDATES DRY-RUN PIPELINE');
  console.log('Mode: Local Dry-Run (Read-Only Source Polling & Normalization)');
  console.log('Time:', new Date().toISOString());
  console.log('========================================================================\n');

  const adapters = [
    { name: 'Australian Building Codes Board (ABCB)', fn: fetchABCBUpdates },
    { name: 'Safe Work Australia', fn: fetchSafeWorkAustraliaUpdates },
    { name: 'Standards Australia', fn: fetchStandardsAustraliaUpdates },
  ];

  const overallResults = [];
  const normalizedPool = [];

  for (const adapter of adapters) {
    process.stdout.write(`Fetching ${adapter.name}... `);
    const start = Date.now();
    const result = await adapter.fn();
    const duration = Date.now() - start;

    if (result.error) {
      console.log(`[FAILED] (${duration}ms) - ${result.error}`);
    } else {
      console.log(`[SUCCESS] (${duration}ms) - ${result.items.length} items parsed`);
    }

    overallResults.push({
      adapter: adapter.name,
      status: result.error ? 'ERROR' : 'OK',
      durationMs: duration,
      error: result.error,
      itemCount: result.items.length
    });

    for (const item of result.items) {
      const id = generateItemId(item.canonicalUrl);
      const relevance = classifyRelevance(item.title);

      normalizedPool.push({
        id,
        sourceAuthority: item.sourceAuthority,
        title: item.title,
        canonicalUrl: item.canonicalUrl,
        publicationDate: item.publicationDate,
        isRelevant: relevance.isRelevant,
        matchedKeywords: relevance.matchedKeywords
      });
    }
  }

  // Deduplication check
  const seenIds = new Set();
  const uniqueItems = [];
  let duplicatesCount = 0;

  for (const item of normalizedPool) {
    if (seenIds.has(item.id)) {
      duplicatesCount++;
    } else {
      seenIds.add(item.id);
      uniqueItems.push(item);
    }
  }

  const relevantItems = uniqueItems.filter(i => i.isRelevant);

  console.log('\n------------------------------------------------------------------------');
  console.log('PIPELINE SUMMARY:');
  console.log(`Total announcements retrieved: ${normalizedPool.length}`);
  console.log(`Duplicate URLs detected:       ${duplicatesCount}`);
  console.log(`Unique items:                  ${uniqueItems.length}`);
  console.log(`Trade-relevant announcements:  ${relevantItems.length}`);
  console.log('------------------------------------------------------------------------\n');

  console.log('SAMPLE RELEVANT DISPATCHES IDENTIFIED:');
  relevantItems.slice(0, 6).forEach((item, idx) => {
    console.log(`\n[${idx + 1}] ID: ${item.id} | Source: ${item.sourceAuthority}`);
    console.log(`    Title:    ${item.title}`);
    console.log(`    Date:     ${item.publicationDate || 'Not specified in preview'}`);
    console.log(`    URL:      ${item.canonicalUrl}`);
    console.log(`    Keywords: ${item.matchedKeywords.join(', ')}`);
  });

  console.log('\n========================================================================');
  console.log('Dry-run complete. No files written to published data stores or Git.');
  console.log('========================================================================');
}

runDryRun();
