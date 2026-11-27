import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const require = createRequire(import.meta.url);
const ts = require('typescript');

function makeGeminiResponse(text, finishReason = 'STOP', extraParts = []) {
  return async () =>
    new Response(
      JSON.stringify({
        candidates: [
          {
            finishReason,
            content: {
              parts: [...extraParts, { text }],
            },
          },
        ],
        usageMetadata: { totalTokenCount: 140 },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
}

async function main() {
  process.env.STROVYN_AI_API_KEY = 'AIzaSyTestSimulatedKeyForUnitVerification99';
  process.env.STROVYN_AI_QUOTA_BACKEND = 'memory';
  delete process.env.STROVYN_AI_PROVIDER;

  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, {
    alias: {
      '@': path.join(REPO_ROOT, 'src'),
      'server-only': path.join(REPO_ROOT, 'node_modules', 'server-only', 'empty.js'),
    },
  });

  const normMod = await jiti.import(
    path.join(REPO_ROOT, 'src', 'lib', 'ai', 'stroResponseNormalizer.ts')
  );
  const serviceMod = await jiti.import(
    path.join(REPO_ROOT, 'src', 'lib', 'ai', 'stroChatService.ts')
  );
  const routeMod = await jiti.import(
    path.join(REPO_ROOT, 'src', 'app', 'api', 'ai-assistant', 'route.ts')
  );

  const {
    extractGeminiCandidateText,
    normalizeStroAssistantText,
    extractClientAssistantPayload,
    parseStroRichTextBlocks,
    isApprovedStroInternalRoute,
    isSafeStroExternalHref,
  } = normMod;

  const {
    buildStroSystemPrompt,
    sanitizeAssistantReply,
    generateStroConversationalReply,
  } = serviceMod;

  const { classifyStroIntent, POST } = routeMod;

  console.log('================================================================');
  console.log('STRO AI — CONVERSATIONAL RESPONSE FORMATTING REGRESSION SUITE');
  console.log('================================================================');

  // --- Check System Prompt Conversational Rules ---
  const sysPrompt = buildStroSystemPrompt();
  assert.ok(sysPrompt.includes('NEVER return JSON'), 'Prompt must forbid JSON payloads');
  assert.ok(sysPrompt.includes('Southern Hemisphere'), 'Prompt must include Southern Hemisphere context');
  assert.ok(sysPrompt.includes('AS/NZS 2589'), 'Prompt must ground Level 4/5 in AS/NZS 2589');
  assert.ok(sysPrompt.includes('Do NOT start replies with repetitive introductions'), 'Prompt must forbid repetitive robotic intros');

  // --- Scenario 1: Simple Greeting ---
  const s1 = classifyStroIntent('Hi STRO!');
  assert.equal(s1.intent, 'greeting');
  assert.equal(s1.actions.length, 0, 'Simple greeting should not push unnecessary quote chips');
  assert.ok(!s1.message.startsWith('{') && s1.message.includes('Hello!'));
  console.log('[PASS] 01. Simple greeting handled naturally without clutter.');

  // --- Scenario 2: Kitchen Paint Recommendation ---
  const s2 = classifyStroIntent('What paint do you recommend for a kitchen?');
  assert.equal(s2.intent, 'finishes');
  assert.ok(s2.message.includes('low-sheen or satin') && s2.message.includes('Cabinetry'));
  const s2Blocks = parseStroRichTextBlocks(s2.message);
  assert.ok(s2Blocks.some((b) => b.type === 'unordered_list'), 'Kitchen advice renders clean bullet list');
  console.log('[PASS] 02. Kitchen paint recommendation structured cleanly.');

  // --- Scenario 3: Matte vs Satin Comparison ---
  const s3Reply = await generateStroConversationalReply({
    message: 'Compare matte versus satin paint finishes for my home.',
    history: [],
    fallbackMessage: classifyStroIntent('Compare matte versus satin').message,
    fallbackActions: [],
    fetchImpl: makeGeminiResponse(
      'As STRO, the official AI assistant for Strovyn Painting Co., I can help clarify matte and satin finishes.\n\n- **Matte:** Softens light reflection and disguises minor plaster unevenness in bedrooms and ceilings.\n- **Satin:** Adds a subtle sheen with much higher washability for kitchens, hallways, and trim.'
    ),
  });
  assert.equal(s3Reply.success, true);
  assert.ok(!/^As STRO/i.test(s3Reply.message), 'Repetitive robotic preamble stripped cleanly');
  const s3Blocks = parseStroRichTextBlocks(s3Reply.message);
  assert.equal(s3Blocks[0].type, 'unordered_list');
  console.log('[PASS] 03. Matte vs Satin comparison strips preamble & parses list.');

  // --- Scenario 4: Level 4 vs Level 5 Explanation ---
  const s4 = classifyStroIntent('What is the difference between Level 4 and Level 5 plaster finish?');
  assert.ok(s4.message.includes('AS/NZS 2589') && s4.message.includes('skim coat'));
  assert.ok(!/routinely deliver/i.test(s4.message));
  console.log('[PASS] 04. Level 4 vs Level 5 grounded in AS/NZS 2589 without overclaiming.');

  // --- Scenario 5: Adelaide North-Facing Room Colour Advice ---
  const s5 = classifyStroIntent('What colour advice works for an Adelaide north-facing room?');
  assert.ok(s5.message.includes('Southern Hemisphere') && s5.message.includes('warm'));
  console.log('[PASS] 05. Adelaide north-facing room reflects Southern Hemisphere sun.');

  // --- Scenario 6: Multi-Turn Follow-up (with legacy serialized JSON in history) ---
  let capturedRequestBody = null;
  const s6Reply = await generateStroConversationalReply({
    message: 'What about the skirting boards in that room?',
    history: [
      { role: 'user', content: 'I am painting a north-facing living room in Norwood.' },
      {
        role: 'assistant',
        content: '{"answer":"In Norwood, north-facing rooms receive warm daylight, so balanced neutrals work well on walls."}',
      },
    ],
    fallbackMessage: 'Fallback',
    fallbackActions: [],
    fetchImpl: async (_url, init) => {
      capturedRequestBody = JSON.parse(String(init?.body || '{}'));
      return makeGeminiResponse(
        'For the skirting boards in that living room, a **waterborne satin or semi-gloss enamel** resists vacuum knocks while staying non-yellowing.'
      )();
    },
  });
  assert.equal(s6Reply.success, true);
  const modelHistoryText = capturedRequestBody.contents[1].parts[0].text;
  assert.ok(!modelHistoryText.startsWith('{'), 'Serialized JSON in history normalized before provider call');
  assert.ok(modelHistoryText.includes('In Norwood, north-facing rooms'));
  console.log('[PASS] 06. Multi-turn follow-up preserves context & cleans serialized history.');

  // --- Scenario 7: Detailed Technical Question + Multi-Part / Thought Filtering ---
  const extractedMulti = extractGeminiCandidateText({
    candidates: [
      {
        finishReason: 'STOP',
        content: {
          parts: [
            { thought: true, text: '{"internal_reasoning": "thinking about silicates"}' },
            { text: 'Historic Adelaide sandstone requires vapour-permeable coatings.\n\n' },
            { text: '- **Mineral Silicate:** Chemically bonds with stone while allowing moisture vapour to escape.\n- **Standard Acrylic:** Forms a film that can trap rising damp and accelerate stone fretting.' },
          ],
        },
      },
    ],
  });
  assert.ok(!extractedMulti.text.includes('internal_reasoning'), 'Thought parts excluded');
  assert.ok(extractedMulti.text.includes('Mineral Silicate'));
  console.log('[PASS] 07. Detailed technical multi-part response extracted without thought leak.');

  // --- Scenario 8: Short Homeowner Question (No Hours Trap) ---
  const s8 = classifyStroIntent('How many hours should I wait between coats of wall paint?');
  assert.notEqual(s8.intent, 'scheduling_refusal', 'Drying hours must not trigger studio opening hours refusal');
  console.log('[PASS] 08. Short homeowner recoating question avoids scheduling trap.');

  // --- Scenario 9: Numbered Painting Preparation Steps ---
  const s9 = classifyStroIntent('What preparation steps do you follow before painting?');
  const s9Blocks = parseStroRichTextBlocks(s9.message);
  const orderedBlock = s9Blocks.find((b) => b.type === 'ordered_list');
  assert.ok(orderedBlock && orderedBlock.items.length === 4, 'Numbered preparation steps parsed as <ol>');
  console.log('[PASS] 09. Numbered preparation steps parsed into ordered list AST.');

  // --- Scenario 10: Invalid / Malformed JSON-like Provider Response & Error Object ---
  const brokenJsonNorm = normalizeStroAssistantText(
    '{"answer": "For high-moisture bathrooms, use satin acrylic, because'
  );
  assert.equal(brokenJsonNorm.ok, false);
  assert.equal(brokenJsonNorm.reason, 'MALFORMED_JSON_RESPONSE');

  const rawErrorObjNorm = normalizeStroAssistantText(
    '{"error": {"code": 500, "message": "Internal provider failure"}}'
  );
  assert.equal(rawErrorObjNorm.ok, false);

  const s10Reply = await generateStroConversationalReply({
    message: 'What finish works in a hallway?',
    history: [],
    fallbackMessage: classifyStroIntent('What finish works in a hallway?').message,
    fallbackActions: [],
    fetchImpl: makeGeminiResponse('```json\n{"answer": "Truncated broken JSON payload...\n```'),
  });
  assert.equal(s10Reply.success, true);
  assert.equal(s10Reply.provider, 'fallback');
  assert.ok(!s10Reply.message.includes('{') && !s10Reply.message.includes('```'));
  console.log('[PASS] 10. Invalid/malformed JSON-like provider output safely replaced with conversational fallback.');

  // --- Scenario 11: JSON Containing Answer Field (Direct, Fenced, Nested & Composite) ---
  const fencedJson = normalizeStroAssistantText(
    '```json\n{\n  "answer": "Low-sheen acrylic is ideal for family living rooms.\\n\\nIt cleans easily without highlighting plaster joints."\n}\n```'
  );
  assert.equal(fencedJson.ok, true);
  assert.equal(fencedJson.unwrappedFromJson, true);
  assert.equal(fencedJson.strippedFence, true);
  assert.ok(fencedJson.content.includes('Low-sheen acrylic is ideal'));
  assert.ok(!fencedJson.content.includes('"answer"') && !fencedJson.content.includes('```'));

  const nestedEnvelope = normalizeStroAssistantText(
    JSON.stringify({
      success: true,
      message: {
        role: 'assistant',
        content: 'Waterborne enamel stays crisp white on skirtings and doors.',
      },
    })
  );
  assert.equal(nestedEnvelope.ok, true);
  assert.equal(nestedEnvelope.content, 'Waterborne enamel stays crisp white on skirtings and doors.');

  const compositeJson = normalizeStroAssistantText(
    JSON.stringify({
      summary: 'Here is how to prepare timber trim:',
      steps: ['Wash with sugar soap', 'De-gloss with 180-grit abrasive', 'Apply stain-blocking primer'],
      followUp: 'Are your skirtings bare timber or previously painted in oil enamel?',
    })
  );
  assert.equal(compositeJson.ok, true);
  assert.ok(compositeJson.content.includes('1. Wash with sugar soap'));
  console.log('[PASS] 11. Valid JSON answer envelopes (direct, fenced, nested, composite) unwrapped cleanly.');

  // --- Scenario 12: Markdown Bold, Lists, Safe Internal Links & XSS/External Link Neutralization ---
  const mdSample = [
    'Explore our [Cabinetry Service](/services/fine-cabinetry-millwork) or preview colours in /visualiser.',
    '',
    '- **Safe Link:** [YourHome Guide](https://www.yourhome.gov.au/passive-design)',
    '- **Untrusted Link:** [Click Here](https://untrusted-phishing.example.com/steal)',
    '- **XSS Attempt:** <script>window.__hacked=1</script>Safe text remains.',
  ].join('\n');
  const normMd = normalizeStroAssistantText(mdSample);
  assert.equal(normMd.ok, true);
  assert.ok(!normMd.content.includes('<script>'), 'Script tags stripped during normalization');
  const mdBlocks = parseStroRichTextBlocks(normMd.content);
  const serializedAst = JSON.stringify(mdBlocks);
  assert.ok(serializedAst.includes('"/services/fine-cabinetry-millwork"'));
  assert.ok(serializedAst.includes('"/visualiser"'));
  assert.ok(serializedAst.includes('"https://www.yourhome.gov.au/passive-design"'));
  assert.ok(!serializedAst.includes('untrusted-phishing.example.com'), 'Untrusted external URL stripped');
  assert.ok(serializedAst.includes('Click Here'), 'Link label text preserved safely');
  assert.equal(isApprovedStroInternalRoute('/admin/insurance'), false, '/admin routes blocked');
  assert.equal(isSafeStroExternalHref('javascript:alert(1)'), false, 'javascript: blocked');
  console.log('[PASS] 12. Markdown AST renders bold, lists & approved routes while blocking XSS & untrusted URLs.');

  // --- Scenario 13: Escaped Newlines ---
  const escapedSample = normalizeStroAssistantText(
    'Allow 2 to 4 hours between coats.\\n\\n- Check tin recoat guidance\\n- Allow extra time in cool, humid weather'
  );
  assert.equal(escapedSample.ok, true);
  assert.equal(escapedSample.convertedEscapedNewlines, true);
  assert.ok(!escapedSample.content.includes('\\n'), 'No literal backslash-n remains');
  const escapedBlocks = parseStroRichTextBlocks(escapedSample.content);
  assert.equal(escapedBlocks.length, 2);
  assert.equal(escapedBlocks[1].type, 'unordered_list');
  console.log('[PASS] 13. Escaped literal newlines converted into rendered paragraphs & lists.');

  // --- Scenario 14: Provider Timeout ---
  const s14Reply = await generateStroConversationalReply({
    message: 'Explain mineral silicate masonry coatings',
    history: [],
    fallbackMessage: 'Fallback',
    fallbackActions: [],
    fetchImpl: async () => {
      const abortErr = new Error('Timed out');
      abortErr.name = 'AbortError';
      throw abortErr;
    },
  });
  assert.equal(s14Reply.success, false);
  assert.equal(s14Reply.errorCode, 'PROVIDER_TIMEOUT');
  const clientTimeout = extractClientAssistantPayload(
    { success: false, error: s14Reply.message, reply: { role: 'assistant', content: s14Reply.message } },
    504
  );
  assert.equal(clientTimeout.ok, false);
  assert.ok(clientTimeout.content.includes('timed out'));
  console.log('[PASS] 14. Provider timeout returns conversational error with client retry support.');

  // --- Scenario 15: API Contract & Rate-Limit Fallback ---
  process.env.STROVYN_AI_PROVIDER = 'deterministic';
  const okReq = new Request('http://localhost/api/ai-assistant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-nf-client-connection-ip': '198.51.100.41',
    },
    body: JSON.stringify({ message: 'What finishes work best in hallways?' }),
  });
  const okRes = await POST(okReq);
  assert.equal(okRes.status, 200);
  const okJson = await okRes.json();
  assert.equal(okJson.success, true);
  assert.equal(okJson.reply?.role, 'assistant');
  assert.equal(typeof okJson.reply?.content, 'string');
  assert.equal(okJson.message, okJson.reply.content, 'Backward-compatible string message matches reply.content');
  assert.equal('provider' in okJson, false, 'Internal provider metadata omitted from public HTTP response');
  assert.equal('model' in okJson, false, 'Internal model metadata omitted from public HTTP response');

  let hit429 = false;
  let rateLimitJson = null;
  for (let i = 0; i < 15; i += 1) {
    const rlReq = new Request('http://localhost/api/ai-assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-nf-client-connection-ip': '198.51.100.99',
      },
      body: JSON.stringify({ message: `Burst question ${i}` }),
    });
    const rlRes = await POST(rlReq);
    if (rlRes.status === 429) {
      hit429 = true;
      rateLimitJson = await rlRes.json();
      break;
    }
  }
  assert.equal(hit429, true, 'Burst rate limit must trigger 429');
  assert.equal(rateLimitJson.success, false);
  assert.equal(typeof rateLimitJson.error, 'string');
  assert.equal(rateLimitJson.reply?.role, 'assistant');
  delete process.env.STROVYN_AI_PROVIDER;
  console.log('[PASS] 15. API response contract & 429 rate-limit fallback verified.');

  // --- Scenario 16: Prompt Injection, Admin Path & Price Sanitization ---
  const injected = sanitizeAssistantReply(
    'Secret key AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz123456 at /admin/insurance costs $65 per sqm for zero brush marks.'
  );
  assert.ok(!injected.includes('AIzaSy'));
  assert.ok(!injected.includes('/admin'));
  assert.ok(!injected.includes('$65'));
  assert.ok(!injected.includes('[custom quoted]'), 'Uses natural prose instead of raw bracket placeholder');
  assert.ok(injected.includes('site-assessed quotation'));
  assert.ok(injected.includes('minimal visible brush marks'));
  console.log('[PASS] 16. Prompt injection, secret redaction, admin path rewrite & price calibration verified.');

  // --- Scenario 17: Mobile Long-Text Safety, Mid-Sentence Cutoff Guard & Explicit User JSON Preservation ---
  const truncatedMaxTokens = normalizeStroAssistantText(
    'Matte absorbs raking light cleanly across ceilings. Satin adds washability in hallways and wet areas. For trim and cabinetry we recommend satin, semi-g',
    { userMessage: 'Compare matte vs satin', finishReason: 'MAX_TOKENS' }
  );
  assert.equal(truncatedMaxTokens.ok, true);
  assert.ok(!truncatedMaxTokens.content.endsWith('semi-g'), 'Partial MAX_TOKENS fragment cleanly trimmed');
  assert.ok(truncatedMaxTokens.content.endsWith('wet areas.'));

  const explicitJsonQuery = 'Can you show me a JSON example of a room colour schedule?';
  const explicitJsonAnswer = 'Here is an example structure:\n\n```json\n{\n  "room": "Living",\n  "finish": "Low Sheen"\n}\n```';
  const preservedJson = normalizeStroAssistantText(explicitJsonAnswer, {
    userMessage: explicitJsonQuery,
  });
  assert.equal(preservedJson.ok, true);
  assert.equal(preservedJson.preserveCodeBlocks, true);
  assert.ok(preservedJson.content.includes('"room": "Living"'), 'Explicitly requested JSON preserved intact');
  const codeBlocks = parseStroRichTextBlocks(preservedJson.content, { allowCodeBlocks: true });
  assert.ok(codeBlocks.some((b) => b.type === 'code_block'), 'Explicit code block rendered in <pre><code>');

  // Verify TSX components transpile cleanly & never use dangerouslySetInnerHTML
  for (const rel of [
    'src/components/floating/StroFormattedMessage.tsx',
    'src/components/floating/AIAssistant.tsx',
  ]) {
    const full = path.join(REPO_ROOT, rel);
    const src = fs.readFileSync(full, 'utf8');
    assert.equal(
      src.includes('dangerouslySetInnerHTML'),
      false,
      `${rel} must never use dangerouslySetInnerHTML`
    );
    ts.transpileModule(src, {
      fileName: full,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        strict: true,
      },
    });
  }
  const assistantUiSrc = fs.readFileSync(
    path.join(REPO_ROOT, 'src/components/floating/AIAssistant.tsx'),
    'utf8'
  );
  assert.ok(assistantUiSrc.includes('overflow-wrap:anywhere'), 'Mobile 390px long-word wrapping enforced');
  console.log('[PASS] 17. Mobile overflow protection, MAX_TOKENS sentence trim & explicit JSON preservation verified.');

  console.log('\n================================================================');
  console.log('ALL 17 STRO AI FORMATTING & CONVERSATIONAL CHECKS PASSED (17/17)');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('\n[FAIL] STRO AI formatting test suite failed:', err);
  process.exit(1);
});
