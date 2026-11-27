import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { createClient } from '@supabase/supabase-js';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase', 'migrations');

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
      jsx: ts.JsxEmit.ReactJSX,
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

async function expectSqlError(db, query, params, label, insideTx = false) {
  let threw = false;
  if (insideTx) {
    await db.exec('SAVEPOINT sp_ins_err');
  }
  try {
    await db.query(query, params);
  } catch (err) {
    threw = true;
    console.log(`  [OK-REJECTED] ${label}: ${err.message}`);
    if (insideTx) {
      await db.exec('ROLLBACK TO SAVEPOINT sp_ins_err');
    }
  }
  assert.equal(threw, true, `Expected SQL rejection for: ${label}`);
}

async function asRole(db, role, fn) {
  return db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE ${role}`);
    const who = (await tx.query(`SELECT current_user::text AS u`)).rows[0];
    assert.equal(who.u, role);
    return fn(tx);
  });
}

// Valid minimal 1x1 PNG image buffer (magic bytes: 89 50 4E 47 0D 0A 1A 0A)
const VALID_1X1_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

function makeStaff(role, overrides = {}) {
  return {
    id: crypto.randomUUID(),
    auth_user_id: crypto.randomUUID(),
    email: `${role}.qa@strovyn.invalid`,
    full_name: `QA ${role}`,
    role,
    is_active: true,
    last_login_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

async function runPgliteSchemaAndPrivilegeSuite() {
  console.log('\n--- Part 1: PGlite Migration 018, RLS, Grants & Constraint Suite ---');
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE SCHEMA IF NOT EXISTS storage;
      CREATE TABLE IF NOT EXISTS storage.buckets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        public BOOLEAN DEFAULT FALSE,
        file_size_limit BIGINT,
        allowed_mime_types TEXT[]
      );
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;
        END IF;
      END $$;
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
      GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
    `);

    const sql001 = fs.readFileSync(path.join(MIGRATIONS_DIR, '20261113212535_initial_schema.sql'), 'utf8');
    const sql018 = fs.readFileSync(
      path.join(MIGRATIONS_DIR, '20261128010000_insurance_compliance_and_enquiries.sql'),
      'utf8'
    );
    await db.exec(sql001);
    await db.exec(sql018);
    // Re-run idempotently
    await db.exec(sql018);

    const buckets = (
      await db.query(`SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id`)
    ).rows;
    assert.equal(buckets.length, 2);
    assert.equal(buckets[0].id, 'compliance-documents');
    assert.equal(buckets[0].public, false);
    assert.equal(buckets[1].id, 'incident-attachments');
    assert.equal(buckets[1].public, false);
    assert.deepEqual(buckets[1].allowed_mime_types, ['image/jpeg', 'image/png', 'image/webp']);
    console.log('  [OK] Idempotent DDL & private storage bucket constraints verified.');

    // Verify safe search_path on insurance_touch_updated_at
    const fnRow = (
      await db.query(`
        SELECT prosecdef, COALESCE(array_to_string(proconfig, ','), '') AS cfg
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'insurance_touch_updated_at'
      `)
    ).rows[0];
    assert.ok(fnRow);
    assert.equal(fnRow.prosecdef, false);
    assert.ok(fnRow.cfg.includes('search_path=pg_catalog, public'));

    const protectedTables = [
      'public_liability_insurance',
      'insurance_enquiries',
      'insurance_incident_attachments',
      'insurance_enquiry_audit_log',
    ];

    for (const untrustedRole of ['anon', 'authenticated']) {
      await asRole(db, untrustedRole, async (tx) => {
        for (const tbl of protectedTables) {
          await expectSqlError(
            tx,
            `SELECT * FROM public.${tbl}`,
            [],
            `${untrustedRole} SELECT ${tbl} denied`,
            true
          );
          await expectSqlError(
            tx,
            `DELETE FROM public.${tbl}`,
            [],
            `${untrustedRole} DELETE ${tbl} denied`,
            true
          );
        }
      });
    }
    console.log('  [OK] anon & authenticated roles strictly denied direct access to all 4 insurance tables.');

    // Verify CHECK constraints & audit log immutability under service_role
    await asRole(db, 'service_role', async (tx) => {
      await expectSqlError(
        tx,
        `INSERT INTO public.public_liability_insurance (provider_name, is_published) VALUES ('', TRUE)`,
        [],
        'publish policy without verified fields/certificate rejected',
        true
      );
      await expectSqlError(
        tx,
        `INSERT INTO public.insurance_enquiries (reference_code, enquiry_kind, full_name, email, phone, project_location, incident_date, incident_category, incident_description, disclaimer_acknowledged)
         VALUES ('INC-20261128-BAD001', 'incident_report', 'Test User', 'test@example.com', '0400111222', 'Norwood SA', CURRENT_DATE, 'property_damage', 'Detailed description of site issue.', FALSE)`,
        [],
        'incident_report without disclaimer_acknowledged=TRUE rejected',
        true
      );

      const enqRes = await tx.query(
        `INSERT INTO public.insurance_enquiries (reference_code, enquiry_kind, full_name, email, request_type)
         VALUES ('INS-20261128-OK0001', 'information_request', 'Test Builder', 'builder@example.com', 'certificate_of_currency')
         RETURNING id`
      );
      const enqId = enqRes.rows[0].id;

      await expectSqlError(
        tx,
        `INSERT INTO public.insurance_incident_attachments (enquiry_id, storage_path, original_label, mime_type, byte_size)
         VALUES ($1, 'incidents/../escape.png', 'escape.png', 'image/png', 120)`,
        [enqId],
        'attachment path traversal (..) rejected',
        true
      );
      await expectSqlError(
        tx,
        `INSERT INTO public.insurance_incident_attachments (enquiry_id, storage_path, original_label, mime_type, byte_size)
         VALUES ($1, 'incidents/ok/doc.pdf', 'doc.pdf', 'application/pdf', 120)`,
        [enqId],
        'non-image MIME on incident attachment rejected',
        true
      );

      await tx.query(
        `INSERT INTO public.insurance_enquiry_audit_log (enquiry_id, action) VALUES ($1, 'created')`,
        [enqId]
      );
      await expectSqlError(
        tx,
        `UPDATE public.insurance_enquiry_audit_log SET action = 'closed'`,
        [],
        'service_role UPDATE on insurance_enquiry_audit_log denied',
        true
      );
      await expectSqlError(
        tx,
        `DELETE FROM public.insurance_enquiry_audit_log`,
        [],
        'service_role DELETE on insurance_enquiry_audit_log denied',
        true
      );
    });
    console.log('  [OK] Database CHECK constraints and append-only audit log grants verified.');
  } finally {
    await db.close();
  }
}

