import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { PGlite } from '@electric-sql/pglite';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase', 'migrations');
const MIGRATION_FILES = [
  '20261113212535_initial_schema.sql',
  '20261119140214_idempotency_and_hardening.sql',
  '20261119191815_editorial_cms.sql',
  '20261119202922_editorial_cms_hardening.sql',
  '20261119210040_editorial_media_and_bucket.sql',
  '20261119220209_editorial_media_privacy.sql',
  '20261119234431_editorial_media_gated_delivery.sql',
  '20261120132000_baseline_table_grants.sql',
  '20261120140000_storage_buckets_and_upload_binding.sql',
  '20261120143000_atomic_submission_and_upload_cleanup.sql',
  '20261121020000_business_cms_projects_foundation.sql',
  '20261121030000_business_cms_testimonials_foundation.sql',
  '20261121040000_business_cms_careers_foundation.sql',
  '20261121050000_business_cms_submissions_foundation.sql',
  '20261121060000_operational_automation_hardening.sql',
  '20261122000000_email_notification_outbox.sql',
];

function createPgliteAdapter(db) {
  function sanitizeCol(name) {
    assert.match(name, /^[a-zA-Z_][a-zA-Z0-9_]*$/);
    return `"${name}"`;
  }
  function serializeParam(val) {
    if (val !== null && typeof val === 'object' && !(val instanceof Date) && !Buffer.isBuffer(val)) {
      return JSON.stringify(val);
    }
    return val;
  }
  function normalizeRow(row) {
    if (!row || typeof row !== 'object') return row;
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = v instanceof Date ? v.toISOString() : v;
    }
    return out;
  }
  class QueryBuilder {
    constructor(table) {
      this.table = table;
      this.op = 'select';
      this.payload = null;
      this.filters = [];
      this.expectSingle = false;
      this.expectMaybeSingle = false;
    }
    select() {
      if (this.op !== 'insert' && this.op !== 'update') this.op = 'select';
      return this;
    }
    insert(payload) {
      this.op = 'insert';
      this.payload = payload;
      return this;
    }
    update(payload) {
      this.op = 'update';
      this.payload = payload;
      return this;
    }
    eq(col, val) {
      this.filters.push({ col, val });
      return this;
    }
    single() {
      this.expectSingle = true;
      return this;
    }
    maybeSingle() {
      this.expectMaybeSingle = true;
      return this;
    }
    async execute() {
      try {
        const params = [];
        const where =
          this.filters.length > 0
            ? ' WHERE ' +
              this.filters
                .map((f) => {
                  params.push(serializeParam(f.val));
                  return `${sanitizeCol(f.col)} = $${params.length}`;
                })
                .join(' AND ')
            : '';
        let sql = '';
        if (this.op === 'select') {
          sql = `SELECT * FROM public.${sanitizeCol(this.table)}${where}`;
        } else if (this.op === 'insert') {
          const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
          const cols = Object.keys(rows[0]);
          const groups = rows.map((r) => {
            const ph = cols.map((c) => {
              params.push(serializeParam(r[c]));
              return `$${params.length}`;
            });
            return `(${ph.join(', ')})`;
          });
          sql = `INSERT INTO public.${sanitizeCol(this.table)} (${cols.map(sanitizeCol).join(', ')}) VALUES ${groups.join(', ')} RETURNING *`;
        } else if (this.op === 'update') {
          const cols = Object.keys(this.payload);
          const sets = cols.map((c) => {
            params.push(serializeParam(this.payload[c]));
            return `${sanitizeCol(c)} = $${params.length}`;
          });
          sql = `UPDATE public.${sanitizeCol(this.table)} SET ${sets.join(', ')}${where} RETURNING *`;
        }
        const res = await db.query(sql, params);
        const rows = res.rows.map(normalizeRow);
        if (this.expectSingle) {
          if (rows.length !== 1) return { data: null, error: { message: 'Row count mismatch', code: 'PGRST116' } };
          return { data: rows[0], error: null };
        }
        if (this.expectMaybeSingle) return { data: rows[0] ?? null, error: null };
        return { data: rows, error: null };
      } catch (err) {
        return { data: null, error: { message: err.message, code: err.code } };
      }
    }
    then(resolve, reject) {
      return this.execute().then(resolve, reject);
    }
  }
  return {
    from(table) {
      return new QueryBuilder(table);
    },
    async rpc(fnName, args = {}) {
      try {
        const params = [];
        const namedArgs = Object.keys(args).map((k) => {
          params.push(serializeParam(args[k]));
          return `${k} => $${params.length}`;
        });
        const res = await db.query(`SELECT * FROM public.${fnName}(${namedArgs.join(', ')})`, params);
        const rows = res.rows.map(normalizeRow);
        if (
          rows.length === 1 &&
          Object.keys(rows[0]).length === 1 &&
          Object.prototype.hasOwnProperty.call(rows[0], fnName)
        ) {
          return { data: rows[0][fnName], error: null };
        }
        return { data: rows, error: null };
      } catch (err) {
        return { data: null, error: { message: err.message, code: err.code } };
      }
    },
  };
}

