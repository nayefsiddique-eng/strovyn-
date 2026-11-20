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
      this.orExpr = null;
      this.selectCols = '*';
      this.countMode = null;
      this.orderBy = null;
      this.rangeWindow = null;
      this.limitVal = null;
      this.expectSingle = false;
      this.expectMaybeSingle = false;
    }

    select(cols = '*', opts = {}) {
      if (this.op !== 'insert' && this.op !== 'update' && this.op !== 'delete') {
        this.op = 'select';
      }
      this.selectCols = cols;
      this.countMode = opts?.count ?? null;
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

    or(expr) {
      this.orExpr = expr;
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
      if (this.orExpr) {
        const orParts = [];
        for (const seg of this.orExpr.split(',')) {
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
        let limitSql = '';
        if (this.rangeWindow) {
          const limit = this.rangeWindow.to - this.rangeWindow.from + 1;
          limitSql = `LIMIT ${Number(limit)} OFFSET ${Number(this.rangeWindow.from)}`;
        } else if (this.limitVal) {
          limitSql = `LIMIT ${Number(this.limitVal)}`;
        }

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
          if (res.rows.length !== 1) {
            return { data: null, error: { message: 'Expected single row' } };
          }
          return { data: res.rows[0], error: null };
        }
        if (this.expectMaybeSingle) {
          return { data: res.rows[0] ?? null, error: null };
        }
        return { data: res.rows, count: totalCount, error: null };
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
        throw new Error(`Unexpected RPC ${fnName}`);
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

function makeMediaFormReq(method, url, fileBuffer, fileName, mimeType, altText, articleId, { origin = 'https://strovyn.com', host = 'strovyn.com' } = {}) {
  const form = new FormData();
  if (fileBuffer) {
    form.append('file', new File([fileBuffer], fileName, { type: mimeType }));
  }
  if (altText !== undefined) {
    form.append('altText', altText);
  }
  if (articleId) {
    form.append('articleId', articleId);
  }
  const headers = new Headers();
  if (host) headers.set('host', host);
  if (origin) headers.set('origin', origin);
  return {
    method,
    url,
    headers,
    async formData() {
      return form;
    },
  };
}

async function run() {
  console.log('=== CMS-3 Stage 2 Draft Creation, Editor, Concurrency & Media Tests ===');

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
    editorA: { id: '20000000-0000-4000-8000-000000000001', email: 'editor-a@strovyn.invalid' },
    editorB: { id: '20000000-0000-4000-8000-000000000002', email: 'editor-b@strovyn.invalid' },
    publisher: { id: '20000000-0000-4000-8000-000000000003', email: 'pub@strovyn.invalid' },
    outsider: { id: '20000000-0000-4000-8000-000000000099', email: 'outsider@strovyn.invalid' },
  };

  await db.query(
    `INSERT INTO public.staff_users (auth_user_id, email, full_name, role, is_active) VALUES
     ($1, $2, 'Editor One', 'editor', TRUE),
     ($3, $4, 'Editor Two', 'editor', TRUE),
     ($5, $6, 'Publisher Lead', 'publisher', TRUE)`,
    [
      identities.editorA.id,
      identities.editorA.email,
      identities.editorB.id,
      identities.editorB.email,
      identities.publisher.id,
      identities.publisher.email,
    ]
  );

  let currentAuthUser = null;

  const mockModules = {
    'server-only': {},
    '@/lib/supabase/serviceRole': {
      isCmsSupabaseConfigured: () => true,
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
    const editorHelpers = loadProjectTsModule('src/lib/cms/editorHelpers.ts', mockModules);
    const insightsRoute = loadProjectTsModule('src/app/api/admin/insights/route.ts', mockModules);
    const articleIdRoute = loadProjectTsModule('src/app/api/admin/insights/[id]/route.ts', mockModules);
    const mediaRoute = loadProjectTsModule('src/app/api/admin/insights/media/route.ts', mockModules);
    const mediaIdRoute = loadProjectTsModule('src/app/api/admin/insights/media/[id]/route.ts', mockModules);
    const { getSecureArticlePreview } = loadProjectTsModule('src/lib/cms/editorialService.ts', mockModules);

    // ------------------------------------------------------------------
    // 1. Draft Creation, Duplicate Slug Rejection & Validation Errors
    // ------------------------------------------------------------------
    currentAuthUser = null;
    const unauthCreate = await insightsRoute.POST(
      makeReq('POST', 'https://strovyn.com/api/admin/insights', {
        title: 'Unauthorized Draft Attempt',
        category: 'Paint Chemistry',
        excerpt: 'At least twenty characters of abstract copy here.',
        content_json: editorHelpers.buildStarterTiptapDoc(),
      })
    );
    assert.equal(unauthCreate.status, 401);

    currentAuthUser = identities.editorA;
    const shortExcerptRes = await insightsRoute.POST(
      makeReq('POST', 'https://strovyn.com/api/admin/insights', {
        title: 'Valid Draft Title Line',
        slug: 'valid-draft-stage2',
        category: 'Paint Chemistry',
        excerpt: 'Too short',
        content_json: editorHelpers.buildStarterTiptapDoc('Valid opening copy over twenty characters long.'),
      })
    );
    assert.equal(shortExcerptRes.status, 400);

    const createPayload = {
      title: 'Silicate Primers on Aged Lime Render',
      slug: 'silicate-primers-aged-lime-render',
      category: 'Paint Chemistry',
      excerpt: 'Technical specification guide covering potassium silicate consolidation across porous substrates.',
      content_json: editorHelpers.buildStarterTiptapDoc(
        'Porous mineral substrates require moisture equilibration and alkaline priming before finishing coats.'
      ),
      author_name: 'Editor One',
      author_role: 'Technical Specialist',
    };

    const createdRes = await insightsRoute.POST(
      makeReq('POST', 'https://strovyn.com/api/admin/insights', createPayload)
    );
    assert.equal(createdRes.status, 201);
    const createdJson = await createdRes.json();
    const createdArticle = createdJson.article;
    assert.equal(createdArticle.status, 'draft');
    assert.equal(createdArticle.slug, 'silicate-primers-aged-lime-render');

    // Duplicate slug attempt must fail with 409 CONFLICT
    const dupRes = await insightsRoute.POST(
      makeReq('POST', 'https://strovyn.com/api/admin/insights', createPayload)
    );
    assert.equal(dupRes.status, 409);

    // ------------------------------------------------------------------
    // 2. Private Media Access Control, Upload, Preview & Canonical Persistence
    // ------------------------------------------------------------------
    currentAuthUser = identities.outsider;
    const outsiderMediaList = await mediaRoute.GET(
      new Request(`https://strovyn.com/api/admin/insights/media?articleId=${createdArticle.id}`)
    );
    assert.equal(outsiderMediaList.status, 403);

    currentAuthUser = null;
    const unauthUpload = await mediaRoute.POST(
      makeMediaFormReq('POST', 'https://strovyn.com/api/admin/insights/media', makeValidPngBuffer(), 'test.png', 'image/png', 'Clean alt text', createdArticle.id)
    );
    assert.equal(unauthUpload.status, 401);

    currentAuthUser = identities.editorA;
    const uploadRes = await mediaRoute.POST(
      makeMediaFormReq(
        'POST',
        'https://strovyn.com/api/admin/insights/media',
        makeValidPngBuffer(1200, 800),
        'silicate-cross-section.png',
        'image/png',
        'Microscopic potassium silicate crystallisation inside masonry pore',
        createdArticle.id
      )
    );
    assert.equal(uploadRes.status, 201);
    const uploadedAsset = (await uploadRes.json()).asset;
    assert.ok(uploadedAsset.media_ref.startsWith('/api/editorial-media/'));
    assert.ok(uploadedAsset.staff_preview_url.startsWith('/api/admin/insights/media/'));

    // Visual preview helper maps canonical -> staff preview without modifying canonical refs
    assert.equal(
      editorHelpers.resolveEditorPreviewImageSrc(uploadedAsset.media_ref),
      uploadedAsset.staff_preview_url
    );
    assert.equal(
      editorHelpers.resolveEditorPreviewImageSrc('/images/sample.jpg'),
      '/images/sample.jpg'
    );

    // Authenticated staff media GET works cleanly; unauthenticated is rejected
    const staffMediaGet = await mediaIdRoute.GET(
      new Request(`https://strovyn.com/api/admin/insights/media/${uploadedAsset.id}?format=json`),
      { params: Promise.resolve({ id: uploadedAsset.id }) }
    );
    assert.equal(staffMediaGet.status, 200);
    const staffMediaJson = await staffMediaGet.json();
    assert.ok(staffMediaJson.signedUrl.includes('/storage/v1/object/sign/editorial-media/'));

    currentAuthUser = null;
    const unauthMediaGet = await mediaIdRoute.GET(
      new Request(`https://strovyn.com/api/admin/insights/media/${uploadedAsset.id}`),
      { params: Promise.resolve({ id: uploadedAsset.id }) }
    );
    assert.equal(unauthMediaGet.status, 401);
    currentAuthUser = identities.editorA;

    // ------------------------------------------------------------------
    // 3. Editor Helpers: Unsaved Change Detection, Patch Diff & Conflict Flow
    // ------------------------------------------------------------------
    const baselineA = editorHelpers.extractEditableSnapshot(createdArticle);
    assert.equal(editorHelpers.isArticleFormDirty(baselineA, { ...baselineA }), false);
    assert.equal(
      editorHelpers.buildArticlePatchPayload(baselineA, { ...baselineA }, createdArticle.updated_at),
      null
    );

    const editedByA = {
      ...baselineA,
      featured_image_url: uploadedAsset.media_ref,
      featured_image_alt: uploadedAsset.alt_text,
      og_image_url: uploadedAsset.media_ref,
      seo_title: 'Silicate Primers on Aged Lime Render',
      content_json: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Updated silicate substrate notes prepared cleanly by Editor One.' }],
          },
          {
            type: 'image',
            attrs: {
              src: uploadedAsset.media_ref,
              alt: uploadedAsset.alt_text,
            },
          },
        ],
      },
    };
    assert.equal(editorHelpers.isArticleFormDirty(baselineA, editedByA), true);

    // Attempting to save staff_preview_url directly MUST be rejected cleanly on client + server
    const badMediaDraft = { ...editedByA, featured_image_url: uploadedAsset.staff_preview_url };
    assert.match(editorHelpers.validateEditableArticleClient(badMediaDraft) || '', /Staff preview media URLs/i);
    const badPatchServer = await articleIdRoute.PATCH(
      makeReq('PATCH', `https://strovyn.com/api/admin/insights/${createdArticle.id}`, {
        featured_image_url: uploadedAsset.staff_preview_url,
        expected_updated_at: createdArticle.updated_at,
      }),
      { params: Promise.resolve({ id: createdArticle.id }) }
    );
    assert.equal(badPatchServer.status, 400);

    // Valid PATCH by Editor A using canonical `/api/editorial-media/<uuid>`
    const patchPayloadA = editorHelpers.buildArticlePatchPayload(
      baselineA,
      editedByA,
      createdArticle.updated_at
    );
    const saveARes = await articleIdRoute.PATCH(
      makeReq('PATCH', `https://strovyn.com/api/admin/insights/${createdArticle.id}`, patchPayloadA),
      { params: Promise.resolve({ id: createdArticle.id }) }
    );
    assert.equal(saveARes.status, 200);
    const savedA = (await saveARes.json()).article;
    assert.equal(savedA.featured_image_url, uploadedAsset.media_ref);

    // Verify PostgreSQL stored ONLY canonical `/api/editorial-media/<uuid>` URLs
    const dbPersisted = (
      await db.query(
        `SELECT featured_image_url, og_image_url, content_json::text AS cj, content_html FROM public.articles WHERE id = $1`,
        [createdArticle.id]
      )
    ).rows[0];
    assert.equal(dbPersisted.featured_image_url, uploadedAsset.media_ref);
    assert.equal(dbPersisted.og_image_url, uploadedAsset.media_ref);
    assert.ok(dbPersisted.cj.includes(uploadedAsset.media_ref));
    assert.ok(dbPersisted.content_html.includes(uploadedAsset.media_ref));
    assert.equal(dbPersisted.cj.includes('/api/admin/insights/media/'), false);
    assert.equal(dbPersisted.cj.includes('/storage/v1/object/'), false);

    // Existing preview service resolves canonical refs to signed URLs cleanly without altering DB
    const previewPayload = await getSecureArticlePreview(createdArticle.id);
    assert.ok(previewPayload.featured_image_url.includes('/storage/v1/object/sign/editorial-media/'));
    assert.ok(previewPayload.sanitizedHtml.includes('/storage/v1/object/sign/editorial-media/'));

    // Editor B attempts stale save using initial `createdArticle.updated_at` -> 409 CONFLICT!
    currentAuthUser = identities.editorB;
    const editedByB = {
      ...baselineA,
      title: 'Conflicting Headline From Editor Two',
    };
    const stalePatchB = editorHelpers.buildArticlePatchPayload(
      baselineA,
      editedByB,
      createdArticle.updated_at
    );
    const conflictRes = await articleIdRoute.PATCH(
      makeReq('PATCH', `https://strovyn.com/api/admin/insights/${createdArticle.id}`, stalePatchB),
      { params: Promise.resolve({ id: createdArticle.id }) }
    );
    assert.equal(conflictRes.status, 409, 'Stale expected_updated_at must return 409 CONFLICT');

    // Confirm Editor A's title remained intact (never silently overwritten!)
    const afterConflictCheck = (
      await db.query(`SELECT title, updated_at FROM public.articles WHERE id = $1`, [createdArticle.id])
    ).rows[0];
    assert.equal(afterConflictCheck.title, createdArticle.title);

    // Rebase Editor B onto latest server snapshot + timestamp -> succeeds cleanly!
    const latestFromServerRes = await articleIdRoute.GET(
      new Request(`https://strovyn.com/api/admin/insights/${createdArticle.id}`),
      { params: Promise.resolve({ id: createdArticle.id }) }
    );
    assert.equal(latestFromServerRes.status, 200);
    const latestServerArticle = (await latestFromServerRes.json()).article;
    const rebasedPatchB = editorHelpers.buildArticlePatchPayload(
      editorHelpers.extractEditableSnapshot(latestServerArticle),
      { ...editorHelpers.extractEditableSnapshot(latestServerArticle), title: 'Reconciled Co-Authored Headline' },
      latestServerArticle.updated_at
    );
    const reconciledRes = await articleIdRoute.PATCH(
      makeReq('PATCH', `https://strovyn.com/api/admin/insights/${createdArticle.id}`, rebasedPatchB),
      { params: Promise.resolve({ id: createdArticle.id }) }
    );
    assert.equal(reconciledRes.status, 200);
    assert.equal((await reconciledRes.json()).article.title, 'Reconciled Co-Authored Headline');

    // Referenced media asset CANNOT be deleted (409 CONFLICT)
    const delReferencedRes = await mediaRoute.DELETE(
      makeReq('DELETE', `https://strovyn.com/api/admin/insights/media?id=${uploadedAsset.id}`)
    );
    assert.equal(delReferencedRes.status, 409);

    // Unreferenced orphan asset CAN be uploaded & cleanly deleted (200)
    const orphanUpload = await mediaRoute.POST(
      makeMediaFormReq(
        'POST',
        'https://strovyn.com/api/admin/insights/media',
        makeValidPngBuffer(400, 400),
        'unused-swatch.png',
        'image/png',
        'Unused sample swatch texture',
        createdArticle.id
      )
    );
    assert.equal(orphanUpload.status, 201);
    const orphanAsset = (await orphanUpload.json()).asset;
    const delOrphanRes = await mediaRoute.DELETE(
      makeReq('DELETE', `https://strovyn.com/api/admin/insights/media?id=${orphanAsset.id}`)
    );
    assert.equal(delOrphanRes.status, 200);

    // ------------------------------------------------------------------
    // 4. Role-Based Edit Lock Enforcement (`editor` blocked on published)
    // ------------------------------------------------------------------
    const publishedArticle = (
      await db.query(`SELECT id, updated_at, title FROM public.articles WHERE status = 'published' LIMIT 1`)
    ).rows[0];
    assert.ok(publishedArticle, 'Seeded published article must exist');
    assert.equal(editorHelpers.canStaffEditArticle('editor', 'published'), false);

    currentAuthUser = identities.editorA;
    const editorEditPublished = await articleIdRoute.PATCH(
      makeReq('PATCH', `https://strovyn.com/api/admin/insights/${publishedArticle.id}`, {
        title: 'Unauthorized Live Edit By Editor',
        expected_updated_at: new Date(publishedArticle.updated_at).toISOString(),
      }),
      { params: Promise.resolve({ id: publishedArticle.id }) }
    );
    assert.equal(editorEditPublished.status, 403);

    // ------------------------------------------------------------------
    // 5. Client Boundary, Dirty-State & NodeView Canonical Verification
    // ------------------------------------------------------------------
    const postgresImageBaseline = editorHelpers.extractEditableSnapshot({
      ...latestServerArticle,
      content_json: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ text: 'Mineral silicate coating specification.', type: 'text' }],
          },
          {
            type: 'image',
            attrs: {
              alt: 'Mineral coating finish sample',
              src: uploadedAsset.media_ref,
            },
          },
          { type: 'paragraph', content: [] },
        ],
      },
    });
    const tiptapNormalizedDraft = {
      ...postgresImageBaseline,
      content_json: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { textAlign: null },
            content: [{ type: 'text', text: 'Mineral silicate coating specification.' }],
          },
          {
            type: 'image',
            attrs: {
              src: uploadedAsset.media_ref,
              alt: 'Mineral coating finish sample',
              title: null,
              width: null,
              height: null,
            },
          },
          { type: 'paragraph', attrs: { textAlign: null } },
        ],
      },
    };
    assert.equal(
      editorHelpers.isArticleFormDirty(postgresImageBaseline, tiptapNormalizedDraft),
      false,
      'Tiptap getJSON default null attrs and Postgres JSONB key ordering must remain clean'
    );
    assert.equal(
      editorHelpers.buildArticlePatchPayload(
        postgresImageBaseline,
        tiptapNormalizedDraft,
        latestServerArticle.updated_at
      ),
      null,
      'Equivalent canonical Tiptap doc must not emit a dirty PATCH payload'
    );

    const realImageEditDraft = {
      ...postgresImageBaseline,
      content_json: {
        ...tiptapNormalizedDraft.content_json,
        content: [
          ...tiptapNormalizedDraft.content_json.content,
          {
            type: 'paragraph',
            attrs: { textAlign: 'left' },
            content: [{ type: 'text', text: 'Appended substrate preparation note.' }],
          },
        ],
      },
    };
    assert.equal(
      editorHelpers.isArticleFormDirty(postgresImageBaseline, realImageEditDraft),
      true,
      'Real document edit must mark inline-image article dirty'
    );
    const dirtyPatch = editorHelpers.buildArticlePatchPayload(
      postgresImageBaseline,
      realImageEditDraft,
      latestServerArticle.updated_at
    );
    assert.ok(dirtyPatch && dirtyPatch.content_json);
    assert.equal(
      dirtyPatch.content_json.content[1].attrs.src,
      uploadedAsset.media_ref,
      'Patch payload must retain canonical /api/editorial-media/<uuid>'
    );

    const editorCompSrc = fs.readFileSync(
      path.join(REPO_ROOT, 'src/components/cms/EditorialRichTextEditor.tsx'),
      'utf8'
    );
    assert.ok(
      editorCompSrc.includes('resolveEditorPreviewImageSrc('),
      'EditorialRichTextEditor must map visual DOM src via resolveEditorPreviewImageSrc'
    );
    assert.ok(
      editorCompSrc.includes('addNodeView()'),
      'EditorialRichTextEditor must apply preview URL strictly in NodeView DOM rather than ProseMirror attrs'
    );
    assert.ok(
      editorCompSrc.includes('setEditable(targetEditable, false)'),
      'EditorialRichTextEditor must disable emitUpdate when initializing or toggling editable mode'
    );
    assert.ok(
      editorCompSrc.includes('ignoreMutation()'),
      'EditorialRichTextEditor preview NodeView must ignore DOM telemetry mutations'
    );

    const adminEditorSrc = fs.readFileSync(
      path.join(REPO_ROOT, 'src/components/cms/AdminArticleEditor.tsx'),
      'utf8'
    );
    assert.ok(
      adminEditorSrc.includes('setPendingInsert(null)'),
      'AdminArticleEditor must clear pendingInsert when discarding or switching baseline'
    );

    const previewPageSrc = fs.readFileSync(
      path.join(REPO_ROOT, 'src/app/admin/insights/preview/[id]/page.tsx'),
      'utf8'
    );
    assert.ok(
      previewPageSrc.includes('await connection()'),
      'Preview page must establish dynamic connection() before auth session lookup'
    );

    for (const rel of [
      'src/lib/cms/editorHelpers.ts',
      'src/components/cms/NewArticleModal.tsx',
      'src/components/cms/AdminMediaLibraryDrawer.tsx',
      'src/components/cms/AdminArticleEditor.tsx',
      'src/components/cms/EditorialRichTextEditor.tsx',
    ]) {
      const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      assert.equal(src.includes('serviceRole'), false, `${rel} must not reference serviceRole`);
      assert.equal(src.includes('server-only'), false, `${rel} must not import server-only`);
      assert.equal(src.includes('SUPABASE_SERVICE_ROLE_KEY'), false);
    }

    console.log('ALL CMS-3 STAGE 2 TESTS PASSED');
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
