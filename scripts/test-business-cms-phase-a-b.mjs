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

  class QueryBuilder {
    constructor(table) {
      this.table = table;
      this.op = 'select';
      this.payload = null;
      this.filters = [];
      this.selectCols = '*';
      this.countMode = false;
      this.headOnly = false;
      this.orderBy = null;
      this.expectSingle = false;
      this.expectMaybeSingle = false;
    }

    select(cols = '*', opts = {}) {
      if (this.op !== 'insert' && this.op !== 'update') {
        this.op = 'select';
      }
      this.selectCols = cols;
      this.countMode = Boolean(opts?.count);
      this.headOnly = Boolean(opts?.head);
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

    order(col, { ascending = true } = {}) {
      this.orderBy = { col, dir: ascending ? 'ASC' : 'DESC' };
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
      const tableRef = `public.${sanitizeCol(this.table)}`;
      try {
        if (this.op === 'insert') {
          const cols = Object.keys(this.payload);
          const values = cols.map((c) => serializeParam(this.payload[c]));
          const ph = values.map((_, i) => `$${i + 1}`);
          const sql = `INSERT INTO ${tableRef} (${cols.map(sanitizeCol).join(', ')}) VALUES (${ph.join(', ')}) RETURNING ${this.selectCols}`;
          const res = await db.query(sql, values);
          return {
            data: this.expectSingle || this.expectMaybeSingle ? res.rows[0] ?? null : res.rows,
            error: null,
          };
        }

        if (this.op === 'update') {
          const values = [];
          const sets = Object.entries(this.payload).map(([k, v]) => {
            values.push(serializeParam(v));
            return `${sanitizeCol(k)} = $${values.length}`;
          });
          const where = this.filters.map((f) => {
            values.push(f.val);
            return `${sanitizeCol(f.col)} = $${values.length}`;
          });
          const sql = `UPDATE ${tableRef} SET ${sets.join(', ')} WHERE ${where.join(' AND ')} RETURNING ${this.selectCols}`;
          const res = await db.query(sql, values);
          return {
            data: this.expectSingle || this.expectMaybeSingle ? res.rows[0] ?? null : res.rows,
            error: null,
          };
        }

        const values = [];
        const where = this.filters.map((f) => {
          values.push(f.val);
          return `${sanitizeCol(f.col)} = $${values.length}`;
        });
        const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
        if (this.countMode && this.headOnly) {
          const res = await db.query(`SELECT COUNT(*)::int AS c FROM ${tableRef} ${whereSql}`, values);
          return { data: null, count: res.rows[0]?.c ?? 0, error: null };
        }
        const orderSql = this.orderBy
          ? `ORDER BY ${sanitizeCol(this.orderBy.col)} ${this.orderBy.dir}`
          : '';
        const res = await db.query(
          `SELECT ${this.selectCols} FROM ${tableRef} ${whereSql} ${orderSql}`,
          values
        );
        return {
          data: this.expectSingle || this.expectMaybeSingle ? res.rows[0] ?? null : res.rows,
          count: res.rows.length,
          error: null,
        };
      } catch (err) {
        return { data: null, count: null, error: { code: err.code, message: err.message } };
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
  };
}

async function run() {
  console.log('=== Business CMS Phase A & Phase B Foundation Suite ===');
  const db = new PGlite();

  try {
    await db.exec(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
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

    // Confirm migration 011 idempotency
    await db.exec(
      fs.readFileSync(path.join(MIGRATIONS_DIR, '20261121020000_business_cms_projects_foundation.sql'), 'utf8')
    );

    const adapter = createPgliteAdapter(db);
    const cache = new Map();
    const stubs = {
      'server-only': {},
      'next/cache': { revalidatePath() {} },
      '@/lib/supabase/serviceRole': {
        createServiceRoleClient: () => adapter,
        isServiceRoleConfigured: () => true,
        isSupabaseAnonConfigured: () => true,
        isCmsSupabaseConfigured: () => true,
      },
      '@/lib/projectPhotos': {
        getPhotoOverridesAsync: async () => ({}),
      },
    };

    const navMod = loadProjectTsModule('src/lib/cms/adminNavigation.ts', stubs, cache);
    const overviewMod = loadProjectTsModule('src/lib/cms/adminOverviewService.ts', stubs, cache);
    const projectsMod = loadProjectTsModule('src/lib/cms/projectsService.ts', stubs, cache);
    const rbacMod = loadProjectTsModule('src/lib/cms/rbac.ts', stubs, cache);

    // 1. Navigation & RBAC checks
    const editorNav = navMod.getAdminNavigationForRole('editor').map((i) => i.id);
    assert.deepEqual(editorNav, ['overview', 'articles', 'projects']);
    const adminNav = navMod.getAdminNavigationForRole('admin').map((i) => i.id);
    assert.equal(adminNav.length, 10);
    assert.equal(rbacMod.hasEditorialPermission('editor', 'project:read'), true);
    assert.equal(rbacMod.hasEditorialPermission('editor', 'project:write'), false);
    assert.equal(rbacMod.hasEditorialPermission('publisher', 'project:write'), true);
    assert.equal(rbacMod.hasEditorialPermission('admin', 'project:publish'), true);

    const editorStaff = {
      id: '11111111-1111-4111-8111-111111111111',
      auth_user_id: '22222222-2222-4222-8222-222222222222',
      email: 'ed@strovyn.invalid',
      full_name: 'Editor One',
      role: 'editor',
      is_active: true,
    };
    const pubStaff = {
      id: '33333333-3333-4333-8333-333333333333',
      auth_user_id: '44444444-4444-4444-8444-444444444444',
      email: 'pub@strovyn.invalid',
      full_name: 'Publisher One',
      role: 'publisher',
      is_active: true,
    };
    await db.query(
      `INSERT INTO public.staff_users (id, auth_user_id, email, full_name, role, is_active) VALUES ($1,$2,$3,$4,$5,$6),($7,$8,$9,$10,$11,$12)`,
      [
        editorStaff.id, editorStaff.auth_user_id, editorStaff.email, editorStaff.full_name, editorStaff.role, true,
        pubStaff.id, pubStaff.auth_user_id, pubStaff.email, pubStaff.full_name, pubStaff.role, true,
      ]
    );

    // 2. Overview operational counts
    const edOverview = await overviewMod.getAdminOverviewSnapshot(editorStaff, adapter);
    assert.equal(edOverview.articles.total, 7);
    assert.equal(edOverview.articles.published, 3);
    assert.equal(edOverview.submissions, null, 'Editor must not receive private submission counts');

    const pubOverview = await overviewMod.getAdminOverviewSnapshot(pubStaff, adapter);
    assert.ok(pubOverview.submissions !== null);
    assert.equal(pubOverview.pendingActions.some((a) => a.id === 'articles-in-review'), true);

    // 3. Projects foundation CRUD + optimistic concurrency + list merge
    const initialProjects = await projectsMod.listProjectsForAdmin(pubStaff, adapter);
    assert.ok(initialProjects.length >= 4);

    const created = await projectsMod.createProjectRecord(
      pubStaff,
      {
        title: 'Burnside Limestone Facade',
        category: 'Heritage Restoration',
        location: 'Burnside, SA',
        description: 'Breathable potassium silicate restoration across 1920s bluestone and lime mortar masonry.',
        status: 'Completed',
        visibility_status: 'draft',
        year: '2026',
      },
      adapter
    );
    assert.equal(created.slug, 'burnside-limestone-facade');

    await assert.rejects(
      () =>
        projectsMod.createProjectRecord(
          pubStaff,
          {
            title: 'Burnside Duplicate',
            slug: 'burnside-limestone-facade',
            category: 'Heritage Restoration',
            location: 'Burnside, SA',
            description: 'Duplicate slug test description exceeding twenty characters cleanly.',
          },
          adapter
        ),
      (err) => err.status === 409
    );

    await assert.rejects(
      () =>
        projectsMod.updateProjectRecord(
          pubStaff,
          created.id,
          {
            expected_updated_at: '2020-01-01T00:00:00.000Z',
            title: 'Stale Update',
          },
          adapter
        ),
      (err) => err.status === 409
    );

    const updated = await projectsMod.updateProjectRecord(
      pubStaff,
      created.id,
      {
        expected_updated_at: new Date(created.updated_at).toISOString(),
        title: 'Burnside Limestone Facade Restored',
        visibility_status: 'published',
      },
      adapter
    );
    assert.equal(updated.title, 'Burnside Limestone Facade Restored');

    // 4. Client component isolation check
    for (const rel of [
      'src/lib/cms/adminNavigation.ts',
      'src/lib/cms/projectValidators.ts',
      'src/components/cms/AdminWorkspaceShell.tsx',
      'src/components/cms/AdminOverviewDashboard.tsx',
      'src/components/cms/AdminProjectsWorkspace.tsx',
    ]) {
      const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      assert.equal(src.includes('serviceRole'), false, `${rel} must not reference serviceRole`);
      assert.equal(src.includes('server-only'), false, `${rel} must not import server-only`);
    }

    console.log('ALL BUSINESS CMS PHASE A & B FOUNDATION TESTS PASSED');
  } finally {
    await db.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
