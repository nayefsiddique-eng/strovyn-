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
      this.selectCols = '*';
      this.orders = [];
      this.expectSingle = false;
      this.expectMaybeSingle = false;
    }

    select(cols = '*') {
      if (this.op !== 'insert' && this.op !== 'update') {
        this.op = 'select';
      }
      this.selectCols = cols;
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
      this.orders.push(`${sanitizeCol(col)} ${ascending ? 'ASC' : 'DESC'}`);
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
          const values = cols.map((c) => this.payload[c]);
          const ph = values.map((_, i) => `$${i + 1}`);
          const sql = `INSERT INTO ${tableRef} (${cols.map(sanitizeCol).join(', ')}) VALUES (${ph.join(', ')}) RETURNING *`;
          const res = await db.query(sql, values);
          const rows = res.rows.map(normalizeRow);
          return { data: this.expectSingle ? rows[0] : rows, error: null };
        }

        const params = [];
        const buildWhere = () => {
          if (this.filters.length === 0) return '';
          const parts = this.filters.map((f) => {
            params.push(f.val);
            return `${sanitizeCol(f.col)} = $${params.length}`;
          });
          return ` WHERE ${parts.join(' AND ')}`;
        };

        if (this.op === 'update') {
          const cols = Object.keys(this.payload);
          const setParts = cols.map((c) => {
            params.push(this.payload[c]);
            return `${sanitizeCol(c)} = $${params.length}`;
          });
          const whereSql = buildWhere();
          const sql = `UPDATE ${tableRef} SET ${setParts.join(', ')}${whereSql} RETURNING *`;
          const res = await db.query(sql, params);
          const rows = res.rows.map(normalizeRow);
          if (this.expectMaybeSingle) {
            return { data: rows[0] ?? null, error: null };
          }
          return { data: rows, error: null };
        }

        const whereSql = buildWhere();
        const orderSql = this.orders.length > 0 ? ` ORDER BY ${this.orders.join(', ')}` : '';
        const sql = `SELECT * FROM ${tableRef}${whereSql}${orderSql}`;
        const res = await db.query(sql, params);
        const rows = res.rows.map(normalizeRow);
        if (this.expectSingle) {
          return { data: rows[0] ?? null, error: rows[0] ? null : { message: 'Not found' } };
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
  };
}

