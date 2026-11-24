import assert from 'node:assert/strict';

const BASE_URL = process.env.QA_BASE_URL || 'http://127.0.0.1:3000';

async function checkNotFoundRoute(routePath) {
  const res = await fetch(`${BASE_URL}${routePath}`);
  const html = await res.text();
  const isHttp404 = res.status === 404;
  const isPprStreamedNotFound =
    res.status === 200 &&
    /not found|could not be found|404/i.test(html) &&
    html.includes('noindex');
  assert.ok(
    isHttp404 || isPprStreamedNotFound,
    `Expected HTTP 404 or PPR streamed not-found UI with noindex on ${routePath}, got status=${res.status}`
  );
  return { routePath, status: res.status, mode: isHttp404 ? 'http-404' : 'ppr-streamed-not-found' };
}

async function main() {
  const results = [];
  for (const r of [
    '/projects/nonexistent-qa-slug-check',
    '/insights/nonexistent-qa-slug-check',
    '/services/nonexistent-qa-slug-check',
  ]) {
    results.push(await checkNotFoundRoute(r));
  }
  console.log('INVALID_SLUG_REGRESSION_PASS:', JSON.stringify(results));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
