import assert from 'node:assert/strict';
import path from 'node:path';

const REPO_ROOT = process.cwd();

async function main() {
  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, {
    alias: {
      '@': path.join(REPO_ROOT, 'src'),
      'server-only': path.join(REPO_ROOT, 'node_modules', 'server-only', 'empty.js'),
    },
  });

  const stroChatMod = await jiti.import(
    path.join(REPO_ROOT, 'src', 'lib', 'ai', 'stroChatService.ts')
  );
  const routeMod = await jiti.import(
    path.join(REPO_ROOT, 'src', 'app', 'api', 'ai-assistant', 'route.ts')
  );

  const {
    buildStroSystemPrompt,
    sanitizeAssistantReply,
    formatTransparentFallbackMessage,
    generateStroConversationalReply,
  } = stroChatMod;

  const { classifyStroIntent } = routeMod;

  console.log('================================================================');
  console.log('STRO AI — AUSTRALIAN ACCURACY & BUSINESS GROUNDING TEST SUITE');
  console.log('================================================================');

  // --- 1. Testing System Prompt: Australian Reasoning & Grounding ---
  console.log('\n--- 1. Testing System Prompt: Australian Reasoning & Grounding ---');
  const prompt = buildStroSystemPrompt();

  assert.ok(
    prompt.includes('Southern Hemisphere'),
    'Prompt must explicitly specify Southern Hemisphere context'
  );
  assert.ok(
    prompt.includes('North-facing') && prompt.includes('greatest direct solar exposure'),
    'Prompt must correctly state north-facing rooms receive greatest direct sun in Australia'
  );
  assert.ok(
    prompt.includes('winter'),
    'Prompt must note the sun tracks lower in the northern sky during Australian winter'
  );
  assert.ok(
    prompt.includes('South-facing') && prompt.includes('indirect, diffuse'),
    'Prompt must correctly state south-facing rooms receive diffuse/indirect cooler daylight'
  );
  assert.ok(
    prompt.includes('West-facing') && prompt.includes('afternoon sun'),
    'Prompt must note west-facing rooms receive intense low-angle afternoon sun and heat load'
  );
  assert.ok(
    prompt.includes('YourHome'),
    'Prompt must reference YourHome / sustainable building guidance'
  );

  // Australian Standards & Material Science
  assert.ok(
    prompt.includes('AS/NZS 2589'),
    'Prompt must cite AS/NZS 2589 plasterboard finishing standard'
  );
  assert.ok(
    prompt.includes('Level 4') && prompt.includes('Level 5'),
    'Prompt must differentiate Level 4 vs Level 5 plasterboard finishes'
  );
  assert.ok(
    prompt.includes('glancing') || prompt.includes('raking light'),
    'Prompt must identify glancing/raking light as the trigger for Level 5 skimming'
  );
  assert.ok(
    prompt.includes('mineral silicate') && prompt.includes('vapour-permeable'),
    'Prompt must specify vapour-permeable mineral silicates for historic masonry'
  );
  assert.ok(
    prompt.toLowerCase().includes('efflorescence') && prompt.toLowerCase().includes('moisture'),
    'Prompt must describe efflorescence as salt migration requiring moisture rectification'
  );

  // Business Grounding & No Unverified Claims
  assert.ok(
    prompt.includes('DO NOT claim that Strovyn routinely delivers Level 5'),
    'Prompt must forbid claiming Strovyn routinely delivers Level 5 finishes'
  );
  assert.ok(
    prompt.includes('routinely applies 2K polyurethane') || prompt.includes('routinely uses 2K polyurethane'),
    'Prompt must forbid claiming Strovyn routinely applies 2K polyurethanes across standard jobs'
  );
  assert.ok(
    prompt.includes('Stirling') && prompt.includes('Adelaide Hills'),
    'Prompt must require direct business confirmation for Stirling and Adelaide Hills'
  );

  // Prohibited Absolute Promises
  assert.ok(
    prompt.includes('zero brush marks') && prompt.includes('flawless finishes'),
    'Prompt must explicitly forbid promises like "zero brush marks" and "flawless finishes"'
  );

  // Australian Spelling
  assert.ok(
    prompt.includes('colour') && prompt.includes('catalysed') && prompt.includes('specialised'),
    'Prompt must enforce Australian spelling'
  );

  console.log('[PASS] System prompt contains rigorous Australian geographic reasoning, AS/NZS 2589, and strict business grounding.');

  // --- 2. Testing Intent Classification Regex Fixes (No Keyword Traps) ---
  console.log('\n--- 2. Testing Intent Classification Regex Fixes (No Keyword Traps) ---');

  // Case A: "open-plan" must NOT trigger scheduling_refusal
  const openPlan = classifyStroIntent('What colours look best in an open-plan living room?');
  assert.notEqual(
    openPlan.intent,
    'scheduling_refusal',
    'Open-plan queries must not trigger scheduling_refusal'
  );
  console.log(`[PASS] "open-plan" classified as: ${openPlan.intent} (NOT scheduling_refusal)`);

  // Case B: "drying hours" must NOT trigger scheduling_refusal
  const dryingHours = classifyStroIntent('How many hours between coats of acrylic wall paint?');
  assert.notEqual(
    dryingHours.intent,
    'scheduling_refusal',
    'Drying hours must not trigger scheduling_refusal'
  );
  console.log(`[PASS] "hours between coats" classified as: ${dryingHours.intent} (NOT scheduling_refusal)`);

  // Case C: Actual business hours query MUST trigger scheduling_refusal
  const businessHours = classifyStroIntent('What are your business trading hours on weekends?');
  assert.equal(
    businessHours.intent,
    'scheduling_refusal',
    'Actual business hours queries must trigger scheduling_refusal'
  );
  console.log('[PASS] Actual business hours query correctly identified as scheduling_refusal');

  // Case D: "paint job" must NOT trigger careers
  const paintJob = classifyStroIntent('How many years should a high quality interior paint job last?');
  assert.notEqual(
    paintJob.intent,
    'careers',
    '"paint job" must not trigger careers intent'
  );
  console.log(`[PASS] "paint job" classified as: ${paintJob.intent} (NOT careers)`);

  // Case E: Actual job application MUST trigger careers
  const jobApp = classifyStroIntent('I want to apply for a painter position or apprenticeship');
  assert.equal(
    jobApp.intent,
    'careers',
    'Employment applications must trigger careers'
  );
  console.log('[PASS] Job application correctly identified as careers');

  // Case F: Stirling & Adelaide Hills queries MUST trigger service-area boundary guidance
  const hills = classifyStroIntent('Do you paint homes in Stirling and the Adelaide Hills?');
  assert.equal(hills.intent, 'contact');
  assert.ok(
    hills.message.includes('Stirling') && hills.message.includes('direct confirmation'),
    'Hills inquiry must explain availability requires direct confirmation'
  );
  console.log('[PASS] Adelaide Hills / Stirling inquiry returns required confirmation guidance');

  // Case G: Pricing inquiry MUST trigger pricing refusal without dollar figures
  const price = classifyStroIntent('How much does it cost per square metre to paint a room?');
  assert.equal(price.intent, 'pricing_refusal');
  assert.ok(
    !/\$\d+/.test(price.message),
    'Pricing refusal must never include dollar amounts'
  );
  console.log('[PASS] Pricing query triggers grounded refusal without invented dollar amounts');

  // --- 3. Testing Output Sanitizer & Calibrated Language ---
  console.log('\n--- 3. Testing Output Sanitizer & Calibrated Language ---');

  // A: Absolute promises are softened
  const rawWithAbsolutes =
    'Our spray application guarantees zero brush marks and a flawless finish with maximum adhesion and complete mould prevention.';
  const sanitized = sanitizeAssistantReply(rawWithAbsolutes);

  assert.ok(!sanitized.includes('zero brush marks'), 'Sanitizer must remove "zero brush marks"');
  assert.ok(!sanitized.includes('flawless finish'), 'Sanitizer must remove "flawless finish"');
  assert.ok(!sanitized.includes('maximum adhesion'), 'Sanitizer must remove "maximum adhesion"');
  assert.ok(!sanitized.includes('complete mould prevention'), 'Sanitizer must remove "complete mould prevention"');
  assert.ok(sanitized.includes('minimal visible brush marks'), 'Sanitizer must calibrate to "minimal visible brush marks"');
  assert.ok(sanitized.includes('refined, uniform finish'), 'Sanitizer must calibrate to "refined, uniform finish"');
  assert.ok(sanitized.includes('optimal adhesion'), 'Sanitizer must calibrate to "optimal adhesion"');
  assert.ok(sanitized.includes('effective mould inhibition'), 'Sanitizer must calibrate to "effective mould inhibition"');
  console.log('[PASS] Absolute promises softened into calibrated technical language');

  // B: Unsupported operational claims softened
  const rawWithRoutineClaims = 'We routinely deliver Level 5 finishes and we routinely use 2K polyurethane.';
  const sanitizedClaims = sanitizeAssistantReply(rawWithRoutineClaims);
  assert.ok(!sanitizedClaims.includes('routinely deliver Level 5'));
  assert.ok(!sanitizedClaims.includes('routinely use 2K'));
  console.log('[PASS] Unsupported routine operational claims removed');

  // C: Secret and credential leakage protection
  const rawWithSecret = 'Call endpoint with AIzaSyDfake1234567890abcdef1234567890 keys and /admin/users';
  const sanitizedSecret = sanitizeAssistantReply(rawWithSecret);
  assert.ok(!sanitizedSecret.includes('AIzaSyDfake1234567890abcdef1234567890'));
  assert.ok(sanitizedSecret.includes('[redacted]'));
  assert.ok(!sanitizedSecret.includes('/admin/users'));
  console.log('[PASS] API keys redacted and admin paths masked');

  // --- 4. Testing Fallback Transparency ---
  console.log('\n--- 4. Testing Fallback Transparency ---');

  const rawFallback = 'Strovyn Painting Co. serves Greater Adelaide.';
  const formatted = formatTransparentFallbackMessage(rawFallback);
  assert.ok(
    formatted.startsWith('[Strovyn Guidance]'),
    'Fallback message must be transparently labelled with [Strovyn Guidance]'
  );

  const origProvider = process.env.STROVYN_AI_PROVIDER;
  process.env.STROVYN_AI_PROVIDER = 'deterministic';

  try {
    const offlineResult = await generateStroConversationalReply({
      message: 'What finishes do you offer?',
      history: [],
      fallbackMessage: 'Finish options include ultra-flat, low-sheen, and satin enamel.',
      fallbackActions: [],
    });

    assert.equal(offlineResult.provider, 'fallback');
    assert.equal(offlineResult.model, 'strovyn-guidance-v2');
    assert.equal(offlineResult.connected, false);
    assert.ok(offlineResult.message.startsWith('[Strovyn Guidance]'));
    console.log('[PASS] Offline fallback returns provider="fallback", model="strovyn-guidance-v2", and [Strovyn Guidance] prefix');
  } finally {
    process.env.STROVYN_AI_PROVIDER = origProvider;
  }

  // --- 5. Testing Mocked Gemini Conversational Turn with Australian Solar Physics ---
  console.log('\n--- 5. Testing Mocked Gemini Conversational Turn with Australian Solar Physics ---');

  const mockGeminiResponse = {
    candidates: [
      {
        content: {
          parts: [
            {
              text: 'In Adelaide (Southern Hemisphere), north-facing rooms receive the greatest direct solar exposure throughout the day, particularly during winter when the sun tracks lower in the northern sky. Paint colours in north-facing rooms appear warmer and more luminous, so cool or balanced neutral undertones work beautifully to maintain visual equilibrium.',
            },
          ],
        },
      },
    ],
    usageMetadata: { totalTokenCount: 120 },
  };

  const mockFetch = async () => {
    return new Response(JSON.stringify(mockGeminiResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const origKey = process.env.STROVYN_AI_API_KEY;
  process.env.STROVYN_AI_API_KEY = 'AIzaSyD_Test_Valid_Key_Length_32chars__';

  try {
    const res = await generateStroConversationalReply({
      message: 'How does natural light in a north-facing room affect paint colour in Adelaide?',
      history: [],
      fallbackMessage: 'Fallback guidance',
      fallbackActions: [],
      fetchImpl: mockFetch,
    });

    assert.equal(res.provider, 'gemini');
    assert.equal(res.connected, true);
    assert.ok(res.message.includes('Southern Hemisphere'));
    assert.ok(res.message.includes('north-facing rooms receive the greatest direct solar exposure'));
    assert.ok(res.message.includes('winter'));
    console.log('[PASS] Mocked Gemini response correctly passes through Southern Hemisphere physics without fallback');
  } finally {
    process.env.STROVYN_AI_API_KEY = origKey;
  }

  console.log('\n================================================================');
  console.log('ALL 5 AUSTRALIAN ACCURACY & BUSINESS GROUNDING TEST SUITES PASSED');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
