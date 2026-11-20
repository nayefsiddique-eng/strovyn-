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

function createPgliteCmsClient(db) {
  function sanitizeCol(name) {
    assert.match(name, /^[a-zA-Z_][a-zA-Z0-9_]*$/);
    return `"${name}"`;
  }

  class QueryBuilder {
    constructor(table) {
      this.table = table;
      this.selectCols = '*';
      this.countMode = null;
      this.filters = [];
      this.orFilters = null;
      this.orderBy = null;
      this.rangeWindow = null;
      this.expectSingle = false;
      this.expectMaybeSingle = false;
    }

    select(cols = '*', opts = {}) {
      this.selectCols = cols;
      this.countMode = opts?.count ?? null;
      return this;
    }

    eq(col, val) {
      this.filters.push({ op: '=', col, val });
      return this;
    }

    or(expr) {
      this.orFilters = expr;
      return this;
    }

    order(col, { ascending = true } = {}) {
      this.orderBy = { col, dir: ascending ? 'ASC' : 'DESC' };
      return this;
    }

    range(from, to) {
      this.rangeWindow = { from, to };
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
      const values = [];
      const clauses = [];
      for (const f of this.filters) {
        values.push(f.val);
        clauses.push(`${sanitizeCol(f.col)} = $${values.length}`);
      }
      if (this.orFilters) {
        const orParts = [];
        for (const seg of this.orFilters.split(',')) {
          const m = seg.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)\.ilike\.%(.*)%$/);
          if (m) {
            values.push(`%${m[2]}%`);
            orParts.push(`${sanitizeCol(m[1])} ILIKE $${values.length}`);
          }
        }
        if (orParts.length > 0) {
          clauses.push(`(${orParts.join(' OR ')})`);
        }
      }
      const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
      const orderSql = this.orderBy
        ? `ORDER BY ${sanitizeCol(this.orderBy.col)} ${this.orderBy.dir}`
        : '';
      let limitSql = '';
      if (this.rangeWindow) {
        const limit = this.rangeWindow.to - this.rangeWindow.from + 1;
        limitSql = `LIMIT ${Number(limit)} OFFSET ${Number(this.rangeWindow.from)}`;
      }

      const tableRef = `public.${sanitizeCol(this.table)}`;
      const res = await db.query(
        `SELECT ${this.selectCols} FROM ${tableRef} ${whereSql} ${orderSql} ${limitSql}`,
        values
      );

      let totalCount = null;
      if (this.countMode === 'exact') {
        const countRes = await db.query(
          `SELECT COUNT(*)::int AS c FROM ${tableRef} ${whereSql}`,
          values
        );
        totalCount = countRes.rows[0].c;
      }

      if (this.expectSingle) {
        return { data: res.rows[0] ?? null, error: res.rows.length === 1 ? null : { message: 'Not found' } };
      }
      if (this.expectMaybeSingle) {
        return { data: res.rows[0] ?? null, error: null };
      }
      return { data: res.rows, count: totalCount, error: null };
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

async function initDb() {
  const db = new PGlite();
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS storage;
    CREATE TABLE IF NOT EXISTS storage.buckets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      public BOOLEAN NOT NULL DEFAULT FALSE,
      file_size_limit BIGINT,
      allowed_mime_types TEXT[]
    );
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN NOSUPERUSER; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN NOSUPERUSER; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN NOSUPERUSER BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  `);
  for (const file of MIGRATION_FILES) {
    await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
  }
  return db;
}

async function run() {
  console.log('=== CMS-3 Stage 1 Staff Auth, Queue RBAC & Navigation Suite ===');

  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const prevSvc = process.env.SUPABASE_SERVICE_ROLE_KEY;

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://strovyntestproject.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.test';

  const db = await initDb();
  const serviceClient = createPgliteCmsClient(db);

  // Seed test staff profiles inside PGlite only (editor, publisher, admin, inactive)
  const identities = {
    editor: { id: '10000000-0000-4000-8000-000000000001', email: 'editor@strovyn.invalid' },
    publisher: { id: '10000000-0000-4000-8000-000000000002', email: 'publisher@strovyn.invalid' },
    admin: { id: '10000000-0000-4000-8000-000000000003', email: 'admin@strovyn.invalid' },
    inactive: { id: '10000000-0000-4000-8000-000000000004', email: 'inactive@strovyn.invalid' },
    outsider: { id: '10000000-0000-4000-8000-000000000099', email: 'outsider@strovyn.invalid' },
  };

  await db.query(
    `INSERT INTO public.staff_users (auth_user_id, email, full_name, role, is_active) VALUES
     ($1, $2, 'Test Editor', 'editor', TRUE),
     ($3, $4, 'Test Publisher', 'publisher', TRUE),
     ($5, $6, 'Test Admin', 'admin', TRUE),
     ($7, $8, 'Deactivated Staff', 'publisher', FALSE)`,
    [
      identities.editor.id,
      identities.editor.email,
      identities.publisher.id,
      identities.publisher.email,
      identities.admin.id,
      identities.admin.email,
      identities.inactive.id,
      identities.inactive.email,
    ]
  );

  let currentAuthUser = null;
  let signOutCalled = false;

  const mockModules = {
    'server-only': {},
    '@/lib/supabase/serviceRole': {
      isCmsSupabaseConfigured: () => true,
      createServiceRoleClient: () => serviceClient,
    },
    '@/lib/supabase/server': {
      async createClient() {
        return {
          auth: {
            async getUser() {
              return { data: { user: currentAuthUser }, error: null };
            },
            async signOut() {
              signOutCalled = true;
              currentAuthUser = null;
              return { error: null };
            },
          },
        };
      },
    },
  };

  try {
    const stage1Access = loadProjectTsModule('src/lib/cms/stage1Access.ts', mockModules);
    const sessionRoute = loadProjectTsModule('src/app/api/admin/insights/session/route.ts', mockModules);
    const insightsRoute = loadProjectTsModule('src/app/api/admin/insights/route.ts', mockModules);

    // ------------------------------------------------------------------
    // 1. Safe Redirect Sanitization
    // ------------------------------------------------------------------
    assert.equal(stage1Access.sanitizeAdminRedirectPath('/admin/insights'), '/admin/insights');
    assert.equal(
      stage1Access.sanitizeAdminRedirectPath('/admin/insights/articles/11111111-1111-4111-8111-111111111111'),
      '/admin/insights/articles/11111111-1111-4111-8111-111111111111'
    );
    for (const unsafe of [
      'https://evil.example/admin/insights',
      '//evil.example/admin/insights',
      '/admin/photos',
      '/insights',
      '/admin/insights\\..\\photos',
      'javascript:alert(1)',
      '/admin/insights\nLocation: evil',
    ]) {
      assert.equal(
        stage1Access.sanitizeAdminRedirectPath(unsafe),
        '/admin/insights',
        `Unsafe redirect must fall back safely: ${unsafe}`
      );
    }

    // ------------------------------------------------------------------
    // 2. Auth States: Unauthenticated (401), Non-Staff (403), Inactive (403)
    // ------------------------------------------------------------------
    currentAuthUser = null;
    const unauthSessionRes = await sessionRoute.GET();
    assert.equal(unauthSessionRes.status, 401);
    const unauthSessionJson = await unauthSessionRes.json();
    assert.equal(unauthSessionJson.code, 'UNAUTHENTICATED');

    const unauthQueueRes = await insightsRoute.GET(new Request('https://strovyn.com/api/admin/insights'));
    assert.equal(unauthQueueRes.status, 401);

    currentAuthUser = identities.outsider;
    const outsiderSessionRes = await sessionRoute.GET();
    assert.equal(outsiderSessionRes.status, 403);
    assert.equal((await outsiderSessionRes.json()).code, 'STAFF_NOT_REGISTERED');
    const outsiderQueueRes = await insightsRoute.GET(new Request('https://strovyn.com/api/admin/insights'));
    assert.equal(outsiderQueueRes.status, 403);

    currentAuthUser = identities.inactive;
    const inactiveSessionRes = await sessionRoute.GET();
    assert.equal(inactiveSessionRes.status, 403);
    assert.equal((await inactiveSessionRes.json()).code, 'STAFF_INACTIVE');
    const inactiveQueueRes = await insightsRoute.GET(new Request('https://strovyn.com/api/admin/insights'));
    assert.equal(inactiveQueueRes.status, 403);

    // ------------------------------------------------------------------
    // 3. Authorized Staff Queue Loading, Filtering, Pagination & Sign-Out
    // ------------------------------------------------------------------
    currentAuthUser = identities.editor;
    const editorSess = await sessionRoute.GET();
    assert.equal(editorSess.status, 200);
    assert.match(editorSess.headers.get('cache-control') || '', /no-store/);
    assert.match(editorSess.headers.get('x-robots-tag') || '', /noindex/);
    const editorSessJson = await editorSess.json();
    assert.equal(editorSessJson.staff.role, 'editor');

    const editorListRes = await insightsRoute.GET(
      new Request('https://strovyn.com/api/admin/insights?page=1&pageSize=3')
    );
    assert.equal(editorListRes.status, 200);
    const editorListJson = await editorListRes.json();
    assert.equal(editorListJson.items.length, 3);
    assert.equal(editorListJson.pagination.total, 7);
    assert.equal(editorListJson.pagination.totalPages, 3);
    // Editor projection omits publisher-only audit metadata
    assert.equal(editorListJson.items[0].published_by, undefined);

    const searchRes = await insightsRoute.GET(
      new Request('https://strovyn.com/api/admin/insights?search=Silicate')
    );
    const searchJson = await searchRes.json();
    assert.equal(searchJson.items.length, 1);
    assert.match(searchJson.items[0].slug, /potassium-silicate/);

    currentAuthUser = identities.publisher;
    const pubListRes = await insightsRoute.GET(
      new Request('https://strovyn.com/api/admin/insights?status=published')
    );
    assert.equal(pubListRes.status, 200);
    const pubListJson = await pubListRes.json();
    assert.ok(pubListJson.items.length >= 1);
    assert.ok('created_by' in pubListJson.items[0], 'Publisher projection includes editorial governance metadata');

    // DELETE session requires valid same-origin CSRF
    const badCsrfLogout = await sessionRoute.DELETE({
      headers: new Headers({ host: 'strovyn.com', origin: 'https://evil.com' }),
    });
    assert.equal(badCsrfLogout.status, 403);

    const goodLogout = await sessionRoute.DELETE({
      headers: new Headers({ host: 'strovyn.com', origin: 'https://strovyn.com' }),
    });
    assert.equal(goodLogout.status, 200);
    assert.equal(signOutCalled, true);

    // ------------------------------------------------------------------
    // 4. Role-Specific Action Model Matrix Assertions
    // ------------------------------------------------------------------
    const editorDraft = stage1Access.getRoleQueueActionModel('editor', 'draft');
    assert.equal(editorDraft.isEditableByRole, true);
    assert.deepEqual(
      editorDraft.permittedTransitions.map((t) => t.toStatus),
      ['review']
    );

    const editorReview = stage1Access.getRoleQueueActionModel('editor', 'review');
    assert.equal(editorReview.isEditableByRole, true);
    assert.deepEqual(
      editorReview.permittedTransitions.map((t) => t.toStatus),
      ['draft']
    );

    for (const lockedStatus of ['approved', 'published', 'archived']) {
      const m = stage1Access.getRoleQueueActionModel('editor', lockedStatus);
      assert.equal(m.isEditableByRole, false);
      assert.equal(m.permittedTransitions.length, 0);
      assert.ok(m.lockNotice);
    }

    const pubApproved = stage1Access.getRoleQueueActionModel('publisher', 'approved');
    assert.equal(pubApproved.permittedTransitions.some((t) => t.toStatus === 'published'), true);
    assert.equal(
      pubApproved.permittedTransitions.some((t) => t.toStatus === 'scheduled'),
      false,
      'Scheduling must remain disabled/deferred in Stage 1 / CMS-3'
    );

    // ------------------------------------------------------------------
    // 5. Client Boundary & Route Structure Checks
    // ------------------------------------------------------------------
    const clientFiles = [
      'src/lib/cms/stage1Access.ts',
      'src/components/cms/StaffAuthGateCards.tsx',
      'src/components/cms/AdminInsightsQueue.tsx',
    ];
    for (const rel of clientFiles) {
      const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      assert.equal(src.includes('serviceRole'), false, `${rel} must not reference serviceRole`);
      assert.equal(src.includes('server-only'), false, `${rel} must not import server-only`);
      assert.equal(src.includes('SUPABASE_SERVICE_ROLE_KEY'), false);
    }

    const articleShellSrc = fs.readFileSync(
      path.join(REPO_ROOT, 'src/app/admin/insights/articles/[id]/page.tsx'),
      'utf8'
    );
    const authIdx = articleShellSrc.indexOf('resolveAuthenticatedStaff()');
    const fetchIdx = articleShellSrc.indexOf('getEditorialArticleById(');
    assert.ok(authIdx !== -1 && fetchIdx !== -1 && authIdx < fetchIdx, 'Auth must run before article lookup');

    console.log('ALL CMS-3 STAGE 1 TESTS PASSED');
  } finally {
    await db.close();
    if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    if (prevAnon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevAnon;
    if (prevSvc === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevSvc;
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
