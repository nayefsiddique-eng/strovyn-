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
      this.limitVal = null;
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
      this.filters.push({ type: 'eq', col, val });
      return this;
    }

    not(col, op, val) {
      this.filters.push({ type: 'not', col, op, val });
      return this;
    }

    order(col, { ascending = true } = {}) {
      this.orders.push(`${sanitizeCol(col)} ${ascending ? 'ASC' : 'DESC'}`);
      return this;
    }

    limit(n) {
      this.limitVal = Number(n);
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
            if (f.type === 'not' && f.op === 'is' && f.val === null) {
              return `${sanitizeCol(f.col)} IS NOT NULL`;
            }
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
        const limitSql = this.limitVal ? ` LIMIT ${this.limitVal}` : '';
        const sql = `SELECT * FROM ${tableRef}${whereSql}${orderSql}${limitSql}`;
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
  console.log('=== Business CMS Phase C Testimonials Management & Moderation Suite ===');
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

    // Re-run Migration 012 to verify idempotency
    await db.exec(
      fs.readFileSync(
        path.join(MIGRATIONS_DIR, '20261121030000_business_cms_testimonials_foundation.sql'),
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
    const serviceMod = loadProjectTsModule('src/lib/cms/testimonialsService.ts', stubs, cache);
    const pubMod = loadProjectTsModule('src/lib/cms/publicTestimonials.ts', stubs, cache);

    // 1. Staff RBAC & Navigation verification
    assert.equal(rbacMod.hasEditorialPermission('editor', 'testimonial:read'), true);
    assert.equal(rbacMod.hasEditorialPermission('editor', 'testimonial:create_draft'), true);
    assert.equal(rbacMod.hasEditorialPermission('editor', 'testimonial:edit_draft'), true);
    assert.equal(rbacMod.hasEditorialPermission('editor', 'testimonial:review'), false);
    assert.equal(rbacMod.hasEditorialPermission('editor', 'testimonial:publish'), false);
    assert.equal(rbacMod.hasEditorialPermission('editor', 'testimonial:feature'), false);
    assert.equal(rbacMod.hasEditorialPermission('editor', 'testimonial:promote_feedback'), false);

    assert.equal(rbacMod.hasEditorialPermission('publisher', 'testimonial:review'), true);
    assert.equal(rbacMod.hasEditorialPermission('publisher', 'testimonial:publish'), true);
    assert.equal(rbacMod.hasEditorialPermission('publisher', 'testimonial:feature'), true);
    assert.equal(rbacMod.hasEditorialPermission('publisher', 'testimonial:promote_feedback'), true);
    assert.equal(rbacMod.hasEditorialPermission('admin', 'testimonial:publish'), true);

    const editorNav = navMod.getAdminNavigationForRole('editor');
    const testimonialsNav = editorNav.find((i) => i.id === 'testimonials');
    assert.ok(testimonialsNav);
    assert.equal(testimonialsNav.href, '/admin/testimonials');
    assert.equal(testimonialsNav.status, 'live');
    console.log('  [OK] Staff RBAC and /admin/testimonials navigation verified.');

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

    // 2. Draft creation & Editor permission boundaries
    const draft1 = await serviceMod.createTestimonialDraft(
      editorStaff,
      {
        customer_name: 'A. Mitchell',
        content: 'Exceptional Level 5 plaster preparation and mineral finish accuracy.',
        customer_role: 'Principal Architect',
        location: 'North Adelaide, SA',
        project_reference: 'North Adelaide Villa',
        specification: 'Level 5 Skim & Silicate',
        rating: null,
        consent_verified: false,
      },
      adapter
    );
    assert.equal(draft1.moderation_status, 'draft');
    assert.equal(draft1.is_published, false);
    assert.equal(draft1.rating, null);
    assert.equal(draft1.consent_verified, false);

    // Editor cannot approve or publish
    await assert.rejects(
      () =>
        serviceMod.transitionTestimonialModeration(
          editorStaff,
          draft1.id,
          'approve',
          { expected_updated_at: draft1.updated_at },
          adapter
        ),
      (err) => err.status === 403 && err.code === 'FORBIDDEN'
    );
    await assert.rejects(
      () =>
        serviceMod.transitionTestimonialModeration(
          editorStaff,
          draft1.id,
          'publish',
          { expected_updated_at: draft1.updated_at, confirmed: true },
          adapter
        ),
      (err) => err.status === 403 && err.code === 'FORBIDDEN'
    );
    console.log('  [OK] Draft creation and Editor role boundary enforcement verified.');

    // 3. Stale update optimistic concurrency conflict (409)
    await assert.rejects(
      () =>
        serviceMod.updateTestimonialRecord(
          editorStaff,
          draft1.id,
          {
            expected_updated_at: '2020-01-01T00:00:00.000Z',
            location: 'Stale Update Location',
          },
          adapter
        ),
      (err) => err.status === 409 && err.code === 'CONFLICT'
    );
    console.log('  [OK] Optimistic concurrency conflict (409) verified.');

    // 4. Consent enforcement (Service + DB constraint)
    const submitted = await serviceMod.transitionTestimonialModeration(
      editorStaff,
      draft1.id,
      'submit_review',
      { expected_updated_at: draft1.updated_at },
      adapter
    );
    assert.equal(submitted.moderation_status, 'pending_review');

    const approvedUnverified = await serviceMod.transitionTestimonialModeration(
      publisherStaff,
      draft1.id,
      'approve',
      { expected_updated_at: submitted.updated_at },
      adapter
    );
    assert.equal(approvedUnverified.moderation_status, 'approved');
    assert.equal(approvedUnverified.is_published, false);

    // Attempt to publish without consent_verified -> rejected with 422
    await assert.rejects(
      () =>
        serviceMod.transitionTestimonialModeration(
          publisherStaff,
          draft1.id,
          'publish',
          { expected_updated_at: approvedUnverified.updated_at, confirmed: true },
          adapter
        ),
      (err) => err.status === 422
    );

    // Attempt direct SQL bypass of consent invariant -> rejected by CHECK constraint
    await assert.rejects(
      () =>
        db.query(
          `UPDATE public.testimonials SET is_published = TRUE, published_at = NOW() WHERE id = $1`,
          [draft1.id]
        ),
      /testimonials_published_requires_approval_consent_check/
    );
    console.log('  [OK] Service and PostgreSQL CHECK constraint consent enforcement verified.');

    // 5. Record verified consent evidence & publish
    const withConsent = await serviceMod.updateTestimonialRecord(
      publisherStaff,
      draft1.id,
      {
        expected_updated_at: approvedUnverified.updated_at,
        consent_verified: true,
        consent_evidence: 'Written client email authorization dated 2026-11-20',
      },
      adapter
    );
    assert.equal(withConsent.consent_verified, true);

    // Attempt to publish without explicit confirmation checkbox -> rejected with 422
    await assert.rejects(
      () =>
        serviceMod.transitionTestimonialModeration(
          publisherStaff,
          draft1.id,
          'publish',
          { expected_updated_at: withConsent.updated_at, confirmed: false },
          adapter
        ),
      (err) => err.status === 422
    );

    const published1 = await serviceMod.transitionTestimonialModeration(
      publisherStaff,
      draft1.id,
      'publish',
      { expected_updated_at: withConsent.updated_at, confirmed: true },
      adapter
    );
    assert.equal(published1.is_published, true);
    assert.ok(published1.published_at);

    // 6. Feedback-to-testimonial promotion & duplicate prevention
    const fbRes = await db.query(
      `INSERT INTO public.customer_feedback (name, email, project_reference, rating, message, status)
       VALUES ('R. Sterling', 'private.sterling@example.com', 'Unley Park Residence', 5, 'Meticulous joinery finishing and zero dust migration.', 'pending')
       RETURNING id`
    );
    const feedbackId = fbRes.rows[0].id;

    // Editor cannot list or promote customer_feedback
    await assert.rejects(
      () => serviceMod.listPromotableFeedback(editorStaff, adapter),
      (err) => err.status === 403
    );

    const promotableList = await serviceMod.listPromotableFeedback(publisherStaff, adapter);
    assert.equal(promotableList.length, 1);
    assert.equal('email' in promotableList[0], false);
    assert.equal(promotableList[0].already_promoted, false);

    const promotedDraft = await serviceMod.promoteFeedbackToTestimonialDraft(
      publisherStaff,
      { feedback_id: feedbackId, location: 'Unley Park, SA' },
      adapter
    );
    assert.equal(promotedDraft.moderation_status, 'draft');
    assert.equal(promotedDraft.is_published, false);
    assert.equal(promotedDraft.consent_verified, false);
    assert.equal(promotedDraft.source_feedback_id, feedbackId);

    // Duplicate promotion rejected with 409 CONFLICT
    await assert.rejects(
      () =>
        serviceMod.promoteFeedbackToTestimonialDraft(
          publisherStaff,
          { feedback_id: feedbackId },
          adapter
        ),
      (err) => err.status === 409 && err.code === 'CONFLICT'
    );
    console.log('  [OK] Feedback promotion, PII exclusion, and duplicate prevention verified.');

    // 7. Public RLS isolation under anon role
    await db.exec('SET ROLE anon;');
    const anonVisible = await db.query(
      `SELECT id, customer_name, is_published FROM public.testimonials`
    );
    assert.equal(anonVisible.rows.length, 1);
    assert.equal(anonVisible.rows[0].id, published1.id);

    // Anon cannot insert/update/delete testimonials or read moderation events / customer_feedback
    await assert.rejects(() =>
      db.query(`DELETE FROM public.testimonials WHERE id = $1`, [published1.id])
    );
    await assert.rejects(() =>
      db.query(`SELECT * FROM public.testimonial_moderation_events`)
    );
    await assert.rejects(() =>
      db.query(`SELECT * FROM public.customer_feedback`)
    );
    await db.exec('RESET ROLE;');
    console.log('  [OK] Public RLS isolation under PostgreSQL ROLE anon verified.');

    // 8. Featured ordering & unpublish removal
    const verifyConsent2 = await serviceMod.updateTestimonialRecord(
      publisherStaff,
      promotedDraft.id,
      {
        expected_updated_at: promotedDraft.updated_at,
        consent_verified: true,
        consent_evidence: 'Signed project handover consent form',
      },
      adapter
    );
    const approved2 = await serviceMod.transitionTestimonialModeration(
      publisherStaff,
      promotedDraft.id,
      'approve',
      { expected_updated_at: verifyConsent2.updated_at },
      adapter
    );
    const published2 = await serviceMod.transitionTestimonialModeration(
      publisherStaff,
      promotedDraft.id,
      'publish',
      { expected_updated_at: approved2.updated_at, confirmed: true },
      adapter
    );
    await serviceMod.setTestimonialFeatured(
      publisherStaff,
      published2.id,
      { expected_updated_at: published2.updated_at, is_featured: true },
      adapter
    );

    const publicList = await pubMod.getPublicTestimonials(adapter);
    assert.equal(publicList.length, 2);
    assert.equal(publicList[0].id, published2.id); // Featured comes first
    assert.equal(publicList[0].isFeatured, true);
    assert.equal(publicList[1].id, published1.id);
    assert.equal(publicList[1].rating, null); // Unsupplied rating remains null, never fabricated

    // Unpublish (Hide) immediately removes from public list
    const latestPub2 = (await serviceMod.getTestimonialByIdForAdmin(adminStaff, published2.id, adapter)).testimonial;
    const hidden2 = await serviceMod.transitionTestimonialModeration(
      adminStaff,
      published2.id,
      'unpublish',
      { expected_updated_at: latestPub2.updated_at },
      adapter
    );
    assert.equal(hidden2.is_published, false);
    assert.equal(hidden2.moderation_status, 'hidden');

    const publicAfterHide = await pubMod.getPublicTestimonials(adapter);
    assert.equal(publicAfterHide.length, 1);
    assert.equal(publicAfterHide.some((t) => t.id === published2.id), false);
    console.log('  [OK] Featured ordering and immediate unpublish removal verified.');

    // 9. Public component empty-state & zero-fabricated-fixture check
    const carouselSource = fs.readFileSync(
      path.join(REPO_ROOT, 'src/components/home/TestimonialCarousel.tsx'),
      'utf8'
    );
    assert.equal(carouselSource.includes('sampleTestimonials'), false);
    assert.equal(carouselSource.includes('P. Henderson'), false);
    assert.equal(carouselSource.includes('testimonials-empty-state'), true);
    console.log('  [OK] TestimonialCarousel empty state and removal of fabricated fixtures verified.');

    console.log('ALL BUSINESS CMS PHASE C TESTIMONIALS TESTS PASSED');
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error('Phase C test failure:', err);
  process.exit(1);
});