async function runRbacAndStagingE2ESuite() {
  console.log('\n--- Part 2: RBAC, Anti-Abuse Validation & Staging Supabase E2E Suite ---');
  loadEnvLocalSafely();

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

  assert.equal(
    supabaseUrl,
    'https://euhgtzblwyogmqdldmni.supabase.co',
    'Safety guard: E2E insurance tests must run strictly against staging Supabase (euhgtzblwyogmqdldmni).'
  );
  assert.ok(serviceKey.length > 20, 'Staging SUPABASE_SERVICE_ROLE_KEY must be present in .env.local');
  assert.ok(anonKey.length > 20, 'Staging NEXT_PUBLIC_SUPABASE_ANON_KEY must be present in .env.local');

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const sentAlerts = [];
  const cache = new Map();
  const stubs = {
    'server-only': {},
    '@/lib/resend/client': {
      sendNotificationEmail: async (payload) => {
        sentAlerts.push(payload);
        return { delivered: true };
      },
    },
  };

  const rbacMod = loadProjectTsModule('src/lib/cms/rbac.ts', stubs, cache);
  const navMod = loadProjectTsModule('src/lib/cms/adminNavigation.ts', stubs, cache);
  const insMod = loadProjectTsModule('src/lib/cms/insuranceService.ts', stubs, cache);

  // 1. RBAC & Navigation boundaries
  for (const deniedRole of ['editor', 'publisher']) {
    assert.equal(rbacMod.hasEditorialPermission(deniedRole, 'insurance:read'), false);
    assert.equal(rbacMod.hasEditorialPermission(deniedRole, 'insurance:manage'), false);
    assert.equal(rbacMod.hasEditorialPermission(deniedRole, 'insurance:export'), false);
    assert.equal(
      navMod.getAdminNavigationForRole(deniedRole).some((item) => item.id === 'insurance'),
      false,
      `${deniedRole} must not see /admin/insurance in navigation`
    );
  }
  assert.equal(rbacMod.hasEditorialPermission('admin', 'insurance:read'), true);
  assert.equal(rbacMod.hasEditorialPermission('admin', 'insurance:manage'), true);
  assert.equal(rbacMod.hasEditorialPermission('admin', 'insurance:export'), true);
  const adminInsNav = navMod.getAdminNavigationForRole('admin').find((i) => i.id === 'insurance');
  assert.ok(adminInsNav);
  assert.equal(adminInsNav.href, '/admin/insurance');

  const editorStaff = makeStaff('editor');
  const publisherStaff = makeStaff('publisher');
  const inactiveAdmin = makeStaff('admin', { is_active: false });
  const activeAdmin = makeStaff('admin');

  for (const unauthorized of [editorStaff, publisherStaff, inactiveAdmin]) {
    await assert.rejects(
      () => insMod.listAdminInsuranceEnquiries(unauthorized, {}, serviceClient),
      (err) => err.status === 403 && err.code === 'FORBIDDEN'
    );
    await assert.rejects(
      () => insMod.exportAdminInsuranceEnquiriesCsv(unauthorized, {}, serviceClient),
      (err) => err.status === 403 && err.code === 'FORBIDDEN'
    );
    await assert.rejects(
      () => insMod.getAdminInsuranceRecord(unauthorized, serviceClient),
      (err) => err.status === 403 && err.code === 'FORBIDDEN'
    );
  }
  console.log('  [OK] RBAC enforces Admin-only access on all insurance enquiries, exports, and policy endpoints.');

  // 2. Live anon client negative check against staging PostgREST
  const anonSelect = await anonClient.from('insurance_enquiries').select('*');
  assert.ok(anonSelect.error, 'Anon PostgREST client must be denied SELECT on insurance_enquiries');
  const anonPolSelect = await anonClient.from('public_liability_insurance').select('*');
  assert.ok(anonPolSelect.error, 'Anon PostgREST client must be denied SELECT on public_liability_insurance');
  console.log('  [OK] Live staging Supabase PostgREST blocks anonymous reads on insurance tables.');

  // 3. Anti-abuse & validation negative checks (Zero-Open-Uploader guarantee)
  // 3a. Honeypot filled -> 400
  await assert.rejects(
    () =>
      insMod.submitPublicInsuranceEnquiry(
        {
          enquiry_kind: 'information_request',
          full_name: 'Bot Spammer',
          email: 'bot@example.com',
          request_type: 'coverage_enquiry',
          website: 'https://spam.example.com',
        },
        [],
        { clientOverride: serviceClient }
      ),
    (err) => err.status === 400
  );

  // 3b. Option A with file attachment -> 400
  await assert.rejects(
    () =>
      insMod.submitPublicInsuranceEnquiry(
        {
          enquiry_kind: 'information_request',
          full_name: 'Builder Name',
          email: 'builder@example.com',
          request_type: 'certificate_of_currency',
        },
        [{ buffer: VALID_1X1_PNG, originalName: 'photo.png', mimeType: 'image/png' }],
        { clientOverride: serviceClient }
      ),
    (err) => err.status === 400
  );

  // 3c. Option B without non-liability acknowledgment -> 400
  const todayStr = new Date().toISOString().slice(0, 10);
  await assert.rejects(
    () =>
      insMod.submitPublicInsuranceEnquiry(
        {
          enquiry_kind: 'incident_report',
          full_name: 'Resident Test',
          email: 'resident@example.com',
          phone: '0412 345 678',
          project_location: 'Unley, SA',
          incident_date: todayStr,
          incident_category: 'property_damage',
          incident_description: 'Minor paint droplet noted on front garden paver.',
          disclaimer_acknowledged: false,
        },
        [],
        { clientOverride: serviceClient }
      ),
    (err) => err.status === 400
  );

  // 3d. Option B with future incident date -> 400
  await assert.rejects(
    () =>
      insMod.submitPublicInsuranceEnquiry(
        {
          enquiry_kind: 'incident_report',
          full_name: 'Resident Test',
          email: 'resident@example.com',
          phone: '0412 345 678',
          project_location: 'Unley, SA',
          incident_date: '2099-12-31',
          incident_category: 'property_damage',
          incident_description: 'Future date validation check.',
          disclaimer_acknowledged: true,
        },
        [],
        { clientOverride: serviceClient }
      ),
    (err) => err.status === 400
  );

  // 3e. Option B with disguised executable (.exe MZ header renamed to .jpg) -> 400 UNSUPPORTED_MEDIA_TYPE
  const fakeExeBuffer = Buffer.from('4d5a90000300000004000000ffff0000', 'hex');
  await assert.rejects(
    () =>
      insMod.submitPublicInsuranceEnquiry(
        {
          enquiry_kind: 'incident_report',
          full_name: 'Malicious Uploader',
          email: 'bad@example.com',
          phone: '0412 345 678',
          project_location: 'Adelaide, SA',
          incident_date: todayStr,
          incident_category: 'other',
          incident_description: 'Attempting disguised executable upload.',
          disclaimer_acknowledged: true,
        },
        [{ buffer: fakeExeBuffer, originalName: 'innocent.jpg', mimeType: 'image/jpeg' }],
        { clientOverride: serviceClient }
      ),
    (err) => err.status === 400 && err.code === 'UNSUPPORTED_MEDIA_TYPE'
  );

  // 3f. Option B with > 3 photos -> 400
  await assert.rejects(
    () =>
      insMod.submitPublicInsuranceEnquiry(
        {
          enquiry_kind: 'incident_report',
          full_name: 'Too Many Photos',
          email: 'photos@example.com',
          phone: '0412 345 678',
          project_location: 'Adelaide, SA',
          incident_date: todayStr,
          incident_category: 'property_damage',
          incident_description: 'Four photos attached when max is three.',
          disclaimer_acknowledged: true,
        },
        [
          { buffer: VALID_1X1_PNG, originalName: '1.png', mimeType: 'image/png' },
          { buffer: VALID_1X1_PNG, originalName: '2.png', mimeType: 'image/png' },
          { buffer: VALID_1X1_PNG, originalName: '3.png', mimeType: 'image/png' },
          { buffer: VALID_1X1_PNG, originalName: '4.png', mimeType: 'image/png' },
        ],
        { clientOverride: serviceClient }
      ),
    (err) => err.status === 400
  );
  console.log('  [OK] Honeypot, disclaimer, date, count, and magic-byte image checks block invalid/disguised uploads.');

  // 4. Live E2E Option A & Option B + Admin CMS Workflow + Private Storage + CSV Export on Staging
  const createdEnquiryIds = [];
  const createdStoragePaths = [];
  let createdPolicyId = null;

  try {
    // Verify unpublished policy status by default (zero false claims!)
    const initialPubStatus = await insMod.getPublicInsuranceStatus(serviceClient);
    assert.equal(initialPubStatus.isPublished, false);

    // 4a. Submit Option A (Request Insurance Information) while policy is unpublished
    const idemA = `qa-opt-a-${Date.now()}`;
    const resA = await insMod.submitPublicInsuranceEnquiry(
      {
        enquiry_kind: 'information_request',
        full_name: 'Adelaide Heritage Builders QA',
        email: 'qa.builder@example.com',
        phone: '08 8123 4567',
        project_location: 'North Adelaide, SA',
        request_type: 'certificate_of_currency',
        message: '=HYPERLINK("https://evil.invalid","Formula Injection Test") Requesting CoC for tender.',
        idempotency_key: idemA,
      },
      [],
      { clientOverride: serviceClient }
    );
    createdEnquiryIds.push(resA.id);
    assert.match(resA.referenceCode, /^INS-\d{8}-[A-F0-9]{6}$/);
    assert.equal(resA.enquiryKind, 'information_request');
    assert.equal(resA.isUrgent, false);
    assert.equal(resA.attachmentCount, 0);

    // Verify idempotent replay returns identical record without duplicating
    const replayA = await insMod.submitPublicInsuranceEnquiry(
      {
        enquiry_kind: 'information_request',
        full_name: 'Adelaide Heritage Builders QA',
        email: 'qa.builder@example.com',
        request_type: 'certificate_of_currency',
        idempotency_key: idemA,
      },
      [],
      { clientOverride: serviceClient }
    );
    assert.equal(replayA.id, resA.id);
    assert.equal(replayA.referenceCode, resA.referenceCode);
    assert.equal(replayA.deduplicated, true);

    // Verify zero-PII Admin email alert omits customer email/message from transit body!
    assert.equal(sentAlerts.length, 1);
    assert.ok(sentAlerts[0].subject.includes(resA.referenceCode));
    assert.equal(sentAlerts[0].html.includes('qa.builder@example.com'), false, 'Admin alert email must omit customer PII');
    assert.equal(sentAlerts[0].html.includes('Formula Injection Test'), false, 'Admin alert email must omit free-text body');

    // 4b. Submit Option B (Report an Incident) with valid PNG photo
    const idemB = `qa-opt-b-${Date.now()}`;
    const resB = await insMod.submitPublicInsuranceEnquiry(
      {
        enquiry_kind: 'incident_report',
        full_name: 'Norwood Homeowner QA',
        email: 'qa.homeowner@example.com',
        phone: '+61 400 999 888',
        project_location: 'Norwood, SA 5067',
        incident_date: todayStr,
        incident_category: 'injury', // Auto-flags is_urgent = true
        incident_description: 'Staging QA verification report: minor slip hazard observed near drop sheet.',
        disclaimer_acknowledged: true,
        idempotency_key: idemB,
      },
      [{ buffer: VALID_1X1_PNG, originalName: 'site-observation.png', mimeType: 'image/png' }],
      { clientOverride: serviceClient }
    );
    createdEnquiryIds.push(resB.id);
    assert.match(resB.referenceCode, /^INC-\d{8}-[A-F0-9]{6}$/);
    assert.equal(resB.enquiryKind, 'incident_report');
    assert.equal(resB.isUrgent, true);
    assert.equal(resB.attachmentCount, 1);

    // Track storage path for cleanup & verify public storage URL is strictly blocked!
    const { data: attDbRows } = await serviceClient
      .from('insurance_incident_attachments')
      .select('id, storage_path, retention_until')
      .eq('enquiry_id', resB.id);
    assert.equal(attDbRows.length, 1);
    const uploadedStoragePath = attDbRows[0].storage_path;
    createdStoragePaths.push(uploadedStoragePath);

    const publicObjectProbe = await fetch(
      `${supabaseUrl}/storage/v1/object/public/incident-attachments/${uploadedStoragePath}`
    );
    assert.notEqual(
      publicObjectProbe.status,
      200,
      'Private incident-attachments bucket must NEVER serve files on /object/public/ URLs!'
    );
    console.log('  [OK] Option A & Option B stored, deduplicated, zero-PII alerted, and private photo blocked from public URL.');

    // 4c. Admin CMS Queue, Filtering, Triage, Status Workflow, Private Download & CSV Export
    const listAll = await insMod.listAdminInsuranceEnquiries(activeAdmin, {}, serviceClient);
    assert.ok(listAll.counts.total >= 2);
    assert.ok(listAll.counts.urgentOpenCount >= 1);

    const searchByRef = await insMod.listAdminInsuranceEnquiries(
      activeAdmin,
      { search: resB.referenceCode },
      serviceClient
    );
    assert.equal(searchByRef.items.length, 1);
    assert.equal(searchByRef.items[0].id, resB.id);

    // Mark reviewed (transitions new -> under_review)
    const reviewed = await insMod.updateAdminInsuranceEnquiry(
      activeAdmin,
      resB.id,
      { mark_reviewed: true },
      serviceClient
    );
    assert.equal(reviewed.status, 'under_review');
    assert.ok(reviewed.reviewed_at);

    // Update notes, follow-up actions, and manual status tracking (`referred_to_insurer`)
    const updatedWorkflow = await insMod.updateAdminInsuranceEnquiry(
      activeAdmin,
      resB.id,
      {
        status: 'referred_to_insurer',
        internal_notes: '+Internal QA triage note verified.',
        follow_up_actions: 'Called homeowner; logged internal incident reference.',
      },
      serviceClient
    );
    assert.equal(updatedWorkflow.status, 'referred_to_insurer');
    assert.equal(updatedWorkflow.internal_notes, '+Internal QA triage note verified.');
    assert.equal(updatedWorkflow.follow_up_actions, 'Called homeowner; logged internal incident reference.');

    // Secure Admin private attachment download matches byte-for-byte
    const downloaded = await insMod.downloadAdminIncidentAttachment(
      activeAdmin,
      attDbRows[0].id,
      serviceClient
    );
    assert.equal(downloaded.mimeType, 'image/png');
    assert.equal(Buffer.compare(Buffer.from(downloaded.bytes), VALID_1X1_PNG), 0);

    // Close resolved item
    const closed = await insMod.updateAdminInsuranceEnquiry(
      activeAdmin,
      resB.id,
      { status: 'closed' },
      serviceClient
    );
    assert.equal(closed.status, 'closed');
    assert.ok(closed.closed_at);
    assert.ok(closed.audit_log.some((e) => e.action === 'marked_reviewed'));
    assert.ok(closed.audit_log.some((e) => e.action === 'attachment_downloaded'));
    assert.ok(closed.audit_log.some((e) => e.action === 'closed'));

    // CSV Export + spreadsheet formula-injection neutralization check
    const exported = await insMod.exportAdminInsuranceEnquiriesCsv(activeAdmin, {}, serviceClient);
    assert.ok(exported.rowCount >= 2);
    assert.ok(exported.csv.includes(resA.referenceCode));
    assert.ok(exported.csv.includes(resB.referenceCode));
    assert.ok(
      exported.csv.includes("'=HYPERLINK"),
      'CSV export must prefix leading =/+/-/@ cells with an apostrophe to prevent formula injection'
    );
    assert.ok(
      exported.csv.includes("'+Internal QA triage note verified."),
      'CSV export must neutralize leading + in internal notes'
    );
    console.log('  [OK] Admin CMS review, workflow statuses, notes, private photo download, closure, and CSV export verified.');

    // 4d. Policy & Certificate Governance safeguards
    await assert.rejects(
      () =>
        insMod.saveAdminInsuranceRecord(
          activeAdmin,
          {
            provider_name: 'Test Insurer',
            named_insured: 'Strovyn Painting Co.',
            policy_number: 'POL-TEST-001',
            coverage_limit_aud: 20000000,
            policy_commencement_date: '2026-01-01',
            policy_expiry_date: '2027-01-01',
            certificate_storage_path: null,
            is_published: true,
          },
          serviceClient
        ),
      (err) => err.status === 400
    );

    const draftPolicy = await insMod.saveAdminInsuranceRecord(
      activeAdmin,
      {
        provider_name: '',
        named_insured: 'Strovyn Painting Co.',
        policy_number: '',
        coverage_limit_aud: 0,
        policy_commencement_date: todayStr,
        policy_expiry_date: todayStr,
        certificate_storage_path: null,
        is_published: false,
      },
      serviceClient
    );
    createdPolicyId = draftPolicy.id;
    assert.equal(draftPolicy.is_published, false);
    const pubAfterDraft = await insMod.getPublicInsuranceStatus(serviceClient);
    assert.equal(pubAfterDraft.isPublished, false);
    console.log('  [OK] Policy publication guardrails prevent unverified/expired public claims.');
  } finally {
    // Clean up disposable QA rows and private storage objects from staging
    if (createdStoragePaths.length > 0) {
      await serviceClient.storage.from('incident-attachments').remove(createdStoragePaths);
    }
    if (createdEnquiryIds.length > 0) {
      await serviceClient.from('insurance_enquiries').delete().in('id', createdEnquiryIds);
    }
    if (createdPolicyId) {
      await serviceClient.from('public_liability_insurance').delete().eq('id', createdPolicyId);
    }
    console.log('  [OK] Cleaned up disposable QA insurance records from staging Supabase.');
  }
}

async function main() {
  console.log('=== STROVYN PUBLIC LIABILITY INSURANCE ENQUIRY & INCIDENT SYSTEM SUITE ===');
  await runPgliteSchemaAndPrivilegeSuite();
  await runRbacAndStagingE2ESuite();
  console.log('\n=== ALL INSURANCE ENQUIRY, INCIDENT, STORAGE & ADMIN CMS CHECKS PASSED ===');
}

main().catch((err) => {
  console.error('Insurance suite failed:', err?.message || err);
  process.exit(1);
});