function loadProjectTsModule(relPath, customModules = {}, cache = new Map()) {
  const clean = relPath.replace(/\\/g, '/');
  let normalizedRel = clean;
  for (const candidate of [clean, `${clean}.ts`, `${clean}.tsx`, `${clean}/index.ts`]) {
    if (fs.existsSync(path.join(REPO_ROOT, candidate))) {
      normalizedRel = candidate;
      break;
    }
  }
  if (cache.has(normalizedRel)) {
    return cache.get(normalizedRel).exports;
  }

  const mod = { exports: {} };
  cache.set(normalizedRel, mod);

  const source = fs.readFileSync(path.join(REPO_ROOT, normalizedRel), 'utf8');
  const code = ts.transpileModule(source, {
    fileName: path.join(REPO_ROOT, normalizedRel),
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      strict: true,
    },
  }).outputText;
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

  new vm.Script(
    `(function(exports, require, module, __filename, __dirname) {\n${code}\n})`,
    { filename: normalizedRel }
  ).runInThisContext()(
    mod.exports,
    localRequire,
    mod,
    path.join(REPO_ROOT, normalizedRel),
    path.join(REPO_ROOT, dir)
  );
  return mod.exports;
}

async function main() {
  console.log('=== Netlify Hosting & Resend Email Integration Suite ===');
  const cache = new Map();
  const stubs = { 'server-only': {} };

  const templatesMod = loadProjectTsModule('src/lib/resend/templates.ts', stubs, cache);
  const clientMod = loadProjectTsModule('src/lib/resend/client.ts', stubs, cache);
  const subMod = loadProjectTsModule('src/lib/security/submissionHandler.ts', stubs, cache);
  const cronMod = loadProjectTsModule('src/lib/cms/netlifyCronAdapter.ts', stubs, cache);
  const envMod = loadProjectTsModule('src/lib/config/envIsolation.ts', stubs, cache);

  const prevEnv = {
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    NOTIFICATION_EMAIL: process.env.NOTIFICATION_EMAIL,
    RECRUITMENT_EMAIL: process.env.RECRUITMENT_EMAIL,
    RESEND_SEND_ACKNOWLEDGMENTS: process.env.RESEND_SEND_ACKNOWLEDGMENTS,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    CONTEXT: process.env.CONTEXT,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  };

  try {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://strovyn.example';

    // 1. Template rendering, HTML escaping, and private Storage URL exclusion
    const quoteTpl = templatesMod.buildQuoteNotificationEmail({
      fullName: 'Alice <script>alert(1)</script>',
      email: 'alice@example.com',
      phone: '0400000000',
      projectLocation: 'Unley',
      serviceRequired: 'Interior Painting',
      preferredContact: 'email',
      description: 'Repaint <b>hallway</b> walls',
      hasAttachment: true,
    });
    assert.ok(!quoteTpl.html.includes('<script>'));
    assert.ok(quoteTpl.html.includes('&lt;script&gt;'));
    assert.ok(quoteTpl.html.includes('https://strovyn.example/admin/quotes'));
    assert.ok(!quoteTpl.html.includes('supabase://customer-documents'));

    const appTpl = templatesMod.buildApplicationNotificationEmail({
      fullName: 'Bob Painter',
      email: 'bob@example.com',
      phone: '0411111111',
      position: 'Lead Painter',
      yearsOfExperience: '5',
      hasResume: true,
    });
    assert.ok(appTpl.html.includes('https://strovyn.example/admin/applications'));
    assert.ok(!appTpl.html.includes('supabase://customer-documents'));

    const contactTpl = templatesMod.buildContactEnquiryNotificationEmail({
      customerName: 'Carol Client',
      rating: 5,
      message: 'Great heritage restoration work.',
    });
    assert.ok(contactTpl.html.includes('https://strovyn.example/admin/feedback'));

    const ackTpl = templatesMod.buildCustomerAcknowledgmentEmail({
      recipientName: 'Alice',
      submissionType: 'quote',
    });
    assert.match(ackTpl.html, /does not constitute a quotation/i);
    console.log('  [OK] Email templates, HTML escaping, admin links, and private URL exclusion verified.');

    // 2. Missing key & invalid recipient/sender config
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.NOTIFICATION_EMAIL;
    const noClientRes = await clientMod.sendNotificationEmail(
      { subject: 'Test', html: '<p>Hi</p>' },
      { resendClient: null }
    );
    assert.equal(noClientRes.success, false);
    assert.equal(noClientRes.configured, false);

    const mockClient = {
      emails: {
        send: async () => ({ data: { id: 'msg_1' }, error: null }),
      },
    };
    const noSenderRes = await clientMod.sendNotificationEmail(
      { subject: 'Test', html: '<p>Hi</p>' },
      { resendClient: mockClient }
    );
    assert.equal(noSenderRes.success, false);

    process.env.RESEND_FROM_EMAIL = 'Strovyn <notifications@strovyn.example>';
    process.env.NOTIFICATION_EMAIL = 'invalid-email';
    const invalidDestRes = await clientMod.sendNotificationEmail(
      { subject: 'Test', html: '<p>Hi</p>' },
      { resendClient: mockClient }
    );
    assert.equal(invalidDestRes.success, false);
    console.log('  [OK] Missing API key, missing sender, and invalid recipient config fail safely.');

    // 3. Header injection protection & RECRUITMENT_EMAIL routing
    process.env.NOTIFICATION_EMAIL = 'quotes@strovyn.example';
    process.env.RECRUITMENT_EMAIL = 'careers@strovyn.example';
    let capturedPayloads = [];
    const capturingClient = {
      emails: {
        send: async (payload, opts) => {
          capturedPayloads.push({ payload, opts });
          return { data: { id: `msg_${capturedPayloads.length}` }, error: null };
        },
      },
    };

    const sendOk = await clientMod.sendNotificationEmail(
      {
        subject: 'Hello\r\nBcc: attacker@evil.com',
        html: '<p>Safe</p>',
        recipientKind: 'recruitment',
        replyTo: 'applicant@example.com\r\nInjected: bad',
        idempotencyKey: 'app_dedup_123',
      },
      { resendClient: capturingClient }
    );
    assert.equal(sendOk.success, true);
    assert.equal(capturedPayloads[0].payload.to[0], 'careers@strovyn.example');
    assert.equal(capturedPayloads[0].payload.subject.includes('\n'), false);
    assert.equal(capturedPayloads[0].payload.replyTo, undefined);
    assert.equal(capturedPayloads[0].opts?.idempotencyKey, 'app_dedup_123');
    console.log('  [OK] Header injection protection, idempotency key, and recruitment routing verified.');

    // 4. Transient Resend failure -> bounded retry -> recovery
    let attemptNum = 0;
    const flakyClient = {
      emails: {
        send: async () => {
          attemptNum += 1;
          if (attemptNum < 2) {
            return { data: null, error: { message: 'Temporary 503', statusCode: 503 } };
          }
          return { data: { id: 'msg_recovered' }, error: null };
        },
      },
    };
    const retryRes = await clientMod.sendNotificationEmail(
      { subject: 'Retry Test', html: '<p>Body</p>' },
      { resendClient: flakyClient, retryDelayMs: 5 }
    );
    assert.equal(retryRes.success, true);
    assert.equal(retryRes.attempts, 2);

    // Persistent Resend failure does not block durable submission persistence
    let persistCount = 0;
    const dedupKey = `quote_dedup_test_${Date.now()}`;
    const outcome1 = await subMod.executeIdempotentSubmission({
      dedupKey,
      logLabel: 'Quote',
      emailPayload: quoteTpl,
      persistFn: async () => {
        persistCount += 1;
        return { id: 'q-1', createdAt: new Date().toISOString() };
      },
    });
    assert.equal(outcome1.status, 201);
    assert.equal(persistCount, 1);

    // Duplicate retry returns 200 without re-persisting
    const outcome2 = await subMod.executeIdempotentSubmission({
      dedupKey,
      logLabel: 'Quote',
      emailPayload: quoteTpl,
      persistFn: async () => {
        persistCount += 1;
        return { id: 'q-2', createdAt: new Date().toISOString() };
      },
    });
    assert.equal(outcome2.status, 200);
    assert.equal(outcome2.deduplicated, true);
    assert.equal(persistCount, 1);
    console.log('  [OK] Bounded retries, resilient submission persistence, and dedup verified.');

    // 5. Netlify cron adapter authentication & disabled-state handling
    const previewDisabled = await cronMod.invokeAuthenticatedCronEndpoint('/api/cron/publish-scheduled', {
      cronSecret: 'netlify-cron-secret-at-least-24-chars',
      baseUrl: 'https://strovyn.example',
      envOverrides: { CONTEXT: 'deploy-preview', STROVYN_CRON_ENABLED: 'true' },
    });
    assert.equal(previewDisabled.ok, true);
    assert.equal(previewDisabled.skipped, true);

    const explicitlyDisabled = await cronMod.invokeAuthenticatedCronEndpoint('/api/cron/publish-scheduled', {
      cronSecret: 'netlify-cron-secret-at-least-24-chars',
      baseUrl: 'https://strovyn.example',
      envOverrides: { CONTEXT: 'production', STROVYN_CRON_ENABLED: 'false' },
    });
    assert.equal(explicitlyDisabled.ok, true);
    assert.equal(explicitlyDisabled.skipped, true);

    const missingSecret = await cronMod.invokeAuthenticatedCronEndpoint('/api/cron/publish-scheduled', {
      cronSecret: '',
      baseUrl: 'https://strovyn.example',
      envOverrides: { CONTEXT: 'production', STROVYN_CRON_ENABLED: 'true' },
    });
    assert.equal(missingSecret.ok, false);
    assert.equal(missingSecret.status, 503);

    let calledCronUrl = '';
    let calledAuth = '';
    const cronOk = await cronMod.invokeAuthenticatedCronEndpoint('/api/cron/cleanup-uploads', {
      cronSecret: 'netlify-cron-secret-at-least-24-chars',
      baseUrl: 'https://strovyn.example',
      envOverrides: { CONTEXT: 'production', STROVYN_CRON_ENABLED: 'true' },
      fetchImpl: async (url, init) => {
        calledCronUrl = url;
        calledAuth = init.headers.Authorization;
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      },
    });
    assert.equal(cronOk.ok, true);
    assert.equal(calledCronUrl, 'https://strovyn.example/api/cron/cleanup-uploads');
    assert.equal(calledAuth, 'Bearer netlify-cron-secret-at-least-24-chars');
    console.log('  [OK] Netlify scheduled cron adapter authentication and enable/disable gates verified.');

    // 6. Netlify environment isolation (both directions + serviceRole runtime path)
    assert.throws(
      () =>
        envMod.assertEnvironmentIsolation({
          env: 'production',
          supabaseUrl: 'https://euhgtzblwyogmqdldmni.supabase.co',
        }),
      /cannot connect to the staging Supabase project/
    );
    assert.throws(
      () =>
        envMod.assertEnvironmentIsolation({
          env: 'deploy-preview',
          supabaseUrl: 'https://prodprojectref.supabase.co',
          productionSupabaseRef: 'prodprojectref',
        }),
      /cannot connect to the production Supabase project/
    );
    assert.equal(
      envMod.assertEnvironmentIsolation({
        env: 'deploy-preview',
        supabaseUrl: 'https://euhgtzblwyogmqdldmni.supabase.co',
      }).ok,
      true
    );
    console.log('  [OK] Netlify production vs deploy-preview Supabase isolation verified.');

    // 7. Durable Migration 016 Email Notification Outbox (PGlite)
    const db = new PGlite();
    try {
      await db.exec(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
        END $$;
        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE SCHEMA IF NOT EXISTS storage;
        CREATE TABLE IF NOT EXISTS storage.buckets (id TEXT PRIMARY KEY, name TEXT NOT NULL, public BOOLEAN DEFAULT FALSE, file_size_limit BIGINT, allowed_mime_types TEXT[]);
        CREATE TABLE IF NOT EXISTS storage.objects (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id TEXT NOT NULL, name TEXT NOT NULL);
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL AS $$ SELECT NULL::uuid $$;
        CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT LANGUAGE SQL AS $$ SELECT 'anon'::text $$;
      `);
      for (const file of MIGRATION_FILES) {
        await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
      }
      const adapter = createPgliteAdapter(db);
      const outboxMod = loadProjectTsModule(
        'src/lib/resend/outboxService.ts',
        {
          ...stubs,
          '@/lib/supabase/serviceRole': {
            createServiceRoleClient: () => adapter,
            isServiceRoleConfigured: () => true,
          },
        },
        new Map()
      );

      // Insert real quote row with idempotency_key: atomic trigger must create pending outbox row in same tx
      const qId1 = '11111111-1111-4111-8111-111111111111';
      await db.query(
        `INSERT INTO public.quote_requests (id, full_name, email, phone, project_location, service_required, description, idempotency_key)
         VALUES ($1, 'Outbox Client', 'outbox@example.com', '0400000000', 'Adelaide', 'Interior Painting', 'Outbox test quote', 'outbox_key_1')`,
        [qId1]
      );
      const triggerQuoteRow = (
        await db.query(
          `SELECT submission_type, recipient_kind, status, idempotency_key FROM public.email_notification_outbox WHERE submission_id = $1`,
          [qId1]
        )
      ).rows[0];
      assert.equal(triggerQuoteRow?.submission_type, 'quote_request');
      assert.equal(triggerQuoteRow?.recipient_kind, 'default');
      assert.equal(triggerQuoteRow?.status, 'pending');
      assert.equal(triggerQuoteRow?.idempotency_key, 'outbox_key_1');

      // 7a. Transient 429 -> stays pending with backoff; replay does not duplicate
      const fail429Client = {
        emails: { send: async () => ({ data: null, error: { message: '429 rate limited', statusCode: 429 } }) },
      };
      const enq1 = await outboxMod.enqueueAndAttemptEmailNotification(
        {
          submissionType: 'quote_request',
          submissionId: qId1,
          idempotencyKey: 'outbox_key_1',
          ...quoteTpl,
        },
        { clientOverride: adapter, resendClient: fail429Client, retryDelayMs: 1 }
      );
      assert.equal(enq1.success, false);
      assert.equal(enq1.outboxStatus, 'pending');

      // Replay with same idempotencyKey reuses existing outbox row (count stays 1)
      await outboxMod.enqueueAndAttemptEmailNotification(
        {
          submissionType: 'quote_request',
          submissionId: qId1,
          idempotencyKey: 'outbox_key_1',
          ...quoteTpl,
        },
        { clientOverride: adapter, resendClient: fail429Client, retryDelayMs: 1 }
      );
      const obCount = (await db.query(`SELECT count(*)::int AS cnt FROM public.email_notification_outbox`)).rows[0].cnt;
      assert.equal(obCount, 1);

      // 7b. Delayed retry + concurrent workers + lease recovery
      await db.query(
        `UPDATE public.email_notification_outbox SET next_retry_at = NOW() - INTERVAL '1 minute' WHERE idempotency_key = 'outbox_key_1'`
      );
      let workerSends = 0;
      const okClient = {
        emails: {
          send: async () => {
            workerSends += 1;
            return { data: { id: `msg_ob_${workerSends}` }, error: null };
          },
        },
      };
      const [wA, wB] = await Promise.all([
        outboxMod.runEmailOutboxWorker({ limit: 10 }, { clientOverride: adapter, resendClient: okClient, retryDelayMs: 1 }),
        outboxMod.runEmailOutboxWorker({ limit: 10 }, { clientOverride: adapter, resendClient: okClient, retryDelayMs: 1 }),
      ]);
      assert.equal(wA.sent + wB.sent, 1);
      assert.equal(workerSends, 1);

      // 7c. Permanent 422 failure -> failed_permanent
      const permClient = {
        emails: { send: async () => ({ data: null, error: { message: '422 Invalid recipient domain', statusCode: 422 } }) },
      };
      const permRes = await outboxMod.enqueueAndAttemptEmailNotification(
        {
          submissionType: 'quote_request',
          submissionId: qId1,
          idempotencyKey: 'outbox_key_perm',
          ...quoteTpl,
        },
        { clientOverride: adapter, resendClient: permClient, retryDelayMs: 1 }
      );
      assert.equal(permRes.outboxStatus, 'failed_permanent');

      // 7d. Claim recovery after interrupted worker (expired lease)
      await db.query(
        `INSERT INTO public.email_notification_outbox
          (submission_type, submission_id, idempotency_key, status, attempts, next_retry_at, claim_token, claim_expires_at)
         VALUES ('quote_request', $1, 'outbox_key_crashed', 'pending', 1, NOW() - INTERVAL '2 minutes', gen_random_uuid(), NOW() - INTERVAL '5 seconds')`,
        [qId1]
      );
      const recRes = await outboxMod.runEmailOutboxWorker(
        { limit: 10 },
        { clientOverride: adapter, resendClient: okClient, retryDelayMs: 1 }
      );
      assert.equal(recRes.sent, 1);

      // 7e. Atomic trigger for job_applications (recruitment) + customer_feedback + crash recovery without enqueue call
      const appId1 = '22222222-2222-4222-8222-222222222222';
      await db.query(
        `INSERT INTO public.job_applications (id, applicant_name, email, phone, cover_letter)
         VALUES ($1, 'Trigger Painter', 'painter@example.com', '0411111111', '5 years commercial')`,
        [appId1]
      );
      const fbId1 = '33333333-3333-4333-8333-333333333333';
      await db.query(
        `INSERT INTO public.customer_feedback (id, name, email, message)
         VALUES ($1, 'Trigger Feedback', 'fb@example.com', 'Hello from trigger test')`,
        [fbId1]
      );
      const trigRows = (
        await db.query(
          `SELECT submission_type, recipient_kind, status, idempotency_key FROM public.email_notification_outbox WHERE submission_id IN ($1, $2) ORDER BY submission_type`,
          [appId1, fbId1]
        )
      ).rows;
      assert.equal(trigRows.length, 2);
      assert.equal(trigRows[0].submission_type, 'customer_feedback');
      assert.equal(trigRows[0].recipient_kind, 'default');
      assert.equal(trigRows[0].idempotency_key, `customer_feedback:${fbId1}`);
      assert.equal(trigRows[1].submission_type, 'job_application');
      assert.equal(trigRows[1].recipient_kind, 'recruitment');
      assert.equal(trigRows[1].idempotency_key, `job_applications:${appId1}`);

      const crashRecRes = await outboxMod.runEmailOutboxWorker(
        { limit: 10 },
        { clientOverride: adapter, resendClient: okClient, retryDelayMs: 1 }
      );
      assert.equal(crashRecRes.sent, 2);

      // 7f. Outbox unavailable during submission -> customer insert succeeds, reconciliation recovers after restore
      await db.exec(`ALTER TABLE public.email_notification_outbox RENAME TO email_notification_outbox_offline`);
      const qIdDegraded = '44444444-4444-4444-8444-444444444444';
      const appIdDegraded = '55555555-5555-4555-8555-555555555555';
      const fbIdDegraded = '66666666-6666-4666-8666-666666666666';
      await db.query(
        `INSERT INTO public.quote_requests (id, full_name, email, phone, project_location, service_required, description, idempotency_key)
         VALUES ($1, 'Degraded Client', 'degraded@example.com', '0422222222', 'Adelaide', 'Exterior Painting', 'Outbox offline test', 'degraded_quote_key')`,
        [qIdDegraded]
      );
      await db.query(
        `INSERT INTO public.job_applications (id, applicant_name, email, phone, cover_letter)
         VALUES ($1, 'Degraded Applicant', 'degapp@example.com', '0433333333', 'Outbox offline app')`,
        [appIdDegraded]
      );
      await db.query(
        `INSERT INTO public.customer_feedback (id, name, email, message)
         VALUES ($1, 'Degraded Feedback', 'degfb@example.com', 'Outbox offline fb')`,
        [fbIdDegraded]
      );
      // Restore outbox table and verify worker reconciles and delivers all 3 without duplicates
      await db.exec(`ALTER TABLE public.email_notification_outbox_offline RENAME TO email_notification_outbox`);
      const recWorker1 = await outboxMod.runEmailOutboxWorker(
        { limit: 10 },
        { clientOverride: adapter, resendClient: okClient, retryDelayMs: 1 }
      );
      assert.equal(recWorker1.reconciled, 3);
      assert.equal(recWorker1.sent, 3);
      const recWorker2 = await outboxMod.runEmailOutboxWorker(
        { limit: 10 },
        { clientOverride: adapter, resendClient: okClient, retryDelayMs: 1 }
      );
      assert.equal(recWorker2.reconciled, 0);
      assert.equal(recWorker2.sent, 0);

      // 7g. Cross-submission idempotency isolation (same idempotency_key across quote and application)
      const qCrossId = '77777777-7777-4777-8777-777777777777';
      const appCrossId = '88888888-8888-4888-8888-888888888888';
      await db.query(
        `INSERT INTO public.quote_requests (id, full_name, email, phone, project_location, service_required, description, idempotency_key)
         VALUES ($1, 'Cross Quote', 'cq@example.com', '0444444444', 'Adelaide', 'Interior Painting', 'Cross key test', 'shared_cross_key')`,
        [qCrossId]
      );
      await db.query(
        `INSERT INTO public.job_applications (id, applicant_name, email, phone, cover_letter, idempotency_key)
         VALUES ($1, 'Cross App', 'ca@example.com', '0455555555', 'Cross key app', 'shared_cross_key')`,
        [appCrossId]
      );
      const crossRows = (
        await db.query(
          `SELECT submission_type FROM public.email_notification_outbox WHERE idempotency_key = 'shared_cross_key' ORDER BY submission_type`
        )
      ).rows;
      assert.equal(crossRows.length, 2);
      assert.equal(crossRows[0].submission_type, 'job_application');
      assert.equal(crossRows[1].submission_type, 'quote_request');
      const crossWorker = await outboxMod.runEmailOutboxWorker(
        { limit: 10 },
        { clientOverride: adapter, resendClient: okClient, retryDelayMs: 1 }
      );
      assert.equal(crossWorker.sent, 2);

      // 7h. Bounded historical reconciliation outside default 7-day (168h) lookback window
      await db.exec(`ALTER TABLE public.email_notification_outbox RENAME TO email_notification_outbox_offline`);
      const qHistId = '99999999-9999-4999-8999-999999999999';
      await db.query(
        `INSERT INTO public.quote_requests (id, full_name, email, phone, project_location, service_required, description, created_at)
         VALUES ($1, 'Historical Quote', 'hq@example.com', '0466666666', 'Adelaide', 'Exterior Painting', '10 days ago', NOW() - INTERVAL '10 days')`,
        [qHistId]
      );
      await db.exec(`ALTER TABLE public.email_notification_outbox_offline RENAME TO email_notification_outbox`);
      const defaultWin = await outboxMod.runEmailOutboxWorker(
        { limit: 10 },
        { clientOverride: adapter, resendClient: okClient, retryDelayMs: 1 }
      );
      assert.equal(defaultWin.reconciled, 0);
      const histWin = await outboxMod.runEmailOutboxWorker(
        { limit: 10, reconcileLookbackHours: 720 },
        { clientOverride: adapter, resendClient: okClient, retryDelayMs: 1 }
      );
      assert.equal(histWin.reconciled, 1);
      assert.equal(histWin.sent, 1);
      console.log('  [OK] Migration 016 durable email outbox (atomic triggers, graceful degradation + reconciliation, cross-type isolation, historical recovery, backoff, replay, concurrency, permanent failure, lease recovery) verified.');
    } finally {
      await db.close();
    }
    console.log('=== Netlify & Resend Integration Suite PASSED ===');
  } finally {
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
