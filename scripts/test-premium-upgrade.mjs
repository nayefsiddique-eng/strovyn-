import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

async function testIntroReplayArchitecture() {
  const layoutSrc = fs.readFileSync(path.join(ROOT, 'src/app/layout.tsx'), 'utf8');
  const wrapperSrc = fs.readFileSync(path.join(ROOT, 'src/components/intro/IntroWrapper.tsx'), 'utf8');
  const introSrc = fs.readFileSync(path.join(ROOT, 'src/components/intro/CinematicIntro.tsx'), 'utf8');

  assert.ok(!layoutSrc.includes('strovyn_intro_seen'), 'layout.tsx must not gate intro via sessionStorage');
  assert.ok(!wrapperSrc.includes('strovyn_intro_seen'), 'IntroWrapper.tsx must not gate intro via sessionStorage');
  assert.ok(!introSrc.includes('strovyn_intro_seen'), 'CinematicIntro.tsx must not persist strovyn_intro_seen');
  assert.ok(wrapperSrc.includes('hasCompletedIntroInDocument'), 'IntroWrapper.tsx must use in-memory per-document guard');
  assert.ok(wrapperSrc.includes('prefersReducedMotion'), 'IntroWrapper.tsx must respect prefers-reduced-motion');
  console.log('[OK] Intro replay architecture & reduced-motion checks passed.');
}

async function testFirstClickActivationArchitecture() {
  const cardSrc = fs.readFileSync(path.join(ROOT, 'src/components/cms/StaffActivateCard.tsx'), 'utf8');
  assert.ok(cardSrc.includes('inFlightUrlExchanges'), 'StaffActivateCard must deduplicate URL token exchanges');
  assert.ok(cardSrc.includes('onAuthStateChange'), 'StaffActivateCard must subscribe to onAuthStateChange');
  assert.ok(cardSrc.includes('verifyOtp'), 'StaffActivateCard must support token_hash OTP verification');
  assert.ok(cardSrc.includes('exchangeCodeForSession'), 'StaffActivateCard must support PKCE code exchange');
  assert.ok(cardSrc.includes('setSession'), 'StaffActivateCard must support implicit hash fragment tokens');
  assert.ok(cardSrc.includes('classifyAuthUrlError'), 'StaffActivateCard must distinguish expired vs invalid/used links');
  assert.ok(cardSrc.includes('submittingRef.current'), 'StaffActivateCard must prevent double password submission');
  console.log('[OK] First-click invitation activation checks passed.');
}

async function testVisualRefinementComponents() {
  const approachSrc = fs.readFileSync(path.join(ROOT, 'src/components/home/StrovynApproach.tsx'), 'utf8');
  const expertiseSrc = fs.readFileSync(path.join(ROOT, 'src/components/home/OurExpertise.tsx'), 'utf8');

  assert.ok(!approachSrc.includes('ArchitecturalTiltCard'), 'StrovynApproach should not use 3D tilt/glow cards');
  assert.ok(!expertiseSrc.includes('ArchitecturalTiltCard'), 'OurExpertise should not use 3D tilt/glow cards');
  assert.ok(!approachSrc.includes('ADELAIDE ARCHITECTURAL SPECIALISTS'), 'StrovynApproach should not duplicate WhyChooseUs banner');
  console.log('[OK] Visual refinement component checks passed.');
}

async function testStroAiServiceAndRoute() {
  const stroSrc = fs.readFileSync(path.join(ROOT, 'src/lib/ai/stroChatService.ts'), 'utf8');
  const routeSrc = fs.readFileSync(path.join(ROOT, 'src/app/api/ai-assistant/route.ts'), 'utf8');

  assert.ok(stroSrc.includes('STROVYN_AI_API_KEY'), 'stroChatService must resolve STROVYN_AI_API_KEY');
  assert.ok(stroSrc.includes('gemini-2.5-flash'), 'stroChatService must target gemini-2.5-flash');
  assert.ok(stroSrc.includes('resolveGeminiBaseUrl'), 'stroChatService must reuse direct Google routing');
  assert.ok(stroSrc.includes('public_stro:global'), 'stroChatService must enforce durable cross-instance daily limits');
  assert.ok(stroSrc.includes('sanitizeAssistantReply'), 'stroChatService must sanitize and ground replies');
  assert.ok(routeSrc.includes('checkStroPublicAbuseLimits'), 'ai-assistant route must enforce public abuse limits');
  assert.ok(routeSrc.includes('generateStroConversationalReply'), 'ai-assistant route must call conversational Gemini service');
  console.log('[OK] STRO AI conversational engine & abuse-protection checks passed.');
}

async function main() {
  await testIntroReplayArchitecture();
  await testFirstClickActivationArchitecture();
  await testVisualRefinementComponents();
  await testStroAiServiceAndRoute();
  console.log('ALL PREMIUM UPGRADE REGRESSION CHECKS PASSED (4/4)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
