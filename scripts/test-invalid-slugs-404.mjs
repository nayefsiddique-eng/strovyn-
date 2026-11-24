import assert from 'node:assert/strict';

const BASE_URL = process.env.QA_BASE_URL || 'http://127.0.0.1:3000';

async function assertStatus(routePath, expectedStatus) {
  const res = await fetch(`${BASE_URL}${routePath}`);
  assert.equal(
    res.status,
    expectedStatus,
    `Expected HTTP ${expectedStatus} on ${routePath}, got ${res.status}`
  );
  return { routePath, status: res.status };
}

async function main() {
  const results = [];
  results.push(await assertStatus('/projects/nonexistent-qa-slug-check', 404));
  results.push(await assertStatus('/projects/adelaide-hills-coastal-estate', 404)); // draft in staging
  results.push(await assertStatus('/projects/the-north-adelaide-residence', 200)); // published in staging
  results.push(await assertStatus('/insights/nonexistent-qa-slug-check', 404));
  results.push(await assertStatus('/services/nonexistent-qa-slug-check', 404));
  results.push(await assertStatus('/services/interior-architectural-painting', 200));

  console.log('HTTP_404_REGRESSION_PASS:', JSON.stringify(results));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
