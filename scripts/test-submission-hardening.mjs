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

/**
 * Lightweight PGlite-backed Supabase service-role + Storage simulator supporting
 * `.from().insert/update/select/upsert/eq/is`, `.rpc()`, and `.storage.from().remove()`.
 */
function createPgliteSupabaseAdapter(db) {
  const storageObjects = new Map([
    ['customer-documents', new Map()],
    ['project-photos', new Map()],
  ]);
  let failStorageRemoveForPath = null;

  function sanitizeCol(name) {
    assert.match(name, /^[a-zA-Z_][a-zA-Z0-9_]*$/);
    return `"${name}"`;
  }

  class QueryBuilder {
    constructor(table) {
      this.table = table;
      this.op = 'select';
      this.payload = null;
      this.filters = [];
      this.selectCols = '*';
      this.orderBy = null;
      this.limitVal = null;
      this.expectSingle = false;
      this.expectMaybeSingle = false;
    }

    select(cols = '*') {
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

    upsert(payload) {
      this.op = 'upsert';
      this.payload = payload;
      return this;
    }

    eq(col, val) {
      this.filters.push({ op: '=', col, val });
      return this;
    }

    is(col, val) {
      this.filters.push({ op: val === null ? 'IS NULL' : 'IS', col, val });
      return this;
    }

    order(col, { ascending = true } = {}) {
      this.orderBy = { col, dir: ascending ? 'ASC' : 'DESC' };
      return this;
    }

    limit(n) {
      this.limitVal = n;
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

    buildWhere(values) {
      if (this.filters.length === 0) return '';
      const parts = this.filters.map((f) => {
        const col = sanitizeCol(f.col);
        if (f.op === 'IS NULL') return `${col} IS NULL`;
        values.push(f.val);
        return `${col} = $${values.length}`;
      });
      return `WHERE ${parts.join(' AND ')}`;
    }

    async execute() {
      const tableRef = `public.${sanitizeCol(this.table)}`;
      try {
        if (this.op === 'insert' || this.op === 'upsert') {
          const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
          const cols = Object.keys(rows[0]);
          const values = [];
          const placeholders = rows.map(
            (r) =>
              `(${cols
                .map((c) => {
                  values.push(Array.isArray(r[c]) ? JSON.stringify(r[c]) : r[c]);
                  return `$${values.length}`;
                })
                .join(', ')})`
          );
          const colList = cols.map(sanitizeCol).join(', ');
          const conflictClause =
            this.op === 'upsert' && this.table === 'project_photo_overrides'
              ? ` ON CONFLICT ("slug") DO UPDATE SET ${cols
                  .filter((c) => c !== 'slug')
                  .map((c) => `${sanitizeCol(c)} = EXCLUDED.${sanitizeCol(c)}`)
                  .join(', ')}`
              : '';
          const res = await db.query(
            `INSERT INTO ${tableRef} (${colList}) VALUES ${placeholders.join(', ')}${conflictClause} RETURNING *`,
            values
          );
          const data = this.expectSingle || this.expectMaybeSingle ? res.rows[0] ?? null : res.rows;
          return { data, error: null };
        }

        if (this.op === 'update') {
          const values = [];
          const setParts = Object.entries(this.payload).map(([k, v]) => {
            values.push(v);
            return `${sanitizeCol(k)} = $${values.length}`;
          });
          const whereSql = this.buildWhere(values);
          const res = await db.query(
            `UPDATE ${tableRef} SET ${setParts.join(', ')} ${whereSql} RETURNING *`,
            values
          );
          return { data: res.rows, error: null };
        }

        const values = [];
        const whereSql = this.buildWhere(values);
        const orderSql = this.orderBy
          ? `ORDER BY ${sanitizeCol(this.orderBy.col)} ${this.orderBy.dir}`
          : '';
        const limitSql = this.limitVal ? `LIMIT ${Number(this.limitVal)}` : '';
        const res = await db.query(
          `SELECT ${this.selectCols} FROM ${tableRef} ${whereSql} ${orderSql} ${limitSql}`,
          values
        );
        if (this.expectSingle) {
          if (res.rows.length !== 1) {
            return { data: null, error: { message: 'Expected single row' } };
          }
          return { data: res.rows[0], error: null };
        }
        if (this.expectMaybeSingle) {
          return { data: res.rows[0] ?? null, error: null };
        }
        return { data: res.rows, error: null };
      } catch (err) {
        return { data: null, error: { message: err.message } };
      }
    }

    then(resolve, reject) {
      return this.execute().then(resolve, reject);
    }
  }

  const RPC_PARAM_ORDER = {
    cms_submit_quote_with_attachment: [
      'p_quote_id',
      'p_full_name',
      'p_email',
      'p_phone',
      'p_project_location',
      'p_service_required',
      'p_description',
      'p_preferred_contact',
      'p_status',
      'p_attachment_url',
      'p_claim_token_hash',
      'p_idempotency_key',
    ],
    cms_submit_application_with_attachment: [
      'p_application_id',
      'p_applicant_name',
      'p_email',
      'p_phone',
      'p_cover_letter',
      'p_status',
      'p_cv_url',
      'p_claim_token_hash',
      'p_idempotency_key',
    ],
    cms_reserve_expired_customer_uploads: ['p_limit', 'p_grace_seconds'],
  };

  return {
    storageObjects,
    setFailStorageRemoveForPath(targetPath) {
      failStorageRemoveForPath = targetPath;
    },
    client: {
      from(table) {
        return new QueryBuilder(table);
      },
      async rpc(fnName, args = {}) {
        const orderedNames = RPC_PARAM_ORDER[fnName];
        assert.ok(orderedNames, `Unknown RPC ${fnName}`);
        const values = [];
        const namedArgs = orderedNames
          .filter((name) => args[name] !== undefined)
          .map((name) => {
            values.push(args[name]);
            return `${name} => $${values.length}`;
          })
          .join(', ');
        try {
          const res = await db.query(`SELECT * FROM public.${fnName}(${namedArgs})`, values);
          return { data: res.rows, error: null };
        } catch (err) {
          return { data: null, error: { message: err.message, details: err.detail || '' } };
        }
      },
      storage: {
        from(bucket) {
          if (!storageObjects.has(bucket)) {
            storageObjects.set(bucket, new Map());
          }
          const store = storageObjects.get(bucket);
          return {
            async upload(storagePath, buffer, opts = {}) {
              store.set(storagePath, { buffer, contentType: opts.contentType || 'application/octet-stream' });
              return { data: { path: storagePath }, error: null };
            },
            async remove(paths) {
              for (const p of paths) {
                if (failStorageRemoveForPath && p === failStorageRemoveForPath) {
                  return { data: null, error: { message: 'Simulated storage delete outage' } };
                }
              }
              for (const p of paths) {
                store.delete(p);
              }
              return { data: paths.map((name) => ({ name })), error: null };
            },
          };
        },
      },
    },
  };
}

async function initDatabase() {
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
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await db.exec(sql);
  }
  return db;
}

async function run() {
  console.log('=== Phase 2.13 Transactional Submission Hardening & Portfolio Parity Tests ===');

  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const prevSvc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const prevAdminKey = process.env.STROVYN_ADMIN_KEY;
  const prevSessionSecret = process.env.ADMIN_SESSION_SECRET;

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://strovyntestproject.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.test';
  process.env.STROVYN_ADMIN_KEY = 'unit-test-admin-secret-key-0123456789';
  process.env.ADMIN_SESSION_SECRET = 'unit-test-session-secret-0123456789abcdef';

  const db = await initDatabase();
  const adapter = createPgliteSupabaseAdapter(db);
  const revalidatedPaths = [];

  const mockModules = {
    'server-only': {},
    'next/cache': {
      revalidatePath(p) {
        revalidatedPaths.push(p);
      },
    },
    'next/headers': {
      async cookies() {
        return {
          get() {
            return undefined;
          },
        };
      },
    },
    '@/lib/supabase/serviceRole': {
      isServiceRoleConfigured: () => true,
      isCmsSupabaseConfigured: () => true,
      createServiceRoleClient: () => adapter.client,
    },
  };

  try {
    const mockData = loadProjectTsModule('src/lib/db/mockData.ts', mockModules);
    const {
      registerCustomerDocumentUpload,
      addQuote,
      addApplication,
      cleanupExpiredCustomerDocumentUploads,
      AttachmentClaimError,
    } = mockData;

    // ------------------------------------------------------------------
    // 1. Atomic Quote + Attachment Submission & DB Constraint Rollback
    // ------------------------------------------------------------------
    const q1Ref = 'supabase://customer-documents/documents/quote-rollback-test.pdf';
    const q1Reg = await registerCustomerDocumentUpload({
      category: 'documents',
      storagePath: 'documents/quote-rollback-test.pdf',
      fileReference: q1Ref,
      mimeType: 'application/pdf',
      byteSize: 2048,
    });
    assert.equal(q1Reg.ok, true, 'Register quote upload should succeed');

    // Wrong hash must be rejected before any insert/claim happens
    await assert.rejects(
      () =>
        db.query(
          `SELECT * FROM public.cms_submit_quote_with_attachment(
             $1::uuid, 'Rollback Client', 'rollback@example.com', '0400111222',
             'Unley SA', 'Interior Painting', 'Desc', 'email', 'pending',
             $2, $3, 'idem-bad-hash-1'
           )`,
          ['11111111-1111-4111-8111-111111111111', q1Ref, '0'.repeat(64)]
        ),
      /ATTACHMENT_UNAUTHORIZED/
    );

    // Use the exact registered token hash so the claim UPDATE runs right before INSERT fails on NOT NULL!
    const q1RowPre = (
      await db.query(
        `SELECT claim_token_hash, claimed_at FROM public.customer_document_uploads WHERE file_reference = $1`,
        [q1Ref]
      )
    ).rows[0];
    assert.equal(q1RowPre.claimed_at, null);

    await assert.rejects(
      () =>
        db.query(
          `SELECT * FROM public.cms_submit_quote_with_attachment(
             $1::uuid, NULL, 'rollback@example.com', '0400111222',
             'Unley SA', 'Interior Painting', 'Desc', 'email', 'pending',
             $2, $3, 'idem-rollback-1'
           )`,
          ['11111111-1111-4111-8111-111111111111', q1Ref, q1RowPre.claim_token_hash]
        ),
      /null value in column "full_name"|not-null constraint/i
    );

    // Verify rollback preserved unclaimed upload!
    const q1RowAfterRollback = (
      await db.query(
        `SELECT claimed_at, claimed_by_table, claimed_record_id FROM public.customer_document_uploads WHERE file_reference = $1`,
        [q1Ref]
      )
    ).rows[0];
    assert.equal(q1RowAfterRollback.claimed_at, null, 'Failed INSERT must roll back attachment claim');
    assert.equal(q1RowAfterRollback.claimed_by_table, null);
    assert.equal(q1RowAfterRollback.claimed_record_id, null);

    // Retry with valid payload after rolled-back crash -> must SUCCEED atomically!
    const quoteSaved = await addQuote({
      fullName: 'Recovered Client',
      email: 'recovered@example.com',
      phone: '+61400111222',
      projectLocation: 'Unley SA',
      serviceRequired: 'Interior Precision',
      description: 'Valid quote after rollback recovery.',
      preferredContact: 'email',
      attachmentUrl: q1Ref,
      attachmentToken: q1Reg.uploadToken,
      idempotencyKey: 'idem-quote-recovery-1',
    });
    assert.ok(quoteSaved.id);
    assert.notEqual(quoteSaved.deduplicated, true);

    const q1ClaimedRow = (
      await db.query(
        `SELECT claimed_by_table, claimed_record_id, claimed_at FROM public.customer_document_uploads WHERE file_reference = $1`,
        [q1Ref]
      )
    ).rows[0];
    assert.equal(q1ClaimedRow.claimed_by_table, 'quote_requests');
    assert.equal(q1ClaimedRow.claimed_record_id, quoteSaved.id);
    assert.ok(q1ClaimedRow.claimed_at);

    // Cross-instance idempotency replay -> deduplicated true, same record_id!
    const quoteReplay = await addQuote({
      fullName: 'Recovered Client',
      email: 'recovered@example.com',
      phone: '+61400111222',
      projectLocation: 'Unley SA',
      serviceRequired: 'Interior Precision',
      description: 'Valid quote after rollback recovery.',
      preferredContact: 'email',
      attachmentUrl: q1Ref,
      attachmentToken: q1Reg.uploadToken,
      idempotencyKey: 'idem-quote-recovery-1',
    });
    assert.equal(quoteReplay.id, quoteSaved.id);
    assert.equal(quoteReplay.deduplicated, true);

    // Same idempotencyKey with mismatched attachment -> 409 AttachmentClaimError!
    await assert.rejects(
      () =>
        addQuote({
          fullName: 'Recovered Client',
          email: 'recovered@example.com',
          phone: '+61400111222',
          projectLocation: 'Unley SA',
          serviceRequired: 'Interior Precision',
          description: 'Changed payload',
          preferredContact: 'email',
          attachmentUrl: 'supabase://customer-documents/documents/different.pdf',
          attachmentToken: q1Reg.uploadToken,
          idempotencyKey: 'idem-quote-recovery-1',
        }),
      (err) => err instanceof AttachmentClaimError && err.status === 409
    );

    // ------------------------------------------------------------------
    // 2. Concurrent Duplicate Attachment Claim Tests (Quotes & Applications)
    // ------------------------------------------------------------------
    const concQuoteRef = 'supabase://customer-documents/documents/concurrent-quote.pdf';
    const concQuoteReg = await registerCustomerDocumentUpload({
      category: 'documents',
      storagePath: 'documents/concurrent-quote.pdf',
      fileReference: concQuoteRef,
      mimeType: 'application/pdf',
      byteSize: 1024,
    });
    assert.equal(concQuoteReg.ok, true);

    const concQuoteResults = await Promise.allSettled([
      addQuote({
        fullName: 'Race A',
        email: 'race-a@example.com',
        phone: '+61400222333',
        projectLocation: 'Norwood SA',
        serviceRequired: 'Exterior',
        description: 'Race attempt A',
        preferredContact: 'phone',
        attachmentUrl: concQuoteRef,
        attachmentToken: concQuoteReg.uploadToken,
        idempotencyKey: 'idem-race-a',
      }),
      addQuote({
        fullName: 'Race B',
        email: 'race-b@example.com',
        phone: '+61400222444',
        projectLocation: 'Norwood SA',
        serviceRequired: 'Exterior',
        description: 'Race attempt B',
        preferredContact: 'phone',
        attachmentUrl: concQuoteRef,
        attachmentToken: concQuoteReg.uploadToken,
        idempotencyKey: 'idem-race-b',
      }),
    ]);

    const qFulfilled = concQuoteResults.filter((r) => r.status === 'fulfilled');
    const qRejected = concQuoteResults.filter((r) => r.status === 'rejected');
    assert.equal(qFulfilled.length, 1, 'Exactly one concurrent quote claim must win');
    assert.equal(qRejected.length, 1, 'Exactly one concurrent quote claim must fail');
    assert.ok(qRejected[0].reason instanceof AttachmentClaimError);
    assert.equal(qRejected[0].reason.status, 400);

    // Application concurrency + idempotency + rollback
    const concAppRef = 'supabase://customer-documents/resumes/concurrent-cv.pdf';
    const concAppReg = await registerCustomerDocumentUpload({
      category: 'resumes',
      storagePath: 'resumes/concurrent-cv.pdf',
      fileReference: concAppRef,
      mimeType: 'application/pdf',
      byteSize: 1500,
    });
    assert.equal(concAppReg.ok, true);

    const concAppResults = await Promise.allSettled([
      addApplication({
        fullName: 'Applicant One',
        email: 'app1@example.com',
        phone: '+61400555111',
        position: 'Architectural Painter',
        yearsOfExperience: '6',
        coverLetter: 'Race 1',
        resumeUrl: concAppRef,
        resumeToken: concAppReg.uploadToken,
        idempotencyKey: 'idem-app-race-1',
      }),
      addApplication({
        fullName: 'Applicant Two',
        email: 'app2@example.com',
        phone: '+61400555222',
        position: 'Architectural Painter',
        yearsOfExperience: '8',
        coverLetter: 'Race 2',
        resumeUrl: concAppRef,
        resumeToken: concAppReg.uploadToken,
        idempotencyKey: 'idem-app-race-2',
      }),
    ]);

    const aFulfilled = concAppResults.filter((r) => r.status === 'fulfilled');
    const aRejected = concAppResults.filter((r) => r.status === 'rejected');
    assert.equal(aFulfilled.length, 1, 'Exactly one concurrent application claim must win');
    assert.equal(aRejected.length, 1);
    assert.ok(aRejected[0].reason instanceof AttachmentClaimError);

    // Replay winning application idempotency key -> deduplicated!
    const winningAppIdem =
      aFulfilled[0].value.fullName === 'Applicant One' ? 'idem-app-race-1' : 'idem-app-race-2';
    const appReplay = await addApplication({
      fullName: aFulfilled[0].value.fullName,
      email: aFulfilled[0].value.email,
      phone: aFulfilled[0].value.phone,
      position: 'Architectural Painter',
      yearsOfExperience: '6',
      resumeUrl: concAppRef,
      resumeToken: concAppReg.uploadToken,
      idempotencyKey: winningAppIdem,
    });
    assert.equal(appReplay.id, aFulfilled[0].value.id);
    assert.equal(appReplay.deduplicated, true);

    // Cross-category rejection (documents token used for application)
    const crossCatRef = 'supabase://customer-documents/documents/wrong-category.pdf';
    const crossCatReg = await registerCustomerDocumentUpload({
      category: 'documents',
      storagePath: 'documents/wrong-category.pdf',
      fileReference: crossCatRef,
      mimeType: 'application/pdf',
      byteSize: 512,
    });
    await assert.rejects(
      () =>
        addApplication({
          fullName: 'Cross Category',
          email: 'cross@example.com',
          phone: '+61400999888',
          position: 'Painter',
          yearsOfExperience: '3',
          resumeUrl: crossCatRef,
          resumeToken: crossCatReg.uploadToken,
          idempotencyKey: 'idem-cross-cat',
        }),
      (err) => err instanceof AttachmentClaimError && err.status === 400
    );

    // Expired upload rejection
    const expRef = 'supabase://customer-documents/documents/expired-upload.pdf';
    const expReg = await registerCustomerDocumentUpload({
      category: 'documents',
      storagePath: 'documents/expired-upload.pdf',
      fileReference: expRef,
      mimeType: 'application/pdf',
      byteSize: 512,
    });
    await db.query(
      `UPDATE public.customer_document_uploads SET expires_at = NOW() - INTERVAL '5 minutes' WHERE file_reference = $1`,
      [expRef]
    );
    await assert.rejects(
      () =>
        addQuote({
          fullName: 'Expired User',
          email: 'expired@example.com',
          phone: '+61400777111',
          projectLocation: 'Glenelg SA',
          serviceRequired: 'Plaster',
          description: 'Too late',
          preferredContact: 'email',
          attachmentUrl: expRef,
          attachmentToken: expReg.uploadToken,
          idempotencyKey: 'idem-expired-1',
        }),
      (err) => err instanceof AttachmentClaimError && err.status === 400
    );

    // ------------------------------------------------------------------
    // 3. RBAC Check: anon & authenticated MUST NOT execute 010 RPCs
    // ------------------------------------------------------------------
    for (const role of ['anon', 'authenticated']) {
      for (const [fnLabel, sql] of [
        [
          'cms_reserve_expired_customer_uploads',
          `SELECT * FROM public.cms_reserve_expired_customer_uploads(10, 900)`,
        ],
        [
          'cms_submit_quote_with_attachment',
          `SELECT * FROM public.cms_submit_quote_with_attachment(
             gen_random_uuid(), 'A', 'a@b.c', '0400000000', 'SA', 'Paint', 'Desc', 'email'
           )`,
        ],
        [
          'cms_submit_application_with_attachment',
          `SELECT * FROM public.cms_submit_application_with_attachment(
             gen_random_uuid(), 'A', 'a@b.c', '0400000000', 'Cover'
           )`,
        ],
      ]) {
        await db.exec('BEGIN');
        try {
          await db.exec(`SET LOCAL ROLE ${role}`);
          await assert.rejects(
            () => db.query(sql),
            /permission denied/i,
            `${role} must not execute ${fnLabel}`
          );
        } finally {
          await db.exec('ROLLBACK');
        }
      }
    }

    const privRes = await db.query(`
      SELECT
        has_function_privilege('service_role', 'public.cms_submit_quote_with_attachment(uuid,text,text,text,text,text,text,text,text,text,text,text)', 'EXECUTE') AS q_svc,
        has_function_privilege('service_role', 'public.cms_submit_application_with_attachment(uuid,text,text,text,text,text,text,text,text)', 'EXECUTE') AS a_svc,
        has_function_privilege('service_role', 'public.cms_reserve_expired_customer_uploads(integer,integer)', 'EXECUTE') AS r_svc
    `);
    assert.equal(privRes.rows[0].q_svc, true);
    assert.equal(privRes.rows[0].a_svc, true);
    assert.equal(privRes.rows[0].r_svc, true);

    // ------------------------------------------------------------------
    // 4. Storage Lifecycle & Safe Orphan Cleanup Tests
    // ------------------------------------------------------------------
    const storageStore = adapter.storageObjects.get('customer-documents');

    // (a) Active non-expired upload
    const activePath = 'documents/orphan-active.pdf';
    await registerCustomerDocumentUpload({
      category: 'documents',
      storagePath: activePath,
      fileReference: `supabase://customer-documents/${activePath}`,
      mimeType: 'application/pdf',
      byteSize: 100,
    });
    storageStore.set(activePath, { buffer: Buffer.from('%PDF') });

    // (b) Expired upload still inside 900s grace window
    const gracePath = 'documents/orphan-grace.pdf';
    await registerCustomerDocumentUpload({
      category: 'documents',
      storagePath: gracePath,
      fileReference: `supabase://customer-documents/${gracePath}`,
      mimeType: 'application/pdf',
      byteSize: 100,
    });
    storageStore.set(gracePath, { buffer: Buffer.from('%PDF') });
    await db.query(
      `UPDATE public.customer_document_uploads SET expires_at = NOW() - INTERVAL '60 seconds' WHERE storage_path = $1`,
      [gracePath]
    );

    // (c) Bound/claimed upload whose expires_at is in the past -> MUST NEVER be deleted!
    storageStore.set('documents/quote-rollback-test.pdf', { buffer: Buffer.from('%PDF') });
    await db.query(
      `UPDATE public.customer_document_uploads SET expires_at = NOW() - INTERVAL '3 hours' WHERE file_reference = $1`,
      [q1Ref]
    );

    // (d) Expired unclaimed upload past grace window -> SHOULD be reserved & deleted!
    const sweepPath = 'documents/orphan-sweep.pdf';
    const sweepReg = await registerCustomerDocumentUpload({
      category: 'documents',
      storagePath: sweepPath,
      fileReference: `supabase://customer-documents/${sweepPath}`,
      mimeType: 'application/pdf',
      byteSize: 100,
    });
    storageStore.set(sweepPath, { buffer: Buffer.from('%PDF') });
    await db.query(
      `UPDATE public.customer_document_uploads SET expires_at = NOW() - INTERVAL '2 hours' WHERE storage_path = $1`,
      [sweepPath]
    );

    // (e) Expired unclaimed upload whose Storage remove fails -> cleanup_failed -> then succeeds!
    const retryPath = 'documents/orphan-retry.pdf';
    await registerCustomerDocumentUpload({
      category: 'documents',
      storagePath: retryPath,
      fileReference: `supabase://customer-documents/${retryPath}`,
      mimeType: 'application/pdf',
      byteSize: 100,
    });
    storageStore.set(retryPath, { buffer: Buffer.from('%PDF') });
    await db.query(
      `UPDATE public.customer_document_uploads SET expires_at = NOW() - INTERVAL '2 hours' WHERE storage_path = $1`,
      [retryPath]
    );

    // Also make sure `expRef` from test 1 is reset to active/non-expired or let's track expected count cleanly
    adapter.setFailStorageRemoveForPath(retryPath);
    const cleanupRun1 = await cleanupExpiredCustomerDocumentUploads({ graceSeconds: 900, limit: 50 });

    assert.equal(cleanupRun1.ok, false, 'Simulated storage outage must surface ok=false');
    assert.equal(cleanupRun1.reserved, 2, 'Only the 2 past-grace expired unclaimed uploads should reserve');
    assert.equal(cleanupRun1.deleted, 1);
    assert.equal(cleanupRun1.failed, 1);

    assert.equal(storageStore.has(sweepPath), false, 'Swept orphan storage object must be removed');
    assert.equal(storageStore.has(activePath), true, 'Active upload must remain');
    assert.equal(storageStore.has(gracePath), true, 'Grace-window upload must remain');
    assert.equal(storageStore.has('documents/quote-rollback-test.pdf'), true, 'Claimed attachment must NEVER be deleted');
    assert.equal(storageStore.has(retryPath), true, 'Failed delete must keep object untouched');

    // Verify DB states & late claim block on swept row
    const sweepDb = (
      await db.query(`SELECT cleanup_state, cleaned_at FROM public.customer_document_uploads WHERE storage_path = $1`, [
        sweepPath,
      ])
    ).rows[0];
    assert.equal(sweepDb.cleanup_state, 'deleted');
    assert.ok(sweepDb.cleaned_at);

    await assert.rejects(
      () =>
        addQuote({
          fullName: 'Late Claimer',
          email: 'late@example.com',
          phone: '+61400000111',
          projectLocation: 'Adelaide SA',
          serviceRequired: 'Interior',
          description: 'Trying deleted attachment',
          preferredContact: 'email',
          attachmentUrl: `supabase://customer-documents/${sweepPath}`,
          attachmentToken: sweepReg.uploadToken,
          idempotencyKey: 'idem-late-claim',
        }),
      (err) => err instanceof AttachmentClaimError && err.status === 400
    );

    // Recover storage & retry cleanup -> `retryPath` now succeeds!
    adapter.setFailStorageRemoveForPath(null);
    const cleanupRun2 = await cleanupExpiredCustomerDocumentUploads({ graceSeconds: 900, limit: 50 });
    assert.equal(cleanupRun2.ok, true);
    assert.equal(cleanupRun2.reserved, 1);
    assert.equal(cleanupRun2.deleted, 1);
    assert.equal(cleanupRun2.failed, 0);
    assert.equal(storageStore.has(retryPath), false);

    // DB check constraint blocks marking a claimed row as non-active
    await assert.rejects(
      () =>
        db.query(
          `UPDATE public.customer_document_uploads SET cleanup_state = 'deleted' WHERE file_reference = $1`,
          [q1Ref]
        ),
      /customer_document_uploads_claimed_state_chk|check constraint/i
    );

    // ------------------------------------------------------------------
    // 5. Direct Photo URL Bucket Restriction & Revalidation Tests
    // ------------------------------------------------------------------
    const { createSessionToken } = loadProjectTsModule('src/lib/security/auth.ts', mockModules);
    const sessionToken = createSessionToken();
    mockModules['next/headers'] = {
      async cookies() {
        return {
          get(name) {
            return name === 'strovyn_admin_session' ? { value: sessionToken } : undefined;
          },
        };
      },
    };
    const photosRoute = loadProjectTsModule('src/app/api/admin/photos/route.ts', mockModules);

    async function postPhotoDirectUrl(directUrl) {
      const form = new FormData();
      form.append('slug', 'the-north-adelaide-residence');
      form.append('type', 'hero');
      form.append('url', directUrl);
      const req = {
        headers: new Headers({
          host: 'strovyn.com',
          origin: 'https://strovyn.com',
        }),
        async formData() {
          return form;
        },
      };
      return photosRoute.POST(req);
    }

    const rejectedUrls = [
      'https://strovyntestproject.supabase.co/storage/v1/object/public/customer-documents/documents/secret.pdf',
      'https://strovyntestproject.supabase.co/storage/v1/object/public/editorial-media/articles/draft.png',
      'https://strovyntestproject.supabase.co/storage/v1/object/sign/project-photos/a.png?token=abc',
      'https://strovyntestproject.supabase.co/storage/v1/object/public/project-photos/',
      'https://strovyntestproject.supabase.co/storage/v1/object/public/project-photos/../customer-documents/a.png',
      '/api/editorial-media/secret.png',
      'https://evil.example.com/photo.png',
    ];

    for (const badUrl of rejectedUrls) {
      const res = await postPhotoDirectUrl(badUrl);
      assert.equal(res.status, 400, `Expected 400 rejecting disallowed directUrl: ${badUrl}`);
    }

    const validSupabasePhotoUrl =
      'https://strovyntestproject.supabase.co/storage/v1/object/public/project-photos/the-north-adelaide-residence-hero-test.png';
    const goodRes = await postPhotoDirectUrl(validSupabasePhotoUrl);
    assert.equal(goodRes.status, 200, 'Approved project-photos public URL must return 200');
    const goodBody = await goodRes.json();
    assert.equal(goodBody.newUrl, validSupabasePhotoUrl);

    assert.ok(revalidatedPaths.includes('/projects'), 'Expected revalidatePath(/projects)');
    assert.ok(
      revalidatedPaths.includes('/projects/the-north-adelaide-residence'),
      'Expected revalidatePath(/projects/the-north-adelaide-residence)'
    );
    assert.ok(revalidatedPaths.includes('/api/projects'), 'Expected revalidatePath(/api/projects)');

    // Verify Project Detail page source uses dynamic async loader + connection() + top-level notFound()
    const projectDetailSource = fs.readFileSync(
      path.join(REPO_ROOT, 'src', 'app', 'projects', '[slug]', 'page.tsx'),
      'utf8'
    );
    assert.ok(projectDetailSource.includes('getProjectsWithOverridesAsync'));
    assert.ok(projectDetailSource.includes('connection()'));
    assert.ok(projectDetailSource.includes('notFound()'));

    console.log('ALL PHASE 2.13 TESTS PASSED');
  } finally {
    await db.close();
    if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    if (prevAnon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevAnon;
    if (prevSvc === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevSvc;
    if (prevAdminKey === undefined) delete process.env.STROVYN_ADMIN_KEY;
    else process.env.STROVYN_ADMIN_KEY = prevAdminKey;
    if (prevSessionSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = prevSessionSecret;
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