async function main() {
  console.log('=== Business CMS Phase D Careers & Vacancies Management Suite ===');
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

    // Re-run Migration 013 to verify idempotency
    await db.exec(
      fs.readFileSync(
        path.join(MIGRATIONS_DIR, '20261121040000_business_cms_careers_foundation.sql'),
        'utf8'
      )
    );

    const adapter = createPgliteAdapter(db);
    const cache = new Map();
    const stubs = {
      'server-only': {},
      'next/cache': { revalidatePath() {} },
      '@/lib/supabase/serviceRole': {
        createServiceRoleClient: () => adapter,
      },
      '@/lib/supabase/public': {
        createPublicSupabaseClient: () => adapter,
        isPublicSupabaseConfigured: () => true,
      },
    };

    const rbacMod = loadProjectTsModule('src/lib/cms/rbac.ts', stubs, cache);
    const navMod = loadProjectTsModule('src/lib/cms/adminNavigation.ts', stubs, cache);
    const serviceMod = loadProjectTsModule('src/lib/cms/careersService.ts', stubs, cache);
    const pubMod = loadProjectTsModule('src/lib/cms/publicCareers.ts', stubs, cache);

    // 1. RBAC & Navigation verification
    assert.equal(rbacMod.hasEditorialPermission('editor', 'career:read'), true);
    assert.equal(rbacMod.hasEditorialPermission('editor', 'career:create_draft'), true);
    assert.equal(rbacMod.hasEditorialPermission('editor', 'career:edit_draft'), true);
    assert.equal(rbacMod.hasEditorialPermission('editor', 'career:edit_published'), false);
    assert.equal(rbacMod.hasEditorialPermission('editor', 'career:publish'), false);
    assert.equal(rbacMod.hasEditorialPermission('editor', 'career:toggle_open'), false);
    assert.equal(rbacMod.hasEditorialPermission('editor', 'career:reorder'), false);

    assert.equal(rbacMod.hasEditorialPermission('publisher', 'career:publish'), true);
    assert.equal(rbacMod.hasEditorialPermission('publisher', 'career:toggle_open'), true);
    assert.equal(rbacMod.hasEditorialPermission('publisher', 'career:reorder'), true);
    assert.equal(rbacMod.hasEditorialPermission('admin', 'career:publish'), true);

    const editorNav = navMod.getAdminNavigationForRole('editor');
    const careersNav = editorNav.find((i) => i.id === 'careers');
    assert.ok(careersNav);
    assert.equal(careersNav.href, '/admin/careers');
    assert.equal(careersNav.status, 'live');
    console.log('  [OK] Staff RBAC and /admin/careers navigation verified.');

    // Seed disposable staff in PGlite
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
    const adminStaff = {
      id: '55555555-5555-4555-8555-555555555555',
      auth_user_id: '66666666-6666-4666-8666-666666666666',
      email: 'admin@strovyn.invalid',
      full_name: 'Admin Staff',
      role: 'admin',
      is_active: true,
    };
    await db.query(
      `INSERT INTO public.staff_users (id, auth_user_id, email, full_name, role, is_active)
       VALUES ($1,$2,$3,$4,$5,true),($6,$7,$8,$9,$10,true),($11,$12,$13,$14,$15,true)`,
      [
        editorStaff.id, editorStaff.auth_user_id, editorStaff.email, editorStaff.full_name, editorStaff.role,
        publisherStaff.id, publisherStaff.auth_user_id, publisherStaff.email, publisherStaff.full_name, publisherStaff.role,
        adminStaff.id, adminStaff.auth_user_id, adminStaff.email, adminStaff.full_name, adminStaff.role,
      ]
    );

    // 2. Draft creation, Duplicate slug handling & Editor permission boundaries
    const futureDeadline = new Date(Date.now() + 14 * 86400 * 1000).toISOString();
    const draft1 = await serviceMod.createVacancyDraft(
      editorStaff,
      {
        title: 'Senior Architectural Finisher',
        department: 'Heritage & Residential',
        employment_type: 'Full-time',
        location: 'Adelaide, South Australia',
        description: 'Lead precision surface preparation and mineral coating application across heritage residences.',
        requirements: 'Minimum 5 years architectural finishing experience\nValid White Card and SA driver licence',
        application_deadline: futureDeadline,
      },
      adapter
    );
    assert.equal(draft1.slug, 'senior-architectural-finisher');
    assert.equal(draft1.publication_status, 'draft');
    assert.equal(draft1.is_open, true);

    // Duplicate slug rejected with 409 CONFLICT
    await assert.rejects(
      () =>
        serviceMod.createVacancyDraft(
          editorStaff,
          {
            title: 'Senior Architectural Finisher',
            description: 'Duplicate slug attempt that must be rejected with 409.',
          },
          adapter
        ),
      (err) => err.status === 409 && err.code === 'CONFLICT'
    );

    // Editor cannot publish or toggle open/close
    await assert.rejects(
      () =>
        serviceMod.setVacancyPublicationStatus(
          editorStaff,
          draft1.id,
          {
            expected_updated_at: draft1.updated_at,
            publication_status: 'published',
            confirmed: true,
          },
          adapter
        ),
      (err) => err.status === 403 && err.code === 'FORBIDDEN'
    );
    await assert.rejects(
      () =>
        serviceMod.setVacancyOpenState(
          editorStaff,
          draft1.id,
          {
            expected_updated_at: draft1.updated_at,
            is_open: false,
          },
          adapter
        ),
      (err) => err.status === 403 && err.code === 'FORBIDDEN'
    );
    console.log('  [OK] Draft creation, duplicate slug 409, and Editor role boundaries verified.');

    // 3. Optimistic concurrency conflict (409)
    await assert.rejects(
      () =>
        serviceMod.updateVacancyRecord(
          editorStaff,
          draft1.id,
          {
            expected_updated_at: '2020-01-01T00:00:00.000Z',
            location: 'Stale Location',
          },
          adapter
        ),
      (err) => err.status === 409 && err.code === 'CONFLICT'
    );
    console.log('  [OK] Optimistic concurrency conflict (409) verified.');

    // 4. Draft privacy & application rejection while draft
    await assert.rejects(
      () => serviceMod.validateVacancyForPublicApplication(draft1.id, adapter),
      (err) => err.status === 422
    );
    await db.exec('SET ROLE anon;');
    const anonDraftRows = await db.query(`SELECT id FROM public.job_openings`);
    assert.equal(anonDraftRows.rows.length, 0);
    await db.exec('RESET ROLE;');
    console.log('  [OK] Draft privacy under anon RLS and application block verified.');

    // 5. Publication confirmation & Publisher publish
    await assert.rejects(
      () =>
        serviceMod.setVacancyPublicationStatus(
          publisherStaff,
          draft1.id,
          {
            expected_updated_at: draft1.updated_at,
            publication_status: 'published',
            confirmed: false,
          },
          adapter
        ),
      (err) => err.status === 422
    );

    const published1 = await serviceMod.setVacancyPublicationStatus(
      publisherStaff,
      draft1.id,
      {
        expected_updated_at: draft1.updated_at,
        publication_status: 'published',
        confirmed: true,
      },
      adapter
    );
    assert.equal(published1.publication_status, 'published');
    assert.ok(published1.published_at);

    // Editor cannot edit a published vacancy
    await assert.rejects(
      () =>
        serviceMod.updateVacancyRecord(
          editorStaff,
          published1.id,
          {
            expected_updated_at: published1.updated_at,
            location: 'Unauthorized Editor Edit',
          },
          adapter
        ),
      (err) => err.status === 403 && err.code === 'FORBIDDEN'
    );

    // Public anon RLS & getPublicOpenVacancies see the published open vacancy
    await db.exec('SET ROLE anon;');
    const anonPubRows = await db.query(`SELECT id, slug FROM public.job_openings`);
    assert.equal(anonPubRows.rows.length, 1);
    assert.equal(anonPubRows.rows[0].id, published1.id);
    await assert.rejects(() =>
      db.query(`DELETE FROM public.job_openings WHERE id = $1`, [published1.id])
    );
    await db.exec('RESET ROLE;');

    const publicOpenList = await pubMod.getPublicOpenVacancies(adapter);
    assert.equal(publicOpenList.length, 1);
    assert.equal(publicOpenList[0].id, published1.id);
    assert.equal(publicOpenList[0].requirements.length, 2);

    // Submitting a candidate application via atomic RPC succeeds for published & open vacancy
    const appRes = await db.query(
      `SELECT * FROM public.cms_submit_application_with_attachment(
        gen_random_uuid(),
        'L. Artisan',
        'artisan@example.com',
        '+61 400 111 222',
        'Experienced Level 5 finisher',
        'pending',
        NULL,
        NULL,
        'idem-phase-d-open-1',
        $1::uuid
      )`,
      [published1.id]
    );
    assert.ok(appRes.rows[0].record_id);
    console.log('  [OK] Vacancy publication, public RLS visibility, and linked application submission verified.');

    // 6. Close Vacancy workflow & server/DB rejection of applications after closure
    const closed1 = await serviceMod.setVacancyOpenState(
      publisherStaff,
      published1.id,
      {
        expected_updated_at: published1.updated_at,
        is_open: false,
      },
      adapter
    );
    assert.equal(closed1.is_open, false);
    assert.ok(closed1.closed_at);

    // Closed vacancy is immediately excluded from anon RLS and getPublicOpenVacancies
    await db.exec('SET ROLE anon;');
    const anonClosedRows = await db.query(`SELECT id FROM public.job_openings`);
    assert.equal(anonClosedRows.rows.length, 0);
    await db.exec('RESET ROLE;');
    assert.equal((await pubMod.getPublicOpenVacancies(adapter)).length, 0);

    // Closed vacancy rejects applications at both service layer (422) and DB RPC (VACANCY_CLOSED)
    await assert.rejects(
      () => serviceMod.validateVacancyForPublicApplication(closed1.id, adapter),
      (err) => err.status === 422
    );
    await assert.rejects(
      () =>
        db.query(
          `SELECT * FROM public.cms_submit_application_with_attachment(
            gen_random_uuid(),
            'Late Applicant',
            'late@example.com',
            '+61 400 333 444',
            'Cover letter',
            'pending',
            NULL,
            NULL,
            'idem-phase-d-closed-1',
            $1::uuid
          )`,
          [closed1.id]
        ),
      /VACANCY_CLOSED/
    );
    console.log('  [OK] Vacancy closure immediately blocks public display and rejects new applications.');

    // 7. Expired deadline enforcement
    const reopened1 = await serviceMod.setVacancyOpenState(
      adminStaff,
      closed1.id,
      {
        expected_updated_at: closed1.updated_at,
        is_open: true,
      },
      adapter
    );
    const pastDeadline = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const expired1 = await serviceMod.updateVacancyRecord(
      adminStaff,
      reopened1.id,
      {
        expected_updated_at: reopened1.updated_at,
        application_deadline: pastDeadline,
      },
      adapter
    );

    // Expired vacancy is excluded from anon RLS, getPublicOpenVacancies, and rejects applications
    await db.exec('SET ROLE anon;');
    const anonExpiredRows = await db.query(`SELECT id FROM public.job_openings`);
    assert.equal(anonExpiredRows.rows.length, 0);
    await db.exec('RESET ROLE;');
    assert.equal((await pubMod.getPublicOpenVacancies(adapter)).length, 0);

    await assert.rejects(
      () => serviceMod.validateVacancyForPublicApplication(expired1.id, adapter),
      (err) => err.status === 422
    );
    await assert.rejects(
      () =>
        db.query(
          `SELECT * FROM public.cms_submit_application_with_attachment(
            gen_random_uuid(),
            'Past Deadline Applicant',
            'expired@example.com',
            '+61 400 555 666',
            'Cover letter',
            'pending',
            NULL,
            NULL,
            'idem-phase-d-expired-1',
            $1::uuid
          )`,
          [expired1.id]
        ),
      /VACANCY_DEADLINE_PASSED/
    );
    console.log('  [OK] Expired deadline enforcement verified across RLS, service, and atomic RPC.');

    // 8. Public /careers component cutover & empty-state verification
    const careersPageSource = fs.readFileSync(
      path.join(REPO_ROOT, 'src/app/careers/page.tsx'),
      'utf8'
    );
    const careersClientSource = fs.readFileSync(
      path.join(REPO_ROOT, 'src/components/careers/PublicCareersClient.tsx'),
      'utf8'
    );
    assert.equal(careersPageSource.includes('OPENINGS'), false);
    assert.equal(careersPageSource.includes('Cabinetry & Fine Joinery Sprayer'), false);
    assert.equal(careersClientSource.includes('careers-empty-state'), true);
    console.log('  [OK] Public /careers live cutover and empty state verified.');

    console.log('ALL BUSINESS CMS PHASE D CAREERS & VACANCIES TESTS PASSED');
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error('Phase D test failure:', err);
  process.exit(1);
});
