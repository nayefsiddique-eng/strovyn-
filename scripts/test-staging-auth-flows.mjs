import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { createClient } from '@supabase/supabase-js';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

function loadEnvLocalSafely() {
  const envPath = path.join(REPO_ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

function transpileTsFile(relPath) {
  const fullPath = path.join(REPO_ROOT, relPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  return ts.transpileModule(source, {
    fileName: fullPath,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      strict: true,
    },
  }).outputText;
}

function resolveProjectPath(baseRel) {
  const clean = baseRel.replace(/\\/g, '/');
  for (const candidate of [clean, `${clean}.ts`, `${clean}.tsx`, `${clean}/index.ts`]) {
    if (fs.existsSync(path.join(REPO_ROOT, candidate))) {
      return candidate;
    }
  }
  return clean;
}

function loadProjectTsModule(relPath, customModules = {}, cache = new Map()) {
  const normalizedRel = resolveProjectPath(relPath);
  if (cache.has(normalizedRel)) {
    return cache.get(normalizedRel).exports;
  }

  const mod = { exports: {} };
  cache.set(normalizedRel, mod);

  const code = transpileTsFile(normalizedRel);
  const dir = path.dirname(normalizedRel);

  const localRequire = (specifier) => {
    if (Object.prototype.hasOwnProperty.call(customModules, specifier)) {
      return customModules[specifier];
    }
    if (specifier.startsWith('@/')) {
      return loadProjectTsModule(`src/${specifier.slice(2)}`, customModules, cache);
    }
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      const joined = path.posix.normalize(path.posix.join(dir, specifier));
      return loadProjectTsModule(joined, customModules, cache);
    }
    return require(specifier);
  };

  const fn = new vm.Script(
    `(function(exports, require, module, __filename, __dirname) {\n${code}\n})`,
    { filename: normalizedRel }
  );
  fn.runInThisContext()(
    mod.exports,
    localRequire,
    mod,
    path.join(REPO_ROOT, normalizedRel),
    path.join(REPO_ROOT, dir)
  );
  return mod.exports;
}

function makeFreshAnonClient(supabaseUrl, anonKey) {
  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function main() {
  console.log('=== STROVYN STAGING SUPABASE AUTH, INVITATION & RECOVERY VERIFICATION ===');
  loadEnvLocalSafely();

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  assert.equal(
    supabaseUrl,
    'https://euhgtzblwyogmqdldmni.supabase.co',
    'Safety guard: Auth verification must run ONLY on staging Supabase (euhgtzblwyogmqdldmni).'
  );
  assert.ok(anonKey.length > 20);
  assert.ok(serviceKey.length > 20);

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cache = new Map();
  const stubs = { 'server-only': {} };
  const staffMgmtMod = loadProjectTsModule('src/lib/cms/staffManagementService.ts', stubs, cache);
  const rbacMod = loadProjectTsModule('src/lib/cms/rbac.ts', stubs, cache);

  const runTag = `${Date.now()}`;
  const mailerProbeEmail = `staging.mailer.probe.${runTag}@gmail.com`;
  const disposableStaffEmail = `staging.staff.qa.${runTag}@example.com`;
  // Ephemeral random passwords generated in memory only — never logged or persisted
  const initialPassword = `StrovynQa1!${crypto.randomBytes(6).toString('hex')}`;
  const rotatedPassword = `StrovynQa2#${crypto.randomBytes(6).toString('hex')}`;

  assert.notEqual(mailerProbeEmail, 'strovyn@gmail.com');
  assert.notEqual(disposableStaffEmail, 'strovyn@gmail.com');

  const createdAuthUserIds = [];
  const createdInvitationIds = [];
  const createdStaffIds = [];

  try {
    // -------------------------------------------------------------------------
    // 1. Live Built-in Supabase Mailer Diagnostic Probe (External Recipient)
    // -------------------------------------------------------------------------
    console.log('\n[1/4] Probing built-in Supabase Auth mailer behavior for external non-org address...');
    const { data: rawInviteData, error: rawInviteErr } = await serviceClient.auth.admin.inviteUserByEmail(
      mailerProbeEmail,
      {
        data: { full_name: 'Staging Mailer Probe' },
        redirectTo: 'https://design-strovyn-cinematic-3d--strovynpainting.netlify.app/admin/activate',
      }
    );
    if (rawInviteData?.user?.id) {
      createdAuthUserIds.push(rawInviteData.user.id);
    }
    if (rawInviteErr) {
      console.log(
        `  [DIAGNOSTIC] Built-in mailer rejected external invite as expected without custom SMTP: status=${rawInviteErr.status ?? 'n/a'}, code=${rawInviteErr.code ?? 'n/a'}, message="${rawInviteErr.message}"`
      );
    } else {
      console.log(
        '  [DIAGNOSTIC] Supabase Auth accepted invite request (note: built-in noreply@mail.app.supabase.io still enforces 2/hr rate limit & org-member restriction without custom SMTP).'
      );
    }

    // -------------------------------------------------------------------------
    // 2. End-to-End Staff Invitation Creation + Single-Use /admin/activate Flow
    // -------------------------------------------------------------------------
    console.log('\n[2/4] Testing staff invitation creation, OTP verification, activation & RBAC...');
    // Lookup an existing admin actor id or use null-safe synthetic actor with real FK check
    const { data: existingAdmins } = await serviceClient
      .from('staff_users')
      .select('*')
      .eq('role', 'admin')
      .eq('is_active', true)
      .limit(1);

    const adminActor = existingAdmins?.[0] || {
      id: null,
      auth_user_id: crypto.randomUUID(),
      email: 'staging.admin.actor@strovyn.invalid',
      full_name: 'Staging Admin Actor',
      role: 'admin',
      is_active: true,
      last_login_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let inviteHashedToken = '';
    const invitation = await staffMgmtMod.inviteEmployee(
      adminActor,
      {
        fullName: 'Disposable Staging Editor',
        email: disposableStaffEmail,
        role: 'editor',
        redirectOrigin: 'https://design-strovyn-cinematic-3d--strovynpainting.netlify.app',
      },
      {
        clientOverride: serviceClient,
        sendInviteFn: async (email, fullName, redirectTo) => {
          const { data: linkData, error: linkErr } = await serviceClient.auth.admin.generateLink({
            type: 'invite',
            email,
            options: {
              data: { full_name: fullName },
              redirectTo,
            },
          });
          assert.equal(linkErr, null, `generateLink(invite) failed: ${linkErr?.message}`);
          assert.ok(linkData?.properties?.hashed_token, 'Expected hashed_token from generateLink(invite)');
          inviteHashedToken = linkData.properties.hashed_token;
          if (linkData.user?.id) {
            createdAuthUserIds.push(linkData.user.id);
          }
          return { authUserId: linkData.user?.id ?? null };
        },
      }
    );
    createdInvitationIds.push(invitation.id);
    assert.equal(invitation.status, 'pending');
    assert.equal(invitation.role, 'editor');

    // Simulate first-click /admin/activate OTP exchange
    const activateClient = makeFreshAnonClient(supabaseUrl, anonKey);
    const { data: verifyInviteData, error: verifyInviteErr } = await activateClient.auth.verifyOtp({
      token_hash: inviteHashedToken,
      type: 'invite',
    });
    assert.equal(verifyInviteErr, null, `First-click invite verifyOtp failed: ${verifyInviteErr?.message}`);
    assert.equal(verifyInviteData?.user?.email?.toLowerCase(), disposableStaffEmail);

    // Verify single-use replay protection: reusing the same invite token_hash a second time MUST fail!
    const replayClient = makeFreshAnonClient(supabaseUrl, anonKey);
    const { error: replayInviteErr } = await replayClient.auth.verifyOtp({
      token_hash: inviteHashedToken,
      type: 'invite',
    });
    assert.ok(replayInviteErr, 'Reusing single-use invitation token_hash a second time must be rejected');
    console.log('  [OK] First-click invite OTP exchange succeeded and second-use token replay was rejected.');

    // Set initial password inside authenticated invite session (mirrors StaffActivateCard.tsx)
    const { error: setPwErr } = await activateClient.auth.updateUser({
      password: initialPassword,
    });
    assert.equal(setPwErr, null, `Setting initial password failed: ${setPwErr?.message}`);

    // Complete employee activation (mirrors POST /api/admin/staff/activate)
    const activatedStaff = await staffMgmtMod.completeEmployeeActivation(
      {
        id: verifyInviteData.user.id,
        email: verifyInviteData.user.email,
      },
      serviceClient
    );
    createdStaffIds.push(activatedStaff.id);
    assert.equal(activatedStaff.is_active, true);
    assert.equal(activatedStaff.role, 'editor');
    assert.equal(activatedStaff.email, disposableStaffEmail);

    // Verify RBAC permissions for activated staff member
    assert.equal(rbacMod.hasEditorialPermission(activatedStaff.role, 'article:create_draft'), true);
    assert.equal(rbacMod.hasEditorialPermission(activatedStaff.role, 'staff:manage'), false);
    assert.equal(rbacMod.hasEditorialPermission(activatedStaff.role, 'insurance:read'), false);

    // Sign out activation session
    const { error: signOutActErr } = await activateClient.auth.signOut();
    assert.equal(signOutActErr, null);
    console.log('  [OK] Account activation, staff_users enrollment, and editor RBAC boundaries verified.');

    // -------------------------------------------------------------------------
    // 3. Password Sign-In & Sign-Out with Initial Activated Password
    // -------------------------------------------------------------------------
    console.log('\n[3/4] Testing standard password login and logout...');
    const signInClient1 = makeFreshAnonClient(supabaseUrl, anonKey);
    const { data: login1, error: login1Err } = await signInClient1.auth.signInWithPassword({
      email: disposableStaffEmail,
      password: initialPassword,
    });
    assert.equal(login1Err, null, `Login with initial password failed: ${login1Err?.message}`);
    assert.equal(login1?.user?.id, verifyInviteData.user.id);
    await signInClient1.auth.signOut();
    console.log('  [OK] Standard email/password login and logout succeeded.');

    // -------------------------------------------------------------------------
    // 4. Password Recovery, Password Rotation & Old-Password Rejection
    // -------------------------------------------------------------------------
    console.log('\n[4/4] Testing password recovery, password update, and old-password rejection...');
    const { data: recLinkData, error: recLinkErr } = await serviceClient.auth.admin.generateLink({
      type: 'recovery',
      email: disposableStaffEmail,
      options: {
        redirectTo: 'https://design-strovyn-cinematic-3d--strovynpainting.netlify.app/admin/activate',
      },
    });
    assert.equal(recLinkErr, null, `generateLink(recovery) failed: ${recLinkErr?.message}`);
    const recoveryHashedToken = recLinkData?.properties?.hashed_token;
    assert.ok(recoveryHashedToken, 'Expected hashed_token from generateLink(recovery)');

    const recoveryClient = makeFreshAnonClient(supabaseUrl, anonKey);
    const { data: recSessionData, error: recVerifyErr } = await recoveryClient.auth.verifyOtp({
      token_hash: recoveryHashedToken,
      type: 'recovery',
    });
    assert.equal(recVerifyErr, null, `Recovery verifyOtp failed: ${recVerifyErr?.message}`);
    assert.equal(recSessionData?.user?.id, verifyInviteData.user.id);

    // Single-use recovery token replay must fail
    const recReplayClient = makeFreshAnonClient(supabaseUrl, anonKey);
    const { error: recReplayErr } = await recReplayClient.auth.verifyOtp({
      token_hash: recoveryHashedToken,
      type: 'recovery',
    });
    assert.ok(recReplayErr, 'Reusing single-use recovery token_hash must fail');

    // Rotate password to new password
    const { error: rotateErr } = await recoveryClient.auth.updateUser({
      password: rotatedPassword,
    });
    assert.equal(rotateErr, null, `Recovery password update failed: ${rotateErr?.message}`);
    await staffMgmtMod.recordPasswordUpdatedAudit(activatedStaff, serviceClient);
    await recoveryClient.auth.signOut();

    // Verify OLD password now fails!
    const oldPwClient = makeFreshAnonClient(supabaseUrl, anonKey);
    const { error: oldPwErr } = await oldPwClient.auth.signInWithPassword({
      email: disposableStaffEmail,
      password: initialPassword,
    });
    assert.ok(oldPwErr, 'Old password MUST be rejected after password recovery update');
    console.log(`  [OK-REJECTED] Old password rejected after rotation: "${oldPwErr.message}"`);

    // Verify NEW password succeeds + logout works!
    const newPwClient = makeFreshAnonClient(supabaseUrl, anonKey);
    const { data: newLogin, error: newPwErr } = await newPwClient.auth.signInWithPassword({
      email: disposableStaffEmail,
      password: rotatedPassword,
    });
    assert.equal(newPwErr, null, `Login with rotated password failed: ${newPwErr?.message}`);
    assert.equal(newLogin?.user?.id, verifyInviteData.user.id);

    const { error: finalLogoutErr } = await newPwClient.auth.signOut();
    assert.equal(finalLogoutErr, null);
    console.log('  [OK] New password login and clean session logout verified.');
  } finally {
    // Clean up all disposable QA rows & Auth accounts on staging
    await serviceClient
      .from('staff_audit_log')
      .delete()
      .in('target_email', [disposableStaffEmail, mailerProbeEmail]);
    if (createdStaffIds.length > 0) {
      await serviceClient.from('staff_users').delete().in('id', createdStaffIds);
    }
    if (createdInvitationIds.length > 0) {
      await serviceClient.from('staff_invitations').delete().in('id', createdInvitationIds);
    }
    for (const uid of new Set(createdAuthUserIds)) {
      await serviceClient.auth.admin.deleteUser(uid).catch(() => {});
    }
    console.log('\n  [OK] Cleaned up disposable staging Auth users, invitations, and audit rows.');
  }

  console.log('\n=== ALL STAGING AUTH, INVITATION, RECOVERY & RBAC FLOW CHECKS PASSED ===');
}

main().catch((err) => {
  console.error('Staging Auth flow verification failed:', err?.message || err);
  process.exit(1);
});
