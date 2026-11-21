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

function createPgliteAdapter(db, storageFiles = new Map()) {
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
      this.orders = [];
      this.expectSingle = false;
      this.expectMaybeSingle = false;
    }

    select() {
      if (this.op !== 'insert' && this.op !== 'update') {
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
    storage: {
      from(bucketId) {
        return {
          async download(storagePath) {
            const key = `${bucketId}:${storagePath}`;
            if (!storageFiles.has(key)) {
              return { data: null, error: { message: 'Object not found' } };
            }
            const buf = storageFiles.get(key);
            return {
              data: {
                async arrayBuffer() {
                  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
                },
              },
              error: null,
            };
          },
        };
      },
    },
  };
}

async function main() {
  console.log('=== Business CMS Phase E Unified Submissions & Private Documents Suite ===');
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

    // Re-run Migration 014 to verify idempotency
    await db.exec(
      fs.readFileSync(
        path.join(MIGRATIONS_DIR, '20261121050000_business_cms_submissions_foundation.sql'),
        'utf8'
      )
    );

    const storageFiles = new Map();
    const adapter = createPgliteAdapter(db, storageFiles);
    const cache = new Map();
    const stubs = {
      'server-only': {},
      'next/cache': { revalidatePath() {} },
      '@/lib/supabase/serviceRole': {
        createServiceRoleClient: () => adapter,
      },
    };

    const rbacMod = loadProjectTsModule('src/lib/cms/rbac.ts', stubs, cache);
    const navMod = loadProjectTsModule('src/lib/cms/adminNavigation.ts', stubs, cache);
    const subMod = loadProjectTsModule('src/lib/cms/submissionsService.ts', stubs, cache);
    const testMod = loadProjectTsModule('src/lib/cms/testimonialsService.ts', stubs, cache);

    // 1. RBAC & Navigation verification
    assert.equal(rbacMod.hasEditorialPermission('editor', 'submission:read'), false);
    assert.equal(rbacMod.hasEditorialPermission('editor', 'submission:write'), false);
    assert.equal(rbacMod.hasEditorialPermission('editor', 'submission:download_attachment'), false);
    assert.equal(rbacMod.hasEditorialPermission('publisher', 'submission:read'), true);
    assert.equal(rbacMod.hasEditorialPermission('publisher', 'submission:write'), true);
    assert.equal(rbacMod.hasEditorialPermission('publisher', 'submission:download_attachment'), true);
    assert.equal(rbacMod.hasEditorialPermission('admin', 'submission:download_attachment'), true);

    const editorNavIds = navMod.getAdminNavigationForRole('editor').map((i) => i.id);
    assert.equal(editorNavIds.includes('quote-requests'), false);
    assert.equal(editorNavIds.includes('job-applications'), false);
    assert.equal(editorNavIds.includes('customer-feedback'), false);

    const pubNav = navMod.getAdminNavigationForRole('publisher');
    assert.equal(pubNav.find((i) => i.id === 'quote-requests')?.href, '/admin/quotes');
    assert.equal(pubNav.find((i) => i.id === 'job-applications')?.href, '/admin/applications');
    assert.equal(pubNav.find((i) => i.id === 'customer-feedback')?.href, '/admin/feedback');
    console.log('  [OK] Submission RBAC and Publisher/Admin navigation verified.');

    const editorStaff = {
      id: '11111111-1111-4111-8111-111111111111',
      auth_user_id: '22222222-2222-4222-8222-222222222222',
      email: 'editor@strovyn.invalid',
      full_name: 'Editor Staff',
      role: 'editor',
      is_active: true,
    };
    const inactivePubStaff = {
      id: '77777777-7777-4777-8777-777777777777',
      auth_user_id: '88888888-8888-4888-8888-888888888888',
      email: 'inactive.pub@strovyn.invalid',
      full_name: 'Inactive Publisher',
      role: 'publisher',
      is_active: false,
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

    // 2. Atomic Submission RPCs + Private Attachment Binding Regression
    const quoteTokenHash = 'a'.repeat(64);
    const quoteStoragePath = 'documents/2026/11/scope-plan-1.pdf';
    const quoteFileRef = `supabase://customer-documents/${quoteStoragePath}`;
    storageFiles.set(`customer-documents:${quoteStoragePath}`, Buffer.from('%PDF-1.4 mock quote pdf'));

    await db.query(
      `INSERT INTO public.customer_document_uploads (bucket_id, category, storage_path, file_reference, mime_type, byte_size, claim_token_hash)
       VALUES ('customer-documents', 'documents', $1, $2, 'application/pdf', 23, $3)`,
      [quoteStoragePath, quoteFileRef, quoteTokenHash]
    );

    const quoteRpc = await db.query(
      `SELECT * FROM public.cms_submit_quote_with_attachment(
        gen_random_uuid(),
        'C. Kingsley',
        'kingsley.private@example.com',
        '+61 411 222 333',
        'North Adelaide, SA',
        'Heritage Facade & Limewash',
        'Full exterior mineral silicate specification for heritage residence.',
        'email',
        'pending',
        $1,
        $2,
        'idem-quote-phase-e-1'
      )`,
      [quoteFileRef, quoteTokenHash]
    );
    const quoteId1 = quoteRpc.rows[0].record_id;
    assert.ok(quoteId1);

    // Insert second quote without attachment for cross-record & pagination testing
    const quoteRpc2 = await db.query(
      `SELECT * FROM public.cms_submit_quote_with_attachment(
        gen_random_uuid(),
        'B. Thornton',
        'thornton.private@example.com',
        '+61 411 444 555',
        'Unley Park, SA',
        'Interior Level 5 Finish',
        'Level 5 skim coat and raking light inspection.',
        'phone',
        'pending',
        NULL,
        NULL,
        'idem-quote-phase-e-2'
      )`
    );
    const quoteId2 = quoteRpc2.rows[0].record_id;

    // Seed application with bound CV
    const cvTokenHash = 'b'.repeat(64);
    const cvStoragePath = 'resumes/2026/11/candidate-cv-1.pdf';
    const cvFileRef = `supabase://customer-documents/${cvStoragePath}`;
    storageFiles.set(`customer-documents:${cvStoragePath}`, Buffer.from('%PDF-1.4 mock resume pdf'));

    await db.query(
      `INSERT INTO public.customer_document_uploads (bucket_id, category, storage_path, file_reference, mime_type, byte_size, claim_token_hash)
       VALUES ('customer-documents', 'resumes', $1, $2, 'application/pdf', 24, $3)`,
      [cvStoragePath, cvFileRef, cvTokenHash]
    );

    const appRpc = await db.query(
      `SELECT * FROM public.cms_submit_application_with_attachment(
        gen_random_uuid(),
        'M. Artisan',
        'artisan.private@example.com',
        '+61 422 111 222',
        '10 years fine joinery spraying experience',
        'pending',
        $1,
        $2,
        'idem-app-phase-e-1',
        NULL
      )`,
      [cvFileRef, cvTokenHash]
    );
    const appId1 = appRpc.rows[0].record_id;

    // Seed customer feedback
    const fbInsert = await db.query(
      `INSERT INTO public.customer_feedback (name, email, project_reference, rating, message, status)
       VALUES ('H. Stirling', 'stirling.private@example.com', 'Medindie Villa', 5, 'Impeccable heritage cornice restoration.', 'pending')
       RETURNING id`
    );
    const fbId1 = fbInsert.rows[0].id;
    console.log('  [OK] Atomic quote & application submission RPCs and bound uploads verified.');

    // 3. Editor & Inactive Staff Denial (403 FORBIDDEN)
    for (const actor of [editorStaff, inactivePubStaff]) {
      await assert.rejects(
        () => subMod.listQuoteRequestsForAdmin(actor, {}, adapter),
        (err) => err.status === 403 && err.code === 'FORBIDDEN'
      );
      await assert.rejects(
        () => subMod.getQuoteRequestByIdForAdmin(actor, quoteId1, adapter),
        (err) => err.status === 403 && err.code === 'FORBIDDEN'
      );
      await assert.rejects(
        () => subMod.listJobApplicationsForAdmin(actor, {}, adapter),
        (err) => err.status === 403 && err.code === 'FORBIDDEN'
      );
      await assert.rejects(
        () => subMod.listCustomerFeedbackForAdmin(actor, {}, adapter),
        (err) => err.status === 403 && err.code === 'FORBIDDEN'
      );
      await assert.rejects(
        () => subMod.downloadAuthorizedSubmissionAttachment(actor, 'quotes', quoteId1, adapter),
        (err) => err.status === 403 && err.code === 'FORBIDDEN'
      );
    }
    console.log('  [OK] Editor and Inactive Staff denied across all submission list, detail, and attachment services.');

    // 4. Private Storage & Database Isolation under PostgreSQL ROLE anon / authenticated
    const bucketCheck = await db.query(
      `SELECT public FROM storage.buckets WHERE id = 'customer-documents'`
    );
    assert.equal(bucketCheck.rows[0].public, false);

    for (const pgRole of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${pgRole};`);
      for (const tbl of [
        'quote_requests',
        'job_applications',
        'customer_feedback',
        'customer_document_uploads',
        'submission_access_events',
      ]) {
        await assert.rejects(() => db.query(`SELECT * FROM public.${tbl}`));
      }
      await db.exec('RESET ROLE;');
    }
    console.log('  [OK] PostgreSQL anon/authenticated isolation and private customer-documents bucket verified.');

    // 5. List PII Minimization, Search, Filtering & Pagination
    const quotesPage1 = await subMod.listQuoteRequestsForAdmin(
      publisherStaff,
      { page: 1, pageSize: 1 },
      adapter
    );
    assert.equal(quotesPage1.total, 2);
    assert.equal(quotesPage1.totalPages, 2);
    assert.equal(quotesPage1.items.length, 1);
    assert.equal('email' in quotesPage1.items[0], false);
    assert.equal('phone' in quotesPage1.items[0], false);
    assert.equal('description' in quotesPage1.items[0], false);
    assert.equal('attachment_url' in quotesPage1.items[0], false);

    const searchKingsley = await subMod.listQuoteRequestsForAdmin(
      publisherStaff,
      { search: 'Kingsley' },
      adapter
    );
    assert.equal(searchKingsley.total, 1);
    assert.equal(searchKingsley.items[0].id, quoteId1);
    assert.equal(searchKingsley.items[0].has_attachment, true);

    const appsList = await subMod.listJobApplicationsForAdmin(publisherStaff, {}, adapter);
    assert.equal(appsList.total, 1);
    assert.equal('email' in appsList.items[0], false);
    assert.equal('phone' in appsList.items[0], false);
    assert.equal('cover_letter' in appsList.items[0], false);

    const fbList = await subMod.listCustomerFeedbackForAdmin(publisherStaff, {}, adapter);
    assert.equal(fbList.total, 1);
    assert.equal('email' in fbList.items[0], false);
    assert.equal('message' in fbList.items[0], false);
    console.log('  [OK] List PII minimization, search, and pagination verified.');

    // 6. Detail Inspection, Status Transitions, Internal Notes & 409 Optimistic Concurrency
    const quoteDetail = await subMod.getQuoteRequestByIdForAdmin(
      publisherStaff,
      quoteId1,
      adapter
    );
    assert.equal(quoteDetail.email, 'kingsley.private@example.com');
    assert.ok(quoteDetail.attachment);
    assert.equal(
      quoteDetail.attachment.download_path,
      `/api/admin/submissions/attachments/quotes/${quoteId1}`
    );

    const updatedQuote = await subMod.updateQuoteRequestForAdmin(
      publisherStaff,
      quoteId1,
      {
        expected_updated_at: quoteDetail.updated_at,
        status: 'quoted',
        admin_notes: 'Site inspection completed; quotation sent.',
      },
      adapter
    );
    assert.equal(updatedQuote.status, 'quoted');
    assert.equal(updatedQuote.admin_notes, 'Site inspection completed; quotation sent.');

    // Stale update rejected with 409 CONFLICT
    await assert.rejects(
      () =>
        subMod.updateQuoteRequestForAdmin(
          publisherStaff,
          quoteId1,
          {
            expected_updated_at: '2020-01-01T00:00:00.000Z',
            status: 'closed',
          },
          adapter
        ),
      (err) => err.status === 409 && err.code === 'CONFLICT'
    );
    console.log('  [OK] Status transitions, internal notes, and 409 optimistic concurrency verified.');

    // 7. Authorized Attachment Download & Cross-Record Tampering Prevention
    const dlQuote = await subMod.downloadAuthorizedSubmissionAttachment(
      publisherStaff,
      'quotes',
      quoteId1,
      adapter
    );
    assert.equal(dlQuote.fileName, 'scope-plan-1.pdf');
    assert.equal(dlQuote.mimeType, 'application/pdf');
    assert.equal(Buffer.from(dlQuote.bytes).toString('utf8'), '%PDF-1.4 mock quote pdf');

    const dlApp = await subMod.downloadAuthorizedSubmissionAttachment(
      adminStaff,
      'applications',
      appId1,
      adapter
    );
    assert.equal(dlApp.fileName, 'candidate-cv-1.pdf');

    // Quote without attachment returns 404
    await assert.rejects(
      () =>
        subMod.downloadAuthorizedSubmissionAttachment(
          publisherStaff,
          'quotes',
          quoteId2,
          adapter
        ),
      (err) => err.status === 404
    );

    // Cross-record tampering test: point quoteId2's attachment_url to a file claimed by another record
    const tamperedRef = 'supabase://customer-documents/documents/2026/11/tampered.pdf';
    await db.query(
      `INSERT INTO public.customer_document_uploads (bucket_id, category, storage_path, file_reference, mime_type, byte_size, claim_token_hash, claimed_by_table, claimed_record_id, claimed_at)
       VALUES ('customer-documents', 'documents', 'documents/2026/11/tampered.pdf', $1, 'application/pdf', 20, $2, 'quote_requests', $3, NOW())`,
      [tamperedRef, 'c'.repeat(64), quoteId1] // claimed by quoteId1, NOT quoteId2
    );
    await db.query(
      `UPDATE public.quote_requests SET attachment_url = $1 WHERE id = $2`,
      [tamperedRef, quoteId2]
    );
    await assert.rejects(
      () =>
        subMod.downloadAuthorizedSubmissionAttachment(
          publisherStaff,
          'quotes',
          quoteId2,
          adapter
        ),
      (err) => err.status === 403 && err.code === 'FORBIDDEN'
    );
    console.log('  [OK] Private attachment download and cross-record ownership enforcement verified.');

    // 8. Feedback Promotion Integration
    const promoted = await testMod.promoteFeedbackToTestimonialDraft(
      publisherStaff,
      { feedback_id: fbId1 },
      adapter
    );
    assert.equal(promoted.moderation_status, 'draft');
    assert.equal(promoted.is_published, false);
    assert.equal(promoted.consent_verified, false);
    assert.equal(promoted.source_feedback_id, fbId1);

    const fbAfterPromote = await subMod.getCustomerFeedbackByIdForAdmin(
      publisherStaff,
      fbId1,
      adapter
    );
    assert.equal(fbAfterPromote.already_promoted, true);
    assert.equal(fbAfterPromote.promoted_testimonial_id, promoted.id);
    console.log('  [OK] Customer feedback promotion integration verified.');

    console.log('ALL BUSINESS CMS PHASE E SUBMISSIONS & PRIVATE DOCUMENTS TESTS PASSED');
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error('Phase E test failure:', err);
  process.exit(1);
});
