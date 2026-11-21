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
];

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

  function parseSimpleOrExpr(expr, params) {
    // Supports "col.is.null,col.lte.2026-..."
    const parts = expr.split(',');
    const sqlParts = [];
    for (const part of parts) {
      const mIs = part.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\.is\.null$/);
      if (mIs) {
        sqlParts.push(`${sanitizeCol(mIs[1])} IS NULL`);
        continue;
      }
      const mLte = part.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\.lte\.(.+)$/);
      if (mLte) {
        params.push(mLte[2]);
        sqlParts.push(`${sanitizeCol(mLte[1])} <= $${params.length}`);
        continue;
      }
      throw new Error(`Unsupported or() fragment in test adapter: ${part}`);
    }
    return `(${sqlParts.join(' OR ')})`;
  }

  class QueryBuilder {
    constructor(table) {
      this.table = table;
      this.op = 'select';
      this.payload = null;
      this.filters = [];
      this.orders = [];
      this.limitCount = null;
      this.expectSingle = false;
      this.expectMaybeSingle = false;
    }

    select() {
      if (this.op !== 'insert' && this.op !== 'update' && this.op !== 'delete') {
        this.op = 'select';
      }
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

    delete() {
      this.op = 'delete';
      return this;
    }

    eq(col, val) {
      this.filters.push({ kind: 'eq', col, val });
      return this;
    }

    lte(col, val) {
      this.filters.push({ kind: 'lte', col, val });
      return this;
    }

    lt(col, val) {
      this.filters.push({ kind: 'lt', col, val });
      return this;
    }

    is(col, val) {
      this.filters.push({ kind: 'is', col, val });
      return this;
    }

    in(col, vals) {
      this.filters.push({ kind: 'in', col, vals });
      return this;
    }

    or(expr) {
      this.filters.push({ kind: 'or', expr });
      return this;
    }

    order(col, opts = {}) {
      this.orders.push({ col, ascending: opts.ascending !== false });
      return this;
    }

    limit(n) {
      this.limitCount = n;
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

    buildWhere(params) {
      if (this.filters.length === 0) return '';
      const clauses = [];
      for (const f of this.filters) {
        if (f.kind === 'eq') {
          params.push(serializeParam(f.val));
          clauses.push(`${sanitizeCol(f.col)} = $${params.length}`);
        } else if (f.kind === 'lte') {
          params.push(serializeParam(f.val));
          clauses.push(`${sanitizeCol(f.col)} <= $${params.length}`);
        } else if (f.kind === 'lt') {
          params.push(serializeParam(f.val));
          clauses.push(`${sanitizeCol(f.col)} < $${params.length}`);
        } else if (f.kind === 'is') {
          if (f.val === null) {
            clauses.push(`${sanitizeCol(f.col)} IS NULL`);
          } else {
            params.push(serializeParam(f.val));
            clauses.push(`${sanitizeCol(f.col)} IS $${params.length}`);
          }
        } else if (f.kind === 'in') {
          const placeholders = f.vals.map((v) => {
            params.push(serializeParam(v));
            return `$${params.length}`;
          });
          clauses.push(`${sanitizeCol(f.col)} IN (${placeholders.join(', ')})`);
        } else if (f.kind === 'or') {
          clauses.push(parseSimpleOrExpr(f.expr, params));
        }
      }
      return ` WHERE ${clauses.join(' AND ')}`;
    }

    async execute() {
      try {
        const params = [];
        let sql = '';

        if (this.op === 'select') {
          sql = `SELECT * FROM public.${sanitizeCol(this.table)}${this.buildWhere(params)}`;
          if (this.orders.length > 0) {
            sql +=
              ' ORDER BY ' +
              this.orders.map((o) => `${sanitizeCol(o.col)} ${o.ascending ? 'ASC' : 'DESC'}`).join(', ');
          }
          if (this.limitCount !== null) {
            sql += ` LIMIT ${Number(this.limitCount)}`;
          }
        } else if (this.op === 'insert') {
          const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
          const cols = Object.keys(rows[0]);
          const valueGroups = rows.map((row) => {
            const ph = cols.map((c) => {
              params.push(serializeParam(row[c]));
              return `$${params.length}`;
            });
            return `(${ph.join(', ')})`;
          });
          sql = `INSERT INTO public.${sanitizeCol(this.table)} (${cols.map(sanitizeCol).join(', ')}) VALUES ${valueGroups.join(', ')} RETURNING *`;
        } else if (this.op === 'update') {
          const cols = Object.keys(this.payload);
          const sets = cols.map((c) => {
            params.push(serializeParam(this.payload[c]));
            return `${sanitizeCol(c)} = $${params.length}`;
          });
          sql = `UPDATE public.${sanitizeCol(this.table)} SET ${sets.join(', ')}${this.buildWhere(params)} RETURNING *`;
        } else if (this.op === 'delete') {
          sql = `DELETE FROM public.${sanitizeCol(this.table)}${this.buildWhere(params)} RETURNING *`;
        }

        const res = await db.query(sql, params);
        const rows = res.rows.map(normalizeRow);
        if (this.expectSingle) {
          if (rows.length !== 1) {
            return { data: null, error: { message: `Expected single row, got ${rows.length}`, code: 'PGRST116' } };
          }
          return { data: rows[0], error: null };
        }
        if (this.expectMaybeSingle) {
          return { data: rows[0] ?? null, error: null };
        }
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
        assert.match(fnName, /^[a-zA-Z_][a-zA-Z0-9_]*$/);
        const keys = Object.keys(args);
        const params = [];
        const namedArgs = keys.map((k) => {
          assert.match(k, /^[a-zA-Z_][a-zA-Z0-9_]*$/);
          params.push(serializeParam(args[k]));
          return `${k} => $${params.length}`;
        });
        const sql = `SELECT * FROM public.${fnName}(${namedArgs.join(', ')})`;
        const res = await db.query(sql, params);
        const rows = res.rows.map(normalizeRow);
        // For scalar-returning functions vs SETOF functions
        if (rows.length === 1 && Object.keys(rows[0]).length === 1 && fnName in rows[0]) {
          return { data: rows[0][fnName], error: null };
        }
        return { data: rows, error: null };
      } catch (err) {
        return { data: null, error: { message: err.message, code: err.code } };
      }
    },
  };
}

async function main() {
  console.log('=== Business CMS Phase G Operational Automation & Hardening Suite ===');
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
      CREATE TABLE IF NOT EXISTS storage.buckets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        public BOOLEAN DEFAULT FALSE,
        file_size_limit BIGINT,
        allowed_mime_types TEXT[]
      );
      CREATE TABLE IF NOT EXISTS storage.objects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bucket_id TEXT NOT NULL,
        name TEXT NOT NULL
      );
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL AS $$ SELECT NULL::uuid $$;
      CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT LANGUAGE SQL AS $$ SELECT 'anon'::text $$;
    `);

    for (const file of MIGRATION_FILES) {
      await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
    }
    console.log('  [OK] Migrations 001-015 applied cleanly in PGlite.');

    const adapter = createPgliteAdapter(db);
    const revalidatedPaths = [];
    const cache = new Map();

    const stubs = {
      'server-only': {},
      'next/cache': {
        revalidatePath(p) {
          revalidatedPaths.push(p);
        },
      },
      '@/lib/supabase/server': {
        createServiceRoleClient: () => adapter,
      },
      '@/lib/supabase/serviceRole': {
        createServiceRoleClient: () => adapter,
      },
      '@/lib/cms/editorialAuth': {
        requireEditorialStaff: async () => {
          throw new Error('Not used directly in unit test');
        },
      },
    };

    const cronAuthMod = loadProjectTsModule('src/lib/cms/cronAuth.ts', stubs, cache);
    const editorialMod = loadProjectTsModule('src/lib/cms/editorialService.ts', stubs, cache);
    const accessMod = loadProjectTsModule('src/lib/cms/stage1Access.ts', stubs, cache);
    const schedMod = loadProjectTsModule('src/lib/cms/scheduledPublisherService.ts', stubs, cache);
    const aiMod = loadProjectTsModule('src/lib/cms/aiStudioProvider.ts', stubs, cache);

    // Seed staff users for editorial & AI tests
    const editorStaff = {
      id: '11111111-1111-4111-8111-111111111111',
      auth_user_id: '22222222-2222-4222-8222-222222222222',
      email: 'editor@strovyn.invalid',
      full_name: 'Editor Staff',
      role: 'editor',
      is_active: true,
    };
    const publisherStaff = {
      id: '33333333-3333-4333-8333-333333333333',
      auth_user_id: '44444444-4444-4444-8444-444444444444',
      email: 'publisher@strovyn.invalid',
      full_name: 'Publisher Staff',
      role: 'publisher',
      is_active: true,
    };
    await db.query(
      `INSERT INTO public.staff_users (id, auth_user_id, email, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)`,
      [
        editorStaff.id,
        editorStaff.auth_user_id,
        editorStaff.email,
        editorStaff.full_name,
        editorStaff.role,
        true,
        publisherStaff.id,
        publisherStaff.auth_user_id,
        publisherStaff.email,
        publisherStaff.full_name,
        publisherStaff.role,
        true,
      ]
    );

    // -------------------------------------------------------------------------
    // 1. Role permissions & transition model for scheduled publishing
    // -------------------------------------------------------------------------
    const pubApprovedActions = accessMod.getAvailableWorkflowTransitionsForRole('publisher', 'approved');
    assert.ok(pubApprovedActions.some((a) => a.toStatus === 'scheduled'));
    const edApprovedActions = accessMod.getAvailableWorkflowTransitionsForRole('editor', 'approved');
    assert.equal(edApprovedActions.some((a) => a.toStatus === 'scheduled'), false);

    // Create draft -> review -> approved article
    const created = await editorialMod.createEditorialDraft(
      editorStaff,
      {
        title: 'Phase G Scheduled Limewash Guide',
        slug: 'phase-g-scheduled-limewash-guide',
        excerpt: 'Technical preparation standards for mineral limewash finishes on Adelaide masonry.',
        content_json: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Breathable mineral limewash requires sound substrate preparation.' }],
            },
          ],
        },
        category: 'heritage',
        featured_image_alt: 'Limewash masonry sample',
      },
      adapter
    );

    const inReview = await editorialMod.transitionEditorialArticle(
      editorStaff,
      created.id,
      { toStatus: 'review', expected_updated_at: created.updated_at },
      adapter
    );
    const approved = await editorialMod.transitionEditorialArticle(
      publisherStaff,
      created.id,
      { toStatus: 'approved', expected_updated_at: inReview.updated_at },
      adapter
    );

    // Editor cannot schedule
    await assert.rejects(
      () =>
        editorialMod.transitionEditorialArticle(
          editorStaff,
          created.id,
          {
            toStatus: 'scheduled',
            scheduled_at: new Date(Date.now() + 3600_000).toISOString(),
            expected_updated_at: approved.updated_at,
          },
          adapter
        ),
      (err) => err.status === 403 && err.code === 'FORBIDDEN'
    );

    // Missing scheduled_at -> 422 SCHEDULED_AT_REQUIRED
    await assert.rejects(
      () =>
        editorialMod.transitionEditorialArticle(
          publisherStaff,
          created.id,
          { toStatus: 'scheduled', expected_updated_at: approved.updated_at },
          adapter
        ),
      (err) => err.status === 422 && err.code === 'SCHEDULED_AT_REQUIRED'
    );

    // Past scheduled_at -> 422 INVALID_SCHEDULED_AT
    await assert.rejects(
      () =>
        editorialMod.transitionEditorialArticle(
          publisherStaff,
          created.id,
          {
            toStatus: 'scheduled',
            scheduled_at: new Date(Date.now() - 60_000).toISOString(),
            expected_updated_at: approved.updated_at,
          },
          adapter
        ),
      (err) => err.status === 422 && err.code === 'INVALID_SCHEDULED_AT'
    );

    // Valid future scheduled_at -> 200 scheduled
    const futureAt = new Date(Date.now() + 3600_000).toISOString();
    const scheduled = await editorialMod.transitionEditorialArticle(
      publisherStaff,
      created.id,
      {
        toStatus: 'scheduled',
        scheduled_at: futureAt,
        note: 'Schedule for morning release',
        expected_updated_at: approved.updated_at,
      },
      adapter
    );
    assert.equal(scheduled.status, 'scheduled');
    assert.ok(scheduled.scheduled_at);

    // Scheduled article MUST remain invisible to anon
    await db.exec('BEGIN; SET LOCAL ROLE anon;');
    const anonCheck1 = await db.query(`SELECT count(*)::int AS cnt FROM public.articles WHERE id = $1`, [created.id]);
    await db.exec('ROLLBACK;');
    assert.equal(anonCheck1.rows[0].cnt, 0);

    // Publisher can cancel/unschedule back to approved
    const unscheduled = await editorialMod.transitionEditorialArticle(
      publisherStaff,
      created.id,
      { toStatus: 'approved', expected_updated_at: scheduled.updated_at, note: 'Hold for edit' },
      adapter
    );
    assert.equal(unscheduled.status, 'approved');
    assert.equal(unscheduled.scheduled_at, null);

    // Re-schedule for concurrent cron worker test
    const scheduled2 = await editorialMod.transitionEditorialArticle(
      publisherStaff,
      created.id,
      {
        toStatus: 'scheduled',
        scheduled_at: new Date(Date.now() + 3600_000).toISOString(),
        expected_updated_at: unscheduled.updated_at,
      },
      adapter
    );

    // Future-scheduled article must NOT be published yet
    const prematureRun = await schedMod.runScheduledArticlePublisher({ limit: 10 }, adapter);
    assert.equal(prematureRun.claimed, 0);
    assert.equal(prematureRun.published, 0);

    // Move scheduled_at into the past to simulate due publication
    await db.query(
      `UPDATE public.articles SET scheduled_at = NOW() - INTERVAL '2 minutes' WHERE id = $1`,
      [scheduled2.id]
    );

    // -------------------------------------------------------------------------
    // 2. Concurrent scheduler execution & idempotency
    // -------------------------------------------------------------------------
    const [runA, runB] = await Promise.all([
      schedMod.runScheduledArticlePublisher({ limit: 10 }, adapter),
      schedMod.runScheduledArticlePublisher({ limit: 10 }, adapter),
    ]);
    assert.equal(runA.published + runB.published, 1);
    assert.equal(runA.failed + runB.failed, 0);

    // Third run is completely idempotent
    const runC = await schedMod.runScheduledArticlePublisher({ limit: 10 }, adapter);
    assert.equal(runC.claimed, 0);
    assert.equal(runC.published, 0);

    // Verify published state, anon visibility, cache revalidation, and cron audit log
    await db.exec('BEGIN; SET LOCAL ROLE anon;');
    const anonCheckAfter = await db.query(`SELECT status FROM public.articles WHERE id = $1`, [created.id]);
    await db.exec('ROLLBACK;');
    assert.equal(anonCheckAfter.rows.length, 1);
    assert.equal(anonCheckAfter.rows[0].status, 'published');
    assert.ok(revalidatedPaths.includes('/insights'));
    assert.ok(revalidatedPaths.includes('/insights/phase-g-scheduled-limewash-guide'));

    const auditRows = await db.query(
      `SELECT actor_type, action FROM public.article_audit_log WHERE article_id = $1 AND action = 'cron_publish_scheduled'`,
      [created.id]
    );
    assert.equal(auditRows.rows.length, 1);
    assert.equal(auditRows.rows[0].actor_type, 'cron');
    console.log('  [OK] Scheduled article lifecycle, concurrent publisher, idempotency, and cron audit verified.');

    // -------------------------------------------------------------------------
    // 3. Failure backoff & failure privacy
    // -------------------------------------------------------------------------
    const failDraft = await editorialMod.createEditorialDraft(
      editorStaff,
      {
        title: 'Phase G Failure Privacy Article',
        slug: 'phase-g-failure-privacy-article',
        excerpt: 'Testing bounded retry backoff on simulated publish failure.',
        content_json: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Simulated failure test body content with sufficient readable length.' }] }],
        },
        category: 'coatings',
        featured_image_alt: 'Test alt',
      },
      adapter
    );
    const failRev = await editorialMod.transitionEditorialArticle(
      editorStaff,
      failDraft.id,
      { toStatus: 'review', expected_updated_at: failDraft.updated_at },
      adapter
    );
    const failApp = await editorialMod.transitionEditorialArticle(
      publisherStaff,
      failDraft.id,
      { toStatus: 'approved', expected_updated_at: failRev.updated_at },
      adapter
    );
    await editorialMod.transitionEditorialArticle(
      publisherStaff,
      failDraft.id,
      {
        toStatus: 'scheduled',
        scheduled_at: new Date(Date.now() + 3600_000).toISOString(),
        expected_updated_at: failApp.updated_at,
      },
      adapter
    );
    await db.query(
      `UPDATE public.articles SET scheduled_at = NOW() - INTERVAL '2 minutes' WHERE id = $1`,
      [failDraft.id]
    );

    const failingAdapter = {
      from: (...args) => adapter.from(...args),
      rpc: async (fnName, args) => {
        if (fnName === 'cms_transition_article_status') {
          return { data: null, error: { message: 'Simulated transient publish RPC outage' } };
        }
        return adapter.rpc(fnName, args);
      },
    };

    const failRun = await schedMod.runScheduledArticlePublisher({ limit: 10 }, failingAdapter);
    assert.equal(failRun.failed, 1);
    assert.equal(failRun.published, 0);

    const afterFailRow = (
      await db.query(
        `SELECT status, publish_attempts, last_publish_error, next_retry_at FROM public.articles WHERE id = $1`,
        [failDraft.id]
      )
    ).rows[0];
    assert.equal(afterFailRow.status, 'scheduled');
    assert.equal(afterFailRow.publish_attempts, 1);
    assert.match(afterFailRow.last_publish_error, /Simulated transient publish RPC outage/);
    assert.ok(afterFailRow.next_retry_at);

    // Must remain invisible to anon
    await db.exec('BEGIN; SET LOCAL ROLE anon;');
    const anonFailCheck = await db.query(`SELECT count(*)::int AS cnt FROM public.articles WHERE id = $1`, [failDraft.id]);
    await db.exec('ROLLBACK;');
    assert.equal(anonFailCheck.rows[0].cnt, 0);

    // Immediate retry must skip because next_retry_at > NOW()
    const backoffSkip = await schedMod.runScheduledArticlePublisher({ limit: 10 }, adapter);
    assert.equal(backoffSkip.claimed, 0);
    console.log('  [OK] Scheduled publish failure backoff and privacy verified.');

    // -------------------------------------------------------------------------
    // 4. Cron Authentication & Route Handler Protection
    // -------------------------------------------------------------------------
    const prevCronSecret = process.env.CRON_SECRET;
    try {
      delete process.env.CRON_SECRET;
      assert.throws(
        () => cronAuthMod.assertCronAuthorized(new Request('http://localhost/api/cron/publish-scheduled')),
        (err) => err.status === 503 && err.code === 'INTERNAL_ERROR'
      );

      process.env.CRON_SECRET = 'phase-g-super-secret-cron-token-2026';
      assert.throws(
        () => cronAuthMod.assertCronAuthorized(new Request('http://localhost/api/cron/publish-scheduled')),
        (err) => err.status === 401 && err.code === 'FORBIDDEN'
      );
      assert.throws(
        () =>
          cronAuthMod.assertCronAuthorized(
            new Request('http://localhost/api/cron/publish-scheduled', {
              headers: { Authorization: 'Bearer wrong-token-value' },
            })
          ),
        (err) => err.status === 401 && err.code === 'FORBIDDEN'
      );
      cronAuthMod.assertCronAuthorized(
        new Request('http://localhost/api/cron/publish-scheduled', {
          headers: { Authorization: 'Bearer phase-g-super-secret-cron-token-2026' },
        })
      );
    } finally {
      if (prevCronSecret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prevCronSecret;
    }
    console.log('  [OK] Timing-safe CRON_SECRET authentication verified (503 unconfigured / 401 unauthorized / 200 valid).');

    // -------------------------------------------------------------------------
    // 5. Expired Private Upload Cleanup Preservation vs Deletion
    // -------------------------------------------------------------------------
    const expiredUnclaimedId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const expiredClaimedId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const deletedStoragePaths = [];
    await db.query(
      `INSERT INTO public.customer_document_uploads
        (id, bucket_id, category, storage_path, file_reference, mime_type, byte_size, claim_token_hash, expires_at, claimed_by_table, claimed_record_id, claimed_at)
       VALUES
        ($1, 'customer-documents', 'documents', 'quotes/unclaimed.pdf', 'supabase://customer-documents/quotes/unclaimed.pdf', 'application/pdf', 1024, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', NOW() - INTERVAL '1 hour', NULL, NULL, NULL),
        ($2, 'customer-documents', 'documents', 'quotes/claimed.pdf', 'supabase://customer-documents/quotes/claimed.pdf', 'application/pdf', 2048, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', NOW() - INTERVAL '1 hour', 'quote_requests', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', NOW() - INTERVAL '2 hours')`,
      [expiredUnclaimedId, expiredClaimedId]
    );

    const storageEnabledAdapter = {
      ...adapter,
      storage: {
        from(bucket) {
          assert.equal(bucket, 'customer-documents');
          return {
            remove: async (paths) => {
              deletedStoragePaths.push(...paths);
              return { data: paths, error: null };
            },
          };
        },
      },
    };
    const mockDataMod = loadProjectTsModule(
      'src/lib/db/mockData.ts',
      {
        ...stubs,
        '@/lib/supabase/serviceRole': {
          createServiceRoleClient: () => storageEnabledAdapter,
          isServiceRoleConfigured: () => true,
        },
        '@/lib/supabase/server': {
          createServiceRoleClient: () => storageEnabledAdapter,
          createServerSupabaseClient: () => storageEnabledAdapter,
        },
      },
      new Map()
    );

    const cleanupRes = await mockDataMod.cleanupExpiredCustomerDocumentUploads({ graceSeconds: 0, limit: 20 });
    assert.equal(cleanupRes.ok, true);
    assert.equal(cleanupRes.reserved, 1);
    assert.equal(cleanupRes.deleted, 1);
    assert.deepEqual(deletedStoragePaths, ['quotes/unclaimed.pdf']);

    const uploadRows = (
      await db.query(`SELECT id, cleanup_state, cleaned_at FROM public.customer_document_uploads ORDER BY id ASC`)
    ).rows;
    assert.equal(uploadRows.length, 2);
    const unclaimedRow = uploadRows.find((r) => r.id === expiredUnclaimedId);
    const claimedRow = uploadRows.find((r) => r.id === expiredClaimedId);
    assert.equal(unclaimedRow.cleanup_state, 'deleted');
    assert.ok(unclaimedRow.cleaned_at);
    assert.notEqual(claimedRow.cleanup_state, 'deleted');
    assert.equal(claimedRow.cleaned_at, null);
    console.log('  [OK] Expired unclaimed upload deleted while claimed submission attachment preserved.');

    // -------------------------------------------------------------------------
    // 6. Durable AI Studio Quotas, Cost Safeguards & Provider Failure Handling
    // -------------------------------------------------------------------------
    const aiRes = await aiMod.executeAiStudioGeneration(
      publisherStaff.id,
      {
        mode: 'seo_assistant',
        currentTitle: 'Architectural Painting Adelaide Specifications',
        currentContentOrSummary: 'Mineral silicate coatings for sandstone facades in North Adelaide.',
        primaryKeyword: 'architectural painting adelaide',
        locationOrService: 'Adelaide',
      },
      { clientOverride: adapter }
    );
    assert.equal(aiRes.usage.quotaBackend, 'database');
    assert.equal(aiRes.usage.staffRequestsToday, 1);
    assert.ok(aiRes.usage.staffTokensToday > 0);
    assert.ok(aiRes.usage.staffCostMicrosToday > 0);

    // Exhaust staff token budget via DB RPC directly to confirm independent token/cost ceiling enforcement
    const tokenDeny = await adapter.rpc('cms_reserve_ai_studio_quota', {
      p_staff_id: publisherStaff.id,
      p_est_input_tokens: 500000,
      p_est_input_cost_micros: 1,
    });
    assert.equal(tokenDeny.error, null);
    assert.equal(tokenDeny.data[0].allowed, false);
    assert.equal(tokenDeny.data[0].denial_reason, 'STAFF_TOKEN_BUDGET');

    const costDeny = await adapter.rpc('cms_reserve_ai_studio_quota', {
      p_staff_id: publisherStaff.id,
      p_est_input_tokens: 1,
      p_est_input_cost_micros: 900000,
    });
    assert.equal(costDeny.error, null);
    assert.equal(costDeny.data[0].allowed, false);
    assert.equal(costDeny.data[0].denial_reason, 'STAFF_COST_CEILING');

    // Concurrent reservation near request limit (limit=3, already 1 used -> max 2 more succeed)
    const concurrentReserves = await Promise.all([
      adapter.rpc('cms_reserve_ai_studio_quota', {
        p_staff_id: publisherStaff.id,
        p_est_input_tokens: 10,
        p_est_input_cost_micros: 1,
        p_staff_req_limit: 3,
      }),
      adapter.rpc('cms_reserve_ai_studio_quota', {
        p_staff_id: publisherStaff.id,
        p_est_input_tokens: 10,
        p_est_input_cost_micros: 1,
        p_staff_req_limit: 3,
      }),
      adapter.rpc('cms_reserve_ai_studio_quota', {
        p_staff_id: publisherStaff.id,
        p_est_input_tokens: 10,
        p_est_input_cost_micros: 1,
        p_staff_req_limit: 3,
      }),
    ]);
    const allowedCount = concurrentReserves.filter((r) => r.data[0]?.allowed === true).length;
    const deniedCount = concurrentReserves.filter(
      (r) => r.data[0]?.allowed === false && r.data[0]?.denial_reason === 'STAFF_REQUEST_LIMIT'
    ).length;
    assert.equal(allowedCount, 2);
    assert.equal(deniedCount, 1);

    // Live key requirement without key -> 503
    const prevAiKey = process.env.STROVYN_AI_API_KEY;
    const prevGeminiKey = process.env.GEMINI_API_KEY;
    try {
      delete process.env.STROVYN_AI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      assert.throws(
        () => aiMod.resolveAiProviderAdapter({ requireLiveKey: true }),
        (err) => err.status === 503
      );
    } finally {
      if (prevAiKey !== undefined) process.env.STROVYN_AI_API_KEY = prevAiKey;
      if (prevGeminiKey !== undefined) process.env.GEMINI_API_KEY = prevGeminiKey;
    }

    // Timeout handling -> 504, AND reserved quota capacity is released while failed_requests increments
    await assert.rejects(
      () =>
        aiMod.executeAiStudioGeneration(
          editorStaff.id,
          {
            mode: 'seo_assistant',
            currentTitle: 'Timeout Probe',
            currentContentOrSummary: 'Verify bounded request timeout handling safely.',
            primaryKeyword: 'timeout probe',
            locationOrService: null,
          },
          {
            clientOverride: adapter,
            timeoutMs: 25,
            providerOverride: {
              name: 'custom_mock',
              model: 'mock-timeout',
              generateStructured: () => new Promise((resolve) => setTimeout(() => resolve({}), 200)),
            },
          }
        ),
      (err) => err.status === 504
    );

    const editorUsageAfterFail = (
      await db.query(
        `SELECT request_count, reserved_requests, succeeded_requests, failed_requests, estimated_tokens, estimated_cost_micros
         FROM public.ai_studio_usage_daily
         WHERE scope_key = $1`,
        [`staff:${editorStaff.id}`]
      )
    ).rows[0];
    assert.equal(editorUsageAfterFail.request_count, 0);
    assert.equal(editorUsageAfterFail.reserved_requests, 0);
    assert.equal(editorUsageAfterFail.succeeded_requests, 0);
    assert.equal(editorUsageAfterFail.failed_requests, 1);
    assert.equal(Number(editorUsageAfterFail.estimated_tokens), 0);
    assert.equal(Number(editorUsageAfterFail.estimated_cost_micros), 0);

    // Durable quota DB failure / missing RPC must fail closed (503), never fall back to memory
    const brokenQuotaClient = {
      rpc: async () => ({
        data: null,
        error: { code: '42883', message: 'Could not find the function cms_reserve_ai_studio_quota' },
      }),
    };
    await assert.rejects(
      () =>
        aiMod.executeAiStudioGeneration(
          editorStaff.id,
          {
            mode: 'seo_assistant',
            currentTitle: 'Broken Quota DB Probe',
            currentContentOrSummary: 'Ensure missing quota RPC fails closed with 503.',
            primaryKeyword: 'fail closed',
            locationOrService: null,
          },
          { clientOverride: brokenQuotaClient }
        ),
      (err) => err.status === 503
    );

    // -------------------------------------------------------------------------
    // 7. Interrupted Scheduled Job Lease Recovery & Claim RPC Fail-Closed Check
    // -------------------------------------------------------------------------
    // Move failDraft retry window to past so it's eligible again
    await db.query(
      `UPDATE public.articles SET next_retry_at = NOW() - INTERVAL '1 minute' WHERE id = $1`,
      [failDraft.id]
    );
    // Simulate Worker 1 claiming the row and crashing before finishing
    const crashClaim = await adapter.rpc('cms_claim_due_scheduled_articles', {
      p_limit: 10,
      p_lease_seconds: 60,
    });
    assert.equal(crashClaim.error, null);
    assert.equal(crashClaim.data.length, 1);

    // While lease is active, a concurrent worker sees 0 claimable rows
    const lockedOutRun = await schedMod.runScheduledArticlePublisher({ limit: 10 }, adapter);
    assert.equal(lockedOutRun.claimed, 0);

    // Simulate lease expiry -> next worker recovers and publishes the interrupted article
    await db.query(
      `UPDATE public.article_publish_claims SET lease_expires_at = NOW() - INTERVAL '5 seconds' WHERE article_id = $1`,
      [failDraft.id]
    );
    const recoveredRun = await schedMod.runScheduledArticlePublisher({ limit: 10 }, adapter);
    assert.equal(recoveredRun.claimed, 1);
    assert.equal(recoveredRun.published, 1);

    // Claim RPC unavailability must fail closed (never scan articles without lock)
    await assert.rejects(
      () =>
        schedMod.runScheduledArticlePublisher(
          { limit: 10 },
          {
            rpc: async () => ({ data: null, error: { message: 'claim RPC unavailable' } }),
          }
        ),
      /claim RPC unavailable/
    );

    console.log('  [OK] Durable DB AI quotas, failure release, lease recovery, and fail-closed guards verified.');
    console.log('=== Business CMS Phase G Suite PASSED ===');
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
