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

function makeValidPngBuffer(width = 1200, height = 800) {
  const buf = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  buf[24] = 8;
  buf[25] = 2;
  return buf;
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

function createPgliteCmsAdapter(db, supabaseBaseUrl) {
  const bucketObjects = new Map([['editorial-media', new Map()]]);

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
      this.orderBy = null;
      this.limitVal = null;
      this.expectSingle = false;
      this.expectMaybeSingle = false;
    }

    select(cols = '*') {
      if (this.op !== 'insert' && this.op !== 'update' && this.op !== 'delete') {
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
      this.filters.push({ op: '=', col, val });
      return this;
    }

    in(col, vals) {
      this.filters.push({ op: 'IN', col, val: vals });
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
      const clauses = [];
      for (const f of this.filters) {
        const col = sanitizeCol(f.col);
        if (f.op === 'IS NULL') {
          clauses.push(`${col} IS NULL`);
        } else if (f.op === 'IN') {
          if (!Array.isArray(f.val) || f.val.length === 0) {
            clauses.push('FALSE');
          } else {
            const ph = f.val.map((v) => {
              values.push(v);
              return `$${values.length}`;
            });
            clauses.push(`${col} IN (${ph.join(', ')})`);
          }
        } else {
          values.push(f.val);
          clauses.push(`${col} = $${values.length}`);
        }
      }
      return clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    }

    async execute() {
      const tableRef = `public.${sanitizeCol(this.table)}`;
      try {
        if (this.op === 'insert') {
          const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
          const cols = Object.keys(rows[0]);
          const values = [];
          const placeholders = rows.map(
            (r) =>
              `(${cols
                .map((c) => {
                  values.push(serializeParam(r[c]));
                  return `$${values.length}`;
                })
                .join(', ')})`
          );
          const colList = cols.map(sanitizeCol).join(', ');
          const res = await db.query(
            `INSERT INTO ${tableRef} (${colList}) VALUES ${placeholders.join(', ')} RETURNING ${this.selectCols}`,
            values
          );
          const data = this.expectSingle || this.expectMaybeSingle ? res.rows[0] ?? null : res.rows;
          return { data, error: null };
        }

        if (this.op === 'update') {
          const values = [];
          const setParts = Object.entries(this.payload).map(([k, v]) => {
            values.push(serializeParam(v));
            return `${sanitizeCol(k)} = $${values.length}`;
          });
          const whereSql = this.buildWhere(values);
          const res = await db.query(
            `UPDATE ${tableRef} SET ${setParts.join(', ')} ${whereSql} RETURNING ${this.selectCols}`,
            values
          );
          const data = this.expectSingle || this.expectMaybeSingle ? res.rows[0] ?? null : res.rows;
          return { data, error: null };
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

  return {
    bucketObjects,
    client: {
      from(table) {
        return new QueryBuilder(table);
      },
      async rpc(fnName, args = {}) {
        try {
          if (fnName === 'cms_transition_article_status') {
            const res = await db.query(
              `SELECT * FROM public.cms_transition_article_status(
                 $1::uuid, $2::text, $3::uuid, $4::text, $5::timestamptz, $6::text
               )`,
              [
                args.p_article_id,
                args.p_to_status,
                args.p_actor_staff_id,
                args.p_actor_type ?? 'staff',
                args.p_scheduled_at ?? null,
                args.p_note ?? null,
              ]
            );
            return { data: res.rows, error: null };
          }
          if (fnName === 'cms_find_referencing_articles_for_media') {
            const res = await db.query(
              `SELECT id, slug, status FROM public.cms_find_referencing_articles_for_media($1::uuid)`,
              [args.p_asset_id]
            );
            return { data: res.rows, error: null };
          }
          if (fnName === 'cms_is_media_asset_referenced') {
            const res = await db.query(
              `SELECT public.cms_is_media_asset_referenced($1::uuid) AS referenced`,
              [args.p_asset_id]
            );
            return { data: res.rows[0].referenced, error: null };
          }
          if (fnName === 'cms_resolve_public_editorial_media') {
            const res = await db.query(
              `SELECT * FROM public.cms_resolve_public_editorial_media($1::uuid)`,
              [args.p_asset_id]
            );
            return { data: res.rows, error: null };
          }
          throw new Error(`Unexpected RPC ${fnName}`);
        } catch (err) {
          return { data: null, error: { message: err.message } };
        }
      },
      storage: {
        from(bucket) {
          if (!bucketObjects.has(bucket)) {
            bucketObjects.set(bucket, new Map());
          }
          const store = bucketObjects.get(bucket);
          return {
            async upload(storagePath, buffer, opts = {}) {
              store.set(storagePath, { buffer: Buffer.from(buffer), contentType: opts.contentType });
              return { data: { path: storagePath }, error: null };
            },
            async download(storagePath) {
              const obj = store.get(storagePath);
              if (!obj) {
                return { data: null, error: { message: 'Object not found' } };
              }
              return {
                data: {
                  arrayBuffer: async () =>
                    obj.buffer.buffer.slice(obj.buffer.byteOffset, obj.buffer.byteOffset + obj.buffer.byteLength),
                },
                error: null,
              };
            },
            async createSignedUrl(storagePath) {
              return {
                data: {
                  signedUrl: `${supabaseBaseUrl}/storage/v1/object/sign/${bucket}/${storagePath}?token=test-sig`,
                },
                error: null,
              };
            },
            async remove(paths) {
              for (const p of paths) store.delete(p);
              return { data: paths.map((name) => ({ name })), error: null };
            },
          };
        },
      },
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

function makeReq(method, url, body, { origin = 'https://strovyn.com', host = 'strovyn.com' } = {}) {
  const headers = new Headers();
  if (host) headers.set('host', host);
  if (origin) headers.set('origin', origin);
  const rawBody = body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body);
  return {
    method,
    url,
    headers,
    async json() {
      return rawBody ? JSON.parse(rawBody) : null;
    },
    async text() {
      return rawBody ?? '';
    },
  };
}

function makeMediaFormReq(url, fileBuffer, fileName, mimeType, altText, articleId) {
  const form = new FormData();
  form.append('file', new File([fileBuffer], fileName, { type: mimeType }));
  form.append('altText', altText);
  if (articleId) form.append('articleId', articleId);
  return {
    method: 'POST',
    url,
    headers: new Headers({ host: 'strovyn.com', origin: 'https://strovyn.com' }),
    async formData() {
      return form;
    },
  };
}

async function queryAnonPublicVisible(db, articleId) {
  await db.exec('BEGIN');
  try {
    await db.exec('SET LOCAL ROLE anon');
    const res = await db.query(`SELECT id, slug, status FROM public.articles WHERE id = $1::uuid`, [
      articleId,
    ]);
    return res.rows;
  } finally {
    await db.exec('ROLLBACK');
  }
}

async function run() {
  console.log('=== CMS-3 Stage 3 Workflow Transitions, Preview, Audit & Publication Integrity Suite ===');

  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const prevSvc = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabaseBaseUrl = 'https://strovyntestproject.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseBaseUrl;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.test';

  const db = await initDb();
  const adapter = createPgliteCmsAdapter(db, supabaseBaseUrl);

  const identities = {
    editor: { id: '30000000-0000-4000-8000-000000000001', email: 'editor@strovyn.invalid' },
    publisher: { id: '30000000-0000-4000-8000-000000000002', email: 'publisher@strovyn.invalid' },
    admin: { id: '30000000-0000-4000-8000-000000000003', email: 'admin@strovyn.invalid' },
    inactive: { id: '30000000-0000-4000-8000-000000000004', email: 'inactive@strovyn.invalid' },
    outsider: { id: '30000000-0000-4000-8000-000000000099', email: 'outsider@strovyn.invalid' },
  };

  await db.query(
    `INSERT INTO public.staff_users (auth_user_id, email, full_name, role, is_active) VALUES
     ($1, $2, 'Stage3 Editor', 'editor', TRUE),
     ($3, $4, 'Stage3 Publisher', 'publisher', TRUE),
     ($5, $6, 'Stage3 Admin', 'admin', TRUE),
     ($7, $8, 'Inactive Publisher', 'publisher', FALSE)`,
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

  const mockModules = {
    'server-only': {},
    '@/lib/supabase/serviceRole': {
      isCmsSupabaseConfigured: () => true,
      isServiceRoleConfigured: () => true,
      createServiceRoleClient: () => adapter.client,
    },
    '@/lib/supabase/server': {
      async createClient() {
        return {
          auth: {
            async getUser() {
              return { data: { user: currentAuthUser }, error: null };
            },
          },
        };
      },
    },
  };

  try {
    const insightsRoute = loadProjectTsModule('src/app/api/admin/insights/route.ts', mockModules);
    const articleIdRoute = loadProjectTsModule('src/app/api/admin/insights/[id]/route.ts', mockModules);
    const transitionRoute = loadProjectTsModule('src/app/api/admin/insights/[id]/transition/route.ts', mockModules);
    const auditRoute = loadProjectTsModule('src/app/api/admin/insights/[id]/audit/route.ts', mockModules);
    const previewRoute = loadProjectTsModule('src/app/api/admin/insights/[id]/preview/route.ts', mockModules);
    const mediaRoute = loadProjectTsModule('src/app/api/admin/insights/media/route.ts', mockModules);
    const publicMediaRoute = loadProjectTsModule('src/app/api/editorial-media/[id]/route.ts', mockModules);
    const editorHelpers = loadProjectTsModule('src/lib/cms/editorHelpers.ts', mockModules);

    // 1. Create Draft + Upload Private Cover Image
    currentAuthUser = identities.editor;
    const createRes = await insightsRoute.POST(
      makeReq('POST', 'https://strovyn.com/api/admin/insights', {
        title: 'Limewash Adhesion & Vapor Permeability',
        slug: 'limewash-adhesion-vapor-permeability',
        category: 'Paint Chemistry',
        excerpt: 'Mineral carbonation mechanics for breathable sandstone and lime plaster facades.',
        content_json: editorHelpers.buildStarterTiptapDoc(
          'Traditional slaked limewash cures through atmospheric carbonation within damp mineral substrates.'
        ),
        author_name: 'Stage3 Editor',
      })
    );
    assert.equal(createRes.status, 201);
    let currentArticle = (await createRes.json()).article;
    const articleId = currentArticle.id;

    const uploadRes = await mediaRoute.POST(
      makeMediaFormReq(
        'https://strovyn.com/api/admin/insights/media',
        makeValidPngBuffer(1000, 600),
        'limewash-sample.png',
        'image/png',
        'Slaked limewash coat sample on sandstone facade',
        articleId
      )
    );
    assert.equal(uploadRes.status, 201);
    const asset = (await uploadRes.json()).asset;

    const patchRes = await articleIdRoute.PATCH(
      makeReq('PATCH', `https://strovyn.com/api/admin/insights/${articleId}`, {
        featured_image_url: asset.media_ref,
        featured_image_alt: asset.alt_text,
        expected_updated_at: currentArticle.updated_at,
      }),
      { params: Promise.resolve({ id: articleId }) }
    );
    assert.equal(patchRes.status, 200);
    currentArticle = (await patchRes.json()).article;

    async function doTransition(actorUser, toStatus, expectedUpdatedAt, note, extraOpts) {
      currentAuthUser = actorUser;
      const body = { toStatus, expected_updated_at: expectedUpdatedAt };
      if (note !== undefined) body.note = note;
      return transitionRoute.POST(
        makeReq('POST', `https://strovyn.com/api/admin/insights/${articleId}/transition`, body, extraOpts),
        { params: Promise.resolve({ id: articleId }) }
      );
    }

    async function checkPublicVisibility(expectedVisible) {
      const rows = await queryAnonPublicVisible(db, articleId);
      assert.equal(rows.length, expectedVisible ? 1 : 0, `Public RLS articles visibility mismatch`);
      const gatedRes = await publicMediaRoute.GET(
        new Request(`https://strovyn.com/api/editorial-media/${asset.id}`),
        { params: Promise.resolve({ id: asset.id }) }
      );
      assert.equal(
        gatedRes.status,
        expectedVisible ? 200 : 404,
        `Public editorial-media status mismatch`
      );
    }

    // While draft: invisible publicly & media 404
    await checkPublicVisibility(false);

    // ------------------------------------------------------------------
    // 2. Auth, CSRF & Unsaved/Concurrency Transition Guards
    // ------------------------------------------------------------------
    const unauthTrans = await doTransition(null, 'review', currentArticle.updated_at);
    assert.equal(unauthTrans.status, 401);

    const outsiderTrans = await doTransition(identities.outsider, 'review', currentArticle.updated_at);
    assert.equal(outsiderTrans.status, 403);

    const inactiveTrans = await doTransition(identities.inactive, 'review', currentArticle.updated_at);
    assert.equal(inactiveTrans.status, 403);

    const badCsrfTrans = await doTransition(identities.editor, 'review', currentArticle.updated_at, undefined, {
      origin: 'https://evil.example',
      host: 'strovyn.com',
    });
    assert.equal(badCsrfTrans.status, 403);

    const staleTrans = await doTransition(identities.editor, 'review', '2020-01-01T00:00:00.000Z');
    assert.equal(staleTrans.status, 409, 'Stale expected_updated_at on transition must return 409');

    // Preview auth check (401 unauth, 403 inactive/outsider, 200 editor)
    currentAuthUser = null;
    assert.equal(
      (await previewRoute.GET(new Request(`https://strovyn.com/api/admin/insights/${articleId}/preview`), { params: Promise.resolve({ id: articleId }) })).status,
      401
    );
    currentAuthUser = identities.outsider;
    assert.equal(
      (await previewRoute.GET(new Request(`https://strovyn.com/api/admin/insights/${articleId}/preview`), { params: Promise.resolve({ id: articleId }) })).status,
      403
    );
    currentAuthUser = identities.editor;
    assert.equal(
      (await previewRoute.GET(new Request(`https://strovyn.com/api/admin/insights/${articleId}/preview`), { params: Promise.resolve({ id: articleId }) })).status,
      200
    );

    // Unsaved changes guard check in editorHelpers
    const snapBeforeEdit = editorHelpers.extractEditableSnapshot(currentArticle);
    const unsavedDraft = { ...snapBeforeEdit, title: 'Unsaved Uncommitted Title Edit' };
    assert.equal(editorHelpers.isArticleFormDirty(snapBeforeEdit, unsavedDraft), true);

    // ------------------------------------------------------------------
    // 3. Complete RBAC Transition Matrix (Permitted vs Forbidden)
    // ------------------------------------------------------------------
    // Editor CANNOT bypass draft -> approved or draft -> published or draft -> archived
    assert.equal((await doTransition(identities.editor, 'approved', currentArticle.updated_at)).status, 422);
    assert.equal((await doTransition(identities.editor, 'published', currentArticle.updated_at)).status, 422);
    assert.equal((await doTransition(identities.publisher, 'published', currentArticle.updated_at)).status, 422);

    // Editor submits draft -> review (200)
    const submitRes = await doTransition(identities.editor, 'review', currentArticle.updated_at, 'Ready for technical review.');
    assert.equal(submitRes.status, 200);
    currentArticle = (await submitRes.json()).article;
    assert.equal(currentArticle.status, 'review');
    await checkPublicVisibility(false);

    // Editor CAN request changes review -> draft
    const reqChangesRes = await doTransition(identities.editor, 'draft', currentArticle.updated_at, 'Need mineral ratio note.');
    assert.equal(reqChangesRes.status, 200);
    currentArticle = (await reqChangesRes.json()).article;
    assert.equal(currentArticle.status, 'draft');

    // Submit again -> review
    currentArticle = (await (await doTransition(identities.editor, 'review', currentArticle.updated_at, 'Updated mineral ratio note.')).json()).article;

    // Editor CANNOT approve review -> approved (403)
    const edApproveFail = await doTransition(identities.editor, 'approved', currentArticle.updated_at);
    assert.equal(edApproveFail.status, 403);

    // Publisher approves review -> approved (200)
    const approveRes = await doTransition(identities.publisher, 'approved', currentArticle.updated_at, 'Scientifically verified.');
    assert.equal(approveRes.status, 200);
    currentArticle = (await approveRes.json()).article;
    assert.equal(currentArticle.status, 'approved');
    assert.ok(currentArticle.approved_at);
    // Approved articles remain strictly unpublished!
    await checkPublicVisibility(false);

    // Editor CANNOT return approved -> review/draft or publish or archive
    assert.equal((await doTransition(identities.editor, 'draft', currentArticle.updated_at)).status, 403);
    assert.equal((await doTransition(identities.editor, 'published', currentArticle.updated_at)).status, 403);

    // Publisher CAN return approved -> review, then re-approve
    currentArticle = (await (await doTransition(identities.publisher, 'review', currentArticle.updated_at, 'Double-check citation.')).json()).article;
    assert.equal(currentArticle.status, 'review');
    currentArticle = (await (await doTransition(identities.publisher, 'approved', currentArticle.updated_at, 'Citation confirmed.')).json()).article;

    // Publisher scheduling without scheduled_at fails with 422 SCHEDULED_AT_REQUIRED
    const schedRes = await doTransition(identities.publisher, 'scheduled', currentArticle.updated_at);
    assert.equal(schedRes.status, 422);
    assert.equal((await schedRes.json()).code, 'SCHEDULED_AT_REQUIRED');

    // Publisher publishes approved -> published (200)
    const pubRes = await doTransition(identities.publisher, 'published', currentArticle.updated_at, 'Go live.');
    assert.equal(pubRes.status, 200);
    currentArticle = (await pubRes.json()).article;
    assert.equal(currentArticle.status, 'published');
    assert.ok(currentArticle.published_at);

    // Published article & media immediately publicly deliverable!
    await checkPublicVisibility(true);

    // Editor CANNOT archive published article (403)
    assert.equal((await doTransition(identities.editor, 'archived', currentArticle.updated_at)).status, 403);

    // Admin archives published -> archived (200)
    const archRes = await doTransition(identities.admin, 'archived', currentArticle.updated_at, 'Superseded edition.');
    assert.equal(archRes.status, 200);
    currentArticle = (await archRes.json()).article;
    assert.equal(currentArticle.status, 'archived');
    assert.ok(currentArticle.archived_at);

    // Archived article & media immediately lose public visibility!
    await checkPublicVisibility(false);

    // Editor CANNOT restore archived -> draft (403); Publisher CAN restore archived -> draft (200)
    assert.equal((await doTransition(identities.editor, 'draft', currentArticle.updated_at)).status, 403);
    const restoreRes = await doTransition(identities.publisher, 'draft', currentArticle.updated_at, 'Reopening for revision.');
    assert.equal(restoreRes.status, 200);
    currentArticle = (await restoreRes.json()).article;
    assert.equal(currentArticle.status, 'draft');
    await checkPublicVisibility(false);

    // ------------------------------------------------------------------
    // 4. Immutable Audit History Verification
    // ------------------------------------------------------------------
    currentAuthUser = null;
    assert.equal((await auditRoute.GET(new Request(`https://strovyn.com/api/admin/insights/${articleId}/audit`), { params: Promise.resolve({ id: articleId }) })).status, 401);

    currentAuthUser = identities.editor;
    const auditRes = await auditRoute.GET(
      new Request(`https://strovyn.com/api/admin/insights/${articleId}/audit`),
      { params: Promise.resolve({ id: articleId }) }
    );
    assert.equal(auditRes.status, 200);
    const auditJson = await auditRes.json();
    assert.ok(Array.isArray(auditJson.entries) && auditJson.entries.length >= 9);
    const archivedAudit = auditJson.entries.find((e) => e.to_status === 'archived');
    assert.ok(archivedAudit);
    assert.equal(archivedAudit.actor_email, identities.admin.email);
    assert.equal(archivedAudit.actor_role, 'admin');
    assert.equal(archivedAudit.note, 'Superseded edition.');

    // Verify audit immutability across DB roles
    for (const role of ['anon', 'authenticated', 'service_role']) {
      for (const [opName, sql] of [
        ['UPDATE', `UPDATE public.article_audit_log SET note = 'tampered' WHERE article_id = $1::uuid`],
        ['DELETE', `DELETE FROM public.article_audit_log WHERE article_id = $1::uuid`],
      ]) {
        await db.exec('BEGIN');
        try {
          await db.exec(`SET LOCAL ROLE ${role}`);
          await assert.rejects(
            () => db.query(sql, [articleId]),
            /permission denied/i,
            `${role} must not ${opName} article_audit_log`
          );
        } finally {
          await db.exec('ROLLBACK');
        }
      }
    }

    // ------------------------------------------------------------------
    // 5. UI Source Integrity & Client Security Checks
    // ------------------------------------------------------------------
    const previewPageSrc = fs.readFileSync(
      path.join(REPO_ROOT, 'src/app/admin/insights/preview/[id]/page.tsx'),
      'utf8'
    );
    assert.ok(previewPageSrc.includes('/admin/insights/articles/${preview.id}'));
    assert.ok(previewPageSrc.includes('requireStaffSession'));

    const workflowSrc = fs.readFileSync(
      path.join(REPO_ROOT, 'src/components/cms/AdminWorkflowControls.tsx'),
      'utf8'
    );
    assert.ok(workflowSrc.includes('isDirty'));
    assert.ok(workflowSrc.includes('expected_updated_at'));
    assert.ok(workflowSrc.includes('requiresExplicitAcknowledge'));

    for (const rel of [
      'src/components/cms/AdminWorkflowControls.tsx',
      'src/components/cms/AdminAuditHistoryPanel.tsx',
      'src/components/cms/AdminArticleEditor.tsx',
    ]) {
      const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      assert.equal(src.includes('serviceRole'), false, `${rel} must not reference serviceRole`);
      assert.equal(src.includes('server-only'), false, `${rel} must not import server-only`);
      assert.equal(src.includes('SUPABASE_SERVICE_ROLE_KEY'), false);
    }

    console.log('ALL CMS-3 STAGE 3 TESTS PASSED');
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
