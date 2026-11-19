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

const sql001 = fs.readFileSync(path.join(MIGRATIONS_DIR, '001_initial_schema.sql'), 'utf8');
const sql002 = fs.readFileSync(path.join(MIGRATIONS_DIR, '002_idempotency_and_hardening.sql'), 'utf8');
const sql003 = fs.readFileSync(path.join(MIGRATIONS_DIR, '003_editorial_cms.sql'), 'utf8');
const sql004 = fs.readFileSync(path.join(MIGRATIONS_DIR, '004_editorial_cms_hardening.sql'), 'utf8');
const sql005 = fs.readFileSync(path.join(MIGRATIONS_DIR, '005_editorial_media_and_bucket.sql'), 'utf8');
const sql006 = fs.readFileSync(path.join(MIGRATIONS_DIR, '006_editorial_media_privacy.sql'), 'utf8');
const sql007 = fs.readFileSync(path.join(MIGRATIONS_DIR, '007_editorial_media_gated_delivery.sql'), 'utf8');

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

function makeValidJpegBuffer(width = 1024, height = 768) {
  const buf = Buffer.alloc(23);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  buf[3] = 0xe0;
  buf.writeUInt16BE(4, 4);
  buf[8] = 0xff;
  buf[9] = 0xc0;
  buf.writeUInt16BE(11, 10);
  buf[12] = 8;
  buf.writeUInt16BE(height, 13);
  buf.writeUInt16BE(width, 15);
  buf[17] = 3;
  buf[21] = 0xff;
  buf[22] = 0xd9;
  return buf;
}

function makeValidWebpBuffer(width = 800, height = 600) {
  const buf = Buffer.alloc(32);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(24, 4);
  buf.write('WEBP', 8, 'ascii');
  buf.write('VP8X', 12, 'ascii');
  buf.writeUInt32LE(10, 16);
  buf.writeUIntLE(width - 1, 24, 3);
  buf.writeUIntLE(height - 1, 27, 3);
  return buf;
}

/**
 * PGlite-backed Supabase service-role + multi-bucket Storage simulator.
 * Enforces `storage.buckets.public` privacy on anonymous fetches and supports
 * fault-injection hooks for audit/cleanup/promotion failure testing.
 */
function createPgliteSupabaseAdapter(db, supabaseBaseUrl) {
  const bucketObjects = new Map([
    ['editorial-media', new Map()],
    ['editorial-media-public', new Map()],
  ]);
  const bucketAccessLog = [];
  const faultHooks = {
    beforeTableOp: null, // (table, op, payload) => ({ error? } | throw)
    beforeStorageOp: null, // (bucket, op, storagePath) => ({ error? } | throw)
    beforeRpc: null, // (fnName, args) => ({ error? } | throw)
  };

  class QueryBuilder {
    constructor(table) {
      this.table = table;
      this.op = 'select';
      this.selectCols = '*';
      this.countMode = null;
      this.filters = [];
      this.orExpr = null;
      this.orderBy = null;
      this.rangeWindow = null;
      this.limitVal = null;
      this.payload = null;
      this.expectSingle = false;
      this.expectMaybeSingle = false;
      this.returnAfterMutation = false;
    }

    select(cols = '*', opts = {}) {
      if (this.op === 'insert' || this.op === 'update' || this.op === 'delete') {
        this.returnAfterMutation = true;
        this.selectCols = cols;
        return this;
      }
      this.op = 'select';
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

    delete() {
      this.op = 'delete';
      return this;
    }

    eq(col, val) {
      this.filters.push({ kind: 'eq', col, val });
      return this;
    }

    neq(col, val) {
      this.filters.push({ kind: 'neq', col, val });
      return this;
    }

    in(col, vals) {
      this.filters.push({ kind: 'in', col, val: vals });
      return this;
    }

    is(col, val) {
      this.filters.push({ kind: 'is', col, val });
      return this;
    }

    or(expr) {
      this.orExpr = expr;
      return this;
    }

    order(col, opts = {}) {
      this.orderBy = { col, asc: opts.ascending !== false };
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
      return this.execute();
    }

    maybeSingle() {
      this.expectMaybeSingle = true;
      return this.execute();
    }

    then(resolve, reject) {
      return this.execute().then(resolve, reject);
    }

    buildWhere(params) {
      const clauses = [];
      for (const f of this.filters) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(f.col)) {
          throw new Error(`Unsafe column identifier: ${f.col}`);
        }
        if (f.kind === 'eq') {
          params.push(f.val);
          clauses.push(`"${f.col}" = $${params.length}`);
        } else if (f.kind === 'neq') {
          params.push(f.val);
          clauses.push(`"${f.col}" <> $${params.length}`);
        } else if (f.kind === 'in') {
          if (!Array.isArray(f.val) || f.val.length === 0) {
            clauses.push('FALSE');
          } else {
            const ph = f.val.map((v) => {
              params.push(v);
              return `$${params.length}`;
            });
            clauses.push(`"${f.col}" IN (${ph.join(', ')})`);
          }
        } else if (f.kind === 'is') {
          if (f.val === null) clauses.push(`"${f.col}" IS NULL`);
          else clauses.push(`"${f.col}" IS ${Boolean(f.val) ? 'TRUE' : 'FALSE'}`);
        }
      }

      if (this.orExpr) {
        const sub = [];
        for (const part of this.orExpr.split(',')) {
          const m = part.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\.ilike\.(.+)$/);
          if (m) {
            params.push(m[2]);
            sub.push(`"${m[1]}" ILIKE $${params.length}`);
          }
        }
        if (sub.length > 0) {
          clauses.push(`(${sub.join(' OR ')})`);
        }
      }

      return clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    }

    async execute() {
      if (faultHooks.beforeTableOp) {
        const hooked = await faultHooks.beforeTableOp(this.table, this.op, this.payload);
        if (hooked?.error) {
          return { data: null, error: hooked.error };
        }
      }

      try {
        return await db.transaction(async (tx) => {
          await tx.exec('SET LOCAL ROLE service_role');
          const params = [];
          const colsSql =
            this.selectCols === '*'
              ? '*'
              : this.selectCols
                  .split(',')
                  .map((c) => `"${c.trim()}"`)
                  .join(', ');

          if (this.op === 'select') {
            const whereSql = this.buildWhere(params);
            let count = null;
            if (this.countMode === 'exact') {
              const cntRes = await tx.query(
                `SELECT COUNT(*)::int AS c FROM "public"."${this.table}" ${whereSql}`,
                params
              );
              count = cntRes.rows[0].c;
            }
            const orderSql = this.orderBy
              ? `ORDER BY "${this.orderBy.col}" ${this.orderBy.asc ? 'ASC' : 'DESC'}`
              : '';
            let limitSql = '';
            if (this.rangeWindow) {
              const lim = this.rangeWindow.to - this.rangeWindow.from + 1;
              limitSql = `LIMIT ${lim} OFFSET ${this.rangeWindow.from}`;
            } else if (this.limitVal !== null) {
              limitSql = `LIMIT ${this.limitVal}`;
            }
            const res = await tx.query(
              `SELECT ${colsSql} FROM "public"."${this.table}" ${whereSql} ${orderSql} ${limitSql}`,
              params
            );
            if (this.expectSingle) {
              if (res.rows.length !== 1) return { data: null, error: { message: 'Expected 1 row' } };
              return { data: res.rows[0], count, error: null };
            }
            if (this.expectMaybeSingle) {
              return { data: res.rows[0] ?? null, count, error: null };
            }
            return { data: res.rows, count, error: null };
          }

          if (this.op === 'insert') {
            const keys = Object.keys(this.payload);
            const placeholders = keys.map((k, idx) => {
              const v = this.payload[k];
              params.push(k === 'content_json' || k === 'metadata' ? JSON.stringify(v) : v);
              return `$${idx + 1}`;
            });
            const returning = this.returnAfterMutation ? `RETURNING ${colsSql}` : 'RETURNING *';
            const sql = `INSERT INTO "public"."${this.table}" (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${placeholders.join(', ')}) ${returning}`;
            const res = await tx.query(sql, params);
            if (this.expectSingle) return { data: res.rows[0], error: null };
            return { data: res.rows, error: null };
          }

          if (this.op === 'update') {
            const keys = Object.keys(this.payload);
            const sets = keys.map((k) => {
              const v = this.payload[k];
              params.push(k === 'content_json' || k === 'metadata' ? JSON.stringify(v) : v);
              return `"${k}" = $${params.length}`;
            });
            const whereSql = this.buildWhere(params);
            const returning = this.returnAfterMutation ? `RETURNING ${colsSql}` : 'RETURNING *';
            const sql = `UPDATE "public"."${this.table}" SET ${sets.join(', ')} ${whereSql} ${returning}`;
            const res = await tx.query(sql, params);
            if (this.expectSingle) return { data: res.rows[0], error: null };
            return { data: res.rows, error: null };
          }

          if (this.op === 'delete') {
            const whereSql = this.buildWhere(params);
            const returning = this.returnAfterMutation ? `RETURNING ${colsSql}` : '';
            const sql = `DELETE FROM "public"."${this.table}" ${whereSql} ${returning}`;
            const res = await tx.query(sql, params);
            return { data: res.rows, error: null };
          }

          return { data: null, error: null };
        });
      } catch (err) {
        return { data: null, error: { code: err.code, message: err.message } };
      }
    }
  }

  return {
    bucketObjects,
    bucketAccessLog,
    faultHooks,
    async simulateAnonymousPublicObjectFetch(bucket, storagePath) {
      const bRes = (
        await db.query(`SELECT public FROM storage.buckets WHERE id = $1`, [bucket])
      ).rows[0];
      if (!bRes || bRes.public !== true) {
        return { status: 403, error: 'Bucket is private; anonymous GET forbidden' };
      }
      const obj = bucketObjects.get(bucket)?.get(storagePath);
      if (!obj) {
        return { status: 404, error: 'Object not found' };
      }
      return { status: 200, buffer: obj.buffer, contentType: obj.contentType };
    },
    client: {
      from: (table) => new QueryBuilder(table),
      rpc: async (fnName, args) => {
        if (faultHooks.beforeRpc) {
          const hooked = await faultHooks.beforeRpc(fnName, args);
          if (hooked?.error) {
            return { data: null, error: hooked.error };
          }
        }
        try {
          if (fnName === 'cms_resolve_public_editorial_media') {
            const rows = await db.transaction(async (tx) => {
              await tx.exec('SET LOCAL ROLE service_role');
              const res = await tx.query(
                `SELECT * FROM public.cms_resolve_public_editorial_media($1::uuid)`,
                [args.p_asset_id]
              );
              return res.rows;
            });
            return { data: rows, error: null };
          }
          if (fnName !== 'cms_transition_article_status') {
            throw new Error(`Unexpected RPC: ${fnName}`);
          }
          const rows = await db.transaction(async (tx) => {
            await tx.exec('SET LOCAL ROLE service_role');
            const res = await tx.query(
              `SELECT * FROM public.cms_transition_article_status($1::uuid, $2::text, $3::uuid, $4::text, $5::timestamptz, $6::text)`,
              [
                args.p_article_id,
                args.p_to_status,
                args.p_actor_staff_id,
                args.p_actor_type,
                args.p_scheduled_at,
                args.p_note,
              ]
            );
            return res.rows;
          });
          return { data: rows[0], error: null };
        } catch (err) {
          return { data: null, error: { code: err.code, message: err.message } };
        }
      },
      storage: {
        from: (bucket) => {
          bucketAccessLog.push(bucket);
          assert.equal(
            bucket,
            'editorial-media',
            `CMS-2.3 must strictly use private 'editorial-media' bucket only; got: ${bucket}`
          );
          const store = bucketObjects.get(bucket);
          return {
            upload: async (storagePath, buffer, opts) => {
              if (faultHooks.beforeStorageOp) {
                const hooked = await faultHooks.beforeStorageOp(bucket, 'upload', storagePath);
                if (hooked?.error) return { data: null, error: hooked.error };
              }
              if (!opts?.upsert && store.has(storagePath)) {
                return { data: null, error: { message: 'Object already exists' } };
              }
              store.set(storagePath, { buffer: Buffer.from(buffer), contentType: opts?.contentType });
              return { data: { path: storagePath }, error: null };
            },
            download: async (storagePath) => {
              if (faultHooks.beforeStorageOp) {
                const hooked = await faultHooks.beforeStorageOp(bucket, 'download', storagePath);
                if (hooked?.error) return { data: null, error: hooked.error };
              }
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
            createSignedUrl: async (storagePath, expiresIn) => {
              if (!store.has(storagePath)) {
                return { data: null, error: { message: 'Object not found for signing' } };
              }
              return {
                data: {
                  signedUrl: `${supabaseBaseUrl}/storage/v1/object/sign/${bucket}/${storagePath}?token=signed_${expiresIn}_demoToken`,
                },
                error: null,
              };
            },
            getPublicUrl: (storagePath) => ({
              data: {
                publicUrl: `${supabaseBaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`,
              },
            }),
            remove: async (paths) => {
              for (const p of paths) {
                if (faultHooks.beforeStorageOp) {
                  const hooked = await faultHooks.beforeStorageOp(bucket, 'remove', p);
                  if (hooked?.error) return { data: null, error: hooked.error };
                }
                store.delete(p);
              }
              return { data: paths, error: null };
            },
          };
        },
      },
    },
  };
}

function makeDoc(paragraphs) {
  return {
    type: 'doc',
    content: paragraphs.map((txt) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: txt }],
    })),
  };
}

function makeJsonReq(method, url, body, { origin = 'https://strovyn.com', host = 'strovyn.com' } = {}) {
  const headers = new Headers({ host });
  if (origin !== null) headers.set('origin', origin);
  if (body !== undefined) headers.set('content-type', 'application/json');
  return new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function run() {
  console.log('=== CMS-2.3 Publication-Gated Editorial Engine Integration & Security Suite ===');

  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const prevSvc = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const testSupabaseUrl = 'https://strovyntestproject.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_URL = testSupabaseUrl;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIn0.anonSignatureTest123';
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UifQ.serviceSignatureTest123';

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

  await db.exec(sql001);
  await db.exec(sql002);
  await db.exec(sql003);
  await db.exec(sql004);
  await db.exec(sql005);
  await db.exec(sql006);

  // Pre-007 backfill, 006 normalization & trigger edge-case suite (runs before 007
  // on legacy 006 rows, then resets cleanly in the same PGlite instance).
  const preStaffId = (
    await db.query(
      `INSERT INTO public.staff_users (auth_user_id, email, full_name, role, is_active)
       VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pre007@strovyn.com.au', 'Pre007 Pub', 'publisher', TRUE)
       RETURNING id`
    )
  ).rows[0].id;

  const preAsset1 = (
    await db.query(
      `INSERT INTO public.editorial_media_assets (
         bucket_id, storage_path, visibility, public_bucket_id, public_storage_path, public_url,
         mime_type, byte_size, width, height, alt_text
       ) VALUES (
         'editorial-media-public', 'articles/2026/11/pre-007.jpg', 'public', 'editorial-media-public',
         'published/x/pre-007.jpg', 'https://x.supabase.co/storage/v1/object/public/editorial-media-public/published/x/pre-007.jpg',
         'image/jpeg', 1200, 800, 600, 'Pre-007 promoted asset'
       ) RETURNING id`
    )
  ).rows[0].id;

  const preAsset2 = (
    await db.query(
      `INSERT INTO public.editorial_media_assets (
         bucket_id, storage_path, visibility, mime_type, byte_size, width, height, alt_text
       ) VALUES (
         'editorial-media', 'articles/2026/11/pre-007-multi.png', 'private',
         'image/png', 1400, 800, 600, 'Pre-007 multi-inline asset'
       ) RETURNING id`
    )
  ).rows[0].id;

  const preArtId = (
    await db.query(
      `INSERT INTO public.articles (
         title, slug, excerpt, content, content_json, content_html,
         featured_image_url, og_image_url, category, status, published_at, created_by
       ) VALUES (
         'Pre-007 Published Article', 'pre-007-published-article',
         'Existing published article created before 007 reference table existed.',
         'Body text.', $1::jsonb, '<p>Body</p>', $2, $3,
         'Surface Preparation', 'published', NOW() - INTERVAL '1 day', $4
       ) RETURNING id`,
      [
        JSON.stringify({
          type: 'doc',
          content: [
            { type: 'image', attrs: { src: `/api/editorial-media/${preAsset2}`, alt: 'First' } },
            { type: 'image', attrs: { src: `/api/editorial-media/${preAsset2}`, alt: 'Second' } },
          ],
        }),
        `/api/editorial-media/${preAsset1}`,
        `/api/admin/insights/media/${preAsset1}`,
        preStaffId,
      ]
    )
  ).rows[0].id;

  // Apply 007 twice (backfill + idempotency verification)
  await db.exec(sql007);
  await db.exec(sql007);

  const normalizedPreAsset = (
    await db.query(
      `SELECT bucket_id, visibility, public_url, public_bucket_id, public_storage_path FROM public.editorial_media_assets WHERE id = $1`,
      [preAsset1]
    )
  ).rows[0];
  assert.deepEqual(normalizedPreAsset, {
    bucket_id: 'editorial-media',
    visibility: 'private',
    public_url: null,
    public_bucket_id: null,
    public_storage_path: null,
  });

  const backfilledRefs = (
    await db.query(
      `SELECT asset_id, reference_source FROM public.article_media_references WHERE article_id = $1 ORDER BY reference_source`,
      [preArtId]
    )
  ).rows;
  assert.deepEqual(backfilledRefs, [
    { asset_id: preAsset2, reference_source: 'content_json' },
    { asset_id: preAsset1, reference_source: 'featured_image' },
    { asset_id: preAsset1, reference_source: 'og_image' },
  ]);
  assert.equal((await db.query(`SELECT * FROM public.cms_resolve_public_editorial_media($1)`, [preAsset1])).rows.length, 1);
  assert.equal((await db.query(`SELECT * FROM public.cms_resolve_public_editorial_media($1)`, [preAsset2])).rows.length, 1);

  // Removing 1 of 2 duplicate inline images preserves the reference; clearing all + malformed JSON drops all refs cleanly
  await db.query(
    `UPDATE public.articles SET featured_image_url = NULL, content_json = $1::jsonb, updated_by = $2 WHERE id = $3`,
    [
      JSON.stringify({
        type: 'doc',
        content: [{ type: 'image', attrs: { src: `/api/editorial-media/${preAsset2}`, alt: 'Remaining' } }],
      }),
      preStaffId,
      preArtId,
    ]
  );
  assert.equal((await db.query(`SELECT * FROM public.cms_resolve_public_editorial_media($1)`, [preAsset2])).rows.length, 1);

  await db.query(
    `UPDATE public.articles SET og_image_url = NULL, content_json = $1::jsonb, updated_by = $2 WHERE id = $3`,
    [JSON.stringify({ type: 'doc', content: 'malformed-not-an-array', attrs: { bad: [1, 2, 3] } }), preStaffId, preArtId]
  );
  assert.equal(
    (await db.query(`SELECT asset_id FROM public.article_media_references WHERE article_id = $1`, [preArtId])).rows.length,
    0
  );
  assert.equal((await db.query(`SELECT * FROM public.cms_resolve_public_editorial_media($1)`, [preAsset1])).rows.length, 0);
  assert.equal((await db.query(`SELECT * FROM public.cms_resolve_public_editorial_media($1)`, [preAsset2])).rows.length, 0);
  console.log('[OK] Pre-007 backfill, 006 bucket/visibility normalization, duplicate inline & malformed JSON triggers verified.');

  // Reset public schema within same single PGlite instance for clean CMS-2 integration suite
  await db.exec(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  `);
  await db.exec(sql001);
  await db.exec(sql002);
  await db.exec(sql003);
  await db.exec(sql004);
  await db.exec(sql005);
  await db.exec(sql006);
  await db.exec(sql007);

  // Verify bucket confidentiality settings in SQL `storage.buckets`:
  // BOTH buckets have `public = false` after 007 retires `editorial-media-public`.
  const bucketRows = (
    await db.query(`SELECT id, public, file_size_limit FROM storage.buckets ORDER BY id`)
  ).rows;
  assert.deepEqual(
    bucketRows.map((r) => ({ id: r.id, public: r.public, limit: Number(r.file_size_limit) })),
    [
      { id: 'editorial-media', public: false, limit: 5242880 },
      { id: 'editorial-media-public', public: false, limit: 5242880 },
    ]
  );

  // Verify anon & authenticated cannot execute gated resolver or read article_media_references
  for (const roleName of ['anon', 'authenticated']) {
    await db.transaction(async (tx) => {
      await tx.exec(`SET LOCAL ROLE ${roleName}`);
      await tx.exec('SAVEPOINT sp_priv1');
      await assert.rejects(async () => {
        try {
          await tx.query(`SELECT * FROM public.article_media_references`);
        } catch (err) {
          await tx.exec('ROLLBACK TO SAVEPOINT sp_priv1');
          throw err;
        }
      });
      await tx.exec('SAVEPOINT sp_priv2');
      await assert.rejects(async () => {
        try {
          await tx.query(
            `SELECT * FROM public.cms_resolve_public_editorial_media('11111111-1111-4111-8111-111111111111')`
          );
        } catch (err) {
          await tx.exec('ROLLBACK TO SAVEPOINT sp_priv2');
          throw err;
        }
      });
    });
  }
  console.log('[OK] Migrations 001 -> 007 executed in PGlite; single private bucket & gated RPC privileges verified.');

  const staffRows = (
    await db.query(`
      INSERT INTO public.staff_users (auth_user_id, email, full_name, role, is_active)
      VALUES
        ('11111111-1111-4111-8111-111111111111', 'editor@strovyn.com.au', 'Jordan Editor', 'editor', TRUE),
        ('22222222-2222-4222-8222-222222222222', 'publisher@strovyn.com.au', 'Morgan Publisher', 'publisher', TRUE),
        ('33333333-3333-4333-8333-333333333333', 'admin@strovyn.com.au', 'Alex Admin', 'admin', TRUE),
        ('44444444-4444-4444-8444-444444444444', 'inactive@strovyn.com.au', 'Former Staff', 'admin', FALSE)
      RETURNING *
    `)
  ).rows;
  const staffByKey = {
    editor: staffRows[0],
    publisher: staffRows[1],
    admin: staffRows[2],
    inactive: staffRows[3],
  };

  let currentAuthUser = null;
  const adapter = createPgliteSupabaseAdapter(db, testSupabaseUrl);

  const mockModules = {
    'server-only': {},
    '@/lib/supabase/server': {
      createClient: async () => ({
        auth: {
          getUser: async () => ({
            data: { user: currentAuthUser },
            error: currentAuthUser ? null : { message: 'No session' },
          }),
        },
      }),
    },
    '@supabase/ssr': {
      createServerClient: () => ({
        auth: {
          getUser: async () => ({
            data: { user: currentAuthUser },
            error: currentAuthUser ? null : { message: 'No session' },
          }),
        },
      }),
    },
    '@supabase/supabase-js': {
      createClient: () => adapter.client,
    },
    '@/lib/security/rateLimiter': {
      checkRateLimit: async () => ({ allowed: true, remaining: 99 }),
    },
  };

  const cache = new Map();
  const contentSec = loadProjectTsModule('src/lib/cms/contentSecurity.ts', mockModules, cache);
  const mediaPolicy = loadProjectTsModule('src/lib/cms/mediaUrlPolicy.ts', mockModules, cache);
  const editorialSvc = loadProjectTsModule('src/lib/cms/editorialService.ts', mockModules, cache);
  const insightsRoute = loadProjectTsModule('src/app/api/admin/insights/route.ts', mockModules, cache);
  const articleDetailRoute = loadProjectTsModule('src/app/api/admin/insights/[id]/route.ts', mockModules, cache);
  const transitionRoute = loadProjectTsModule('src/app/api/admin/insights/[id]/transition/route.ts', mockModules, cache);
  const auditRoute = loadProjectTsModule('src/app/api/admin/insights/[id]/audit/route.ts', mockModules, cache);
  const previewRoute = loadProjectTsModule('src/app/api/admin/insights/[id]/preview/route.ts', mockModules, cache);
  const mediaRoute = loadProjectTsModule('src/app/api/admin/insights/media/route.ts', mockModules, cache);
  const mediaItemRoute = loadProjectTsModule('src/app/api/admin/insights/media/[id]/route.ts', mockModules, cache);
  const publicMediaRoute = loadProjectTsModule('src/app/api/editorial-media/[id]/route.ts', mockModules, cache);

  try {
    // -----------------------------------------------------------------------
    // 1. Auth, Proxy Preview Gate, CSRF & Config Fail-Closed Tests
    // -----------------------------------------------------------------------
    currentAuthUser = null;
    assert.equal((await insightsRoute.GET(new Request('https://strovyn.com/api/admin/insights'))).status, 401);
    assert.equal(
      (await insightsRoute.POST(makeJsonReq('POST', 'https://strovyn.com/api/admin/insights', { title: 'Test' }))).status,
      401
    );
    assert.equal(
      (
        await transitionRoute.POST(
          makeJsonReq('POST', 'https://strovyn.com/api/admin/insights/x/transition', { toStatus: 'review' }),
          { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }) }
        )
      ).status,
      401
    );
    assert.equal(
      (
        await previewRoute.GET(new Request('https://strovyn.com/api/admin/insights/x/preview'), {
          params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }),
        })
      ).status,
      401
    );
    // Authenticated media delivery endpoint rejects anonymous requests with 401
    assert.equal(
      (
        await mediaItemRoute.GET(new Request('https://strovyn.com/api/admin/insights/media/11111111-1111-4111-8111-111111111111'), {
          params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }),
        })
      ).status,
      401
    );

    // Verify Next.js 16 `proxy.ts` enforces genuine HTTP 401/403 & no-store/noindex on /admin/insights/preview/*
    const { NextRequest, NextResponse } = require('next/server');
    const proxyMod = loadProjectTsModule(
      'src/proxy.ts',
      { ...mockModules, 'next/server': { NextRequest, NextResponse } },
      new Map()
    );
    const anonProxyRes = await proxyMod.proxy(
      new NextRequest('https://strovyn.com/admin/insights/preview/11111111-1111-4111-8111-111111111111')
    );
    assert.equal(anonProxyRes.status, 401, 'SSR preview proxy MUST return real HTTP 401 when unauthenticated');
    assert.ok(anonProxyRes.headers.get('cache-control')?.includes('no-store'));
    assert.ok(anonProxyRes.headers.get('x-robots-tag')?.includes('noindex'));

    currentAuthUser = { id: staffByKey.inactive.auth_user_id, email: staffByKey.inactive.email };
    assert.equal((await insightsRoute.GET(new Request('https://strovyn.com/api/admin/insights'))).status, 403);
    const inactiveProxyRes = await proxyMod.proxy(
      new NextRequest('https://strovyn.com/admin/insights/preview/11111111-1111-4111-8111-111111111111')
    );
    assert.equal(inactiveProxyRes.status, 403, 'SSR preview proxy MUST return 403 for inactive staff');

    currentAuthUser = { id: '99999999-9999-4999-8999-999999999999', email: 'outsider@example.com' };
    assert.equal((await insightsRoute.GET(new Request('https://strovyn.com/api/admin/insights'))).status, 403);

    currentAuthUser = { id: staffByKey.editor.auth_user_id, email: staffByKey.editor.email };
    const staffProxyRes = await proxyMod.proxy(
      new NextRequest('https://strovyn.com/admin/insights/preview/11111111-1111-4111-8111-111111111111')
    );
    assert.equal(staffProxyRes.status, 200);
    assert.ok(staffProxyRes.headers.get('x-robots-tag')?.includes('noindex'));

    const csrfBad = await insightsRoute.POST(
      makeJsonReq('POST', 'https://strovyn.com/api/admin/insights', {}, { origin: 'https://evil.example', host: 'strovyn.com' })
    );
    assert.equal(csrfBad.status, 403);

    const savedSvcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.equal((await insightsRoute.GET(new Request('https://strovyn.com/api/admin/insights'))).status, 503);
    process.env.SUPABASE_SERVICE_ROLE_KEY = savedSvcKey;
    console.log('[OK] Auth (401/403), proxy preview HTTP gate, CSRF (403), and missing config (503) verified.');

    // -----------------------------------------------------------------------
    // 2. Real Tiptap v3 Schema Round-Trip, Single-Escaped Alt Text & XSS Checks
    // -----------------------------------------------------------------------
    const { getSchema } = require('@tiptap/core');
    const StarterKit = require('@tiptap/starter-kit').default;
    const LinkExt = require('@tiptap/extension-link').default;
    const ImageExt = require('@tiptap/extension-image').default;
    const TextAlignExt = require('@tiptap/extension-text-align').default;

    const realTiptapSchema = getSchema([
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        code: false,
        codeBlock: false,
        strike: false,
        underline: false,
        link: false,
      }),
      LinkExt.configure({
        openOnClick: false,
        autolink: false,
        HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
      }),
      ImageExt.configure({ inline: false, allowBase64: false }),
      TextAlignExt.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right'] }),
    ]);

    const realTiptapDoc = realTiptapSchema.nodes.doc.create(null, [
      realTiptapSchema.nodes.heading.create(
        { level: 2, textAlign: 'center' },
        [realTiptapSchema.text('Real Tiptap V3 Substrate Specification')]
      ),
      realTiptapSchema.nodes.paragraph.create(
        { textAlign: 'left' },
        [
          realTiptapSchema.text('Consult our '),
          realTiptapSchema.text('technical services', [
            realTiptapSchema.marks.link.create({ href: '/services', title: 'Service Standards' }),
          ]),
          realTiptapSchema.text(' or '),
          realTiptapSchema.text('external ref', [
            realTiptapSchema.marks.link.create({ href: 'https://strovyn.com/contact' }),
          ]),
          realTiptapSchema.text(' prior to substrate priming.'),
        ]
      ),
      realTiptapSchema.nodes.orderedList.create(null, [
        realTiptapSchema.nodes.listItem.create(null, [
          realTiptapSchema.nodes.paragraph.create(null, [realTiptapSchema.text('Measure moisture equilibrium first')]),
        ]),
        realTiptapSchema.nodes.listItem.create(null, [
          realTiptapSchema.nodes.paragraph.create(null, [realTiptapSchema.text('Apply breathable silicate primer')]),
        ]),
      ]),
      realTiptapSchema.nodes.image.create({
        src: '/images/architectural-paint-swatch.jpg',
        alt: `Architect's & Builder's "Level 5" <Finish>`,
      }),
    ]).toJSON();

    // Confirm Tiptap emits the real `title: null` / `type: null` attributes tested by audit
    assert.ok('title' in realTiptapDoc.content[1].content[3].marks[0].attrs);
    assert.ok('type' in realTiptapDoc.content[2].attrs);

    const realCompiled = contentSec.validateAndCompileTiptapContent(realTiptapDoc);
    assert.equal(realCompiled.ok, true, `Real Tiptap v3 doc must validate cleanly: ${realCompiled.error ?? ''}`);
    assert.ok(realCompiled.compiled.contentHtml.includes('<ol>'));
    assert.ok(realCompiled.compiled.contentHtml.includes('<h2 class="text-center">'));
    assert.ok(realCompiled.compiled.contentHtml.includes('title="Service Standards"'));
    // Alt text must NOT be double-escaped (`&amp;#39;` or `&amp;amp;`)
    assert.equal(realCompiled.compiled.contentHtml.includes('&amp;amp;'), false);
    assert.equal(realCompiled.compiled.contentHtml.includes('&amp;#39;'), false);
    assert.ok(
      realCompiled.compiled.contentHtml.includes('&amp; Builder') &&
        realCompiled.compiled.contentHtml.includes('&quot;Level 5&quot;') &&
        realCompiled.compiled.contentHtml.includes('&lt;Finish&gt;'),
      `Expected single-escaped alt text in HTML, got: ${realCompiled.compiled.contentHtml}`
    );

    const badDocs = [
      ['empty doc', { type: 'doc', content: [] }],
      ['script text', makeDoc(['Normal architectural text followed by <script>alert(1)</script>.'])],
      ['event handler text', makeDoc(['Specification with <img src=x onerror=alert(1)> payload.'])],
      ['rawHtml unsupported node', { type: 'doc', content: [{ type: 'rawHtml', html: '<script>x</script>' }] }],
      ['h1 forbidden heading', { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title heading here in article' }] }] }],
      ['javascript link href', {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Click link', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }],
      }],
      ['customer-documents image src', {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Architectural context text exceeding twenty chars.' }] },
          { type: 'image', attrs: { src: `${testSupabaseUrl}/storage/v1/object/public/customer-documents/secret.jpg`, alt: 'Customer doc' } },
        ],
      }],
      ['raw private editorial-media URL rejected in content', {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Architectural context text exceeding twenty chars.' }] },
          { type: 'image', attrs: { src: `${testSupabaseUrl}/storage/v1/object/public/editorial-media/secret.jpg`, alt: 'Private draft img' } },
        ],
      }],
      ['signed URL rejected in persistent content', {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Architectural context text exceeding twenty chars.' }] },
          { type: 'image', attrs: { src: `${testSupabaseUrl}/storage/v1/object/sign/editorial-media/a.jpg?token=abc`, alt: 'Signed img' } },
        ],
      }],
      ['unexpected link attr still rejected', {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Click', marks: [{ type: 'link', attrs: { href: '/services', evilAttr: 'x' } }] }] }],
      }],
      ['unexpected orderedList type rejected', {
        type: 'doc',
        content: [{ type: 'orderedList', attrs: { start: 1, type: 'evil' }, content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item longer than twenty characters.' }] }] }] }],
      }],
      ['extra onclick attr on paragraph', {
        type: 'doc',
        content: [{ type: 'paragraph', attrs: { onclick: 'alert(1)' }, content: [{ type: 'text', text: 'Text paragraph long enough to pass length check.' }] }],
      }],
    ];

    for (const [label, payload] of badDocs) {
      const check = contentSec.validateAndCompileTiptapContent(payload);
      assert.equal(check.ok, false, `Malicious/malformed doc must fail: ${label}`);
    }

    // Legacy plain-text fallback test (`DFT < 80 microns` preserved safely, scripts stripped)
    const legacyRes = (
      await db.query(
        `INSERT INTO public.articles (title, slug, content, excerpt, category, status, created_by)
         VALUES (
           'Legacy Technical Note',
           'legacy-technical-note',
           $1,
           'Checking plain text film thickness technical guidance safely.',
           'Paint Chemistry',
           'draft',
           $2
         )
         RETURNING id`,
        [
          'Verify dry film thickness DFT < 80 microns before recoating & avoid <script>alert(1)</script> issues.',
          staffByKey.editor.id,
        ]
      )
    ).rows[0];
    const legacyPreview = await editorialSvc.getSecureArticlePreview(legacyRes.id, adapter.client);
    assert.ok(
      legacyPreview.sanitizedHtml.includes('DFT &lt; 80 microns'),
      `Legacy plain text '<' must be escaped cleanly, got: ${legacyPreview.sanitizedHtml}`
    );
    assert.equal(legacyPreview.sanitizedHtml.includes('<script>'), false);

    // Invalid featured_image_url stored directly in DB MUST be stripped before preview output
    await db.query(
      `UPDATE public.articles SET featured_image_url = 'https://evil.example/payload.jpg' WHERE id = $1`,
      [legacyRes.id]
    );
    const badFeatPreview = await editorialSvc.getSecureArticlePreview(legacyRes.id, adapter.client);
    assert.equal(badFeatPreview.featured_image_url, null);
    console.log('[OK] Real Tiptap v3 schema, single-escaped alt, legacy DFT < 80 escaping & preview URL guard verified.');

    // -----------------------------------------------------------------------
    // 3. Editor Sync Plan & Client URL Alignment Unit Checks
    // -----------------------------------------------------------------------
    const {
      computeExternalSyncPlan,
      isSafeClientImageUrl,
    } = loadProjectTsModule(
      'src/components/cms/EditorialRichTextEditor.tsx',
      {
        ...mockModules,
        react: require('react'),
        '@tiptap/react': { EditorContent: () => null, useEditor: () => null },
        '@tiptap/starter-kit': { default: { configure: () => ({}) } },
        '@tiptap/extension-link': { default: { configure: () => ({}) } },
        '@tiptap/extension-image': { default: { configure: () => ({}) } },
        '@tiptap/extension-text-align': { default: { configure: () => ({}) } },
        'lucide-react': new Proxy({}, { get: () => () => null }),
      },
      new Map()
    );
    assert.equal(
      computeExternalSyncPlan({
        incomingSerialized: '{"a":1}',
        lastEmittedSerialized: '{"a":1}',
        lastAppliedExternalSerialized: '{"a":0}',
        currentEditorSerialized: '{"a":1}',
      }).shouldSync,
      false,
      'Parent re-echoing own emitted value must NOT overwrite editor or loop'
    );
    assert.equal(
      computeExternalSyncPlan({
        incomingSerialized: '{"a":2}',
        lastEmittedSerialized: '{"a":1}',
        lastAppliedExternalSerialized: '{"a":0}',
        currentEditorSerialized: '{"a":1}',
      }).shouldSync,
      true,
      'External reset / article switch MUST sync into editor'
    );
    assert.equal(isSafeClientImageUrl('https://evil.example/editorial-media/x.jpg'), false);
    assert.equal(isSafeClientImageUrl(`${testSupabaseUrl}/storage/v1/object/public/editorial-media/old.jpg`), false);
    assert.equal(isSafeClientImageUrl(`${testSupabaseUrl}/storage/v1/object/public/editorial-media-public/old.jpg`), false);
    assert.equal(isSafeClientImageUrl(`${testSupabaseUrl}/storage/v1/object/sign/editorial-media/a.jpg?token=t`), false);
    assert.equal(isSafeClientImageUrl('/api/admin/insights/media/11111111-1111-4111-8111-111111111111'), false);
    assert.equal(isSafeClientImageUrl('/api/editorial-media/11111111-1111-4111-8111-111111111111'), true);
    assert.equal(isSafeClientImageUrl('/images/architectural-paint-swatch.jpg'), true);
    console.log('[OK] Editor external sync logic and aligned client URL validator verified.');

    // -----------------------------------------------------------------------
    // 4. Article Creation, Private Media Upload, Signed Preview & Deletion Safety
    // -----------------------------------------------------------------------
    currentAuthUser = { id: staffByKey.editor.auth_user_id, email: staffByKey.editor.email };

    for (const forged of [
      { title: 'Forged Published', category: 'Surface Preparation', excerpt: 'Valid excerpt exceeding twenty characters cleanly.', content_json: realTiptapDoc, status: 'published' },
      { title: 'Forged Actor', category: 'Surface Preparation', excerpt: 'Valid excerpt exceeding twenty characters cleanly.', content_json: realTiptapDoc, created_by: staffByKey.admin.id },
      { title: 'Forged Role', category: 'Surface Preparation', excerpt: 'Valid excerpt exceeding twenty characters cleanly.', content_json: realTiptapDoc, role: 'admin' },
    ]) {
      assert.equal((await insightsRoute.POST(makeJsonReq('POST', 'https://strovyn.com/api/admin/insights', forged))).status, 400);
    }

    const createRes = await insightsRoute.POST(
      makeJsonReq('POST', 'https://strovyn.com/api/admin/insights', {
        title: 'Airless Finish Atomisation Standards',
        category: 'Painting Techniques',
        excerpt: 'Controlling fluid tip orifice sizing and pump pressure for uniform interior trim leveling.',
        content_json: realTiptapDoc,
      })
    );
    assert.equal(createRes.status, 201);
    const createdBody = await createRes.json();
    const articleId = createdBody.article.id;
    assert.equal(createdBody.article.status, 'draft');

    // Negative & audit-failure media upload checks
    const makeMediaPost = (fileObj, altText, targetArticleId) => {
      const fd = new FormData();
      if (fileObj) fd.append('file', fileObj);
      if (altText !== undefined) fd.append('altText', altText);
      if (targetArticleId) fd.append('articleId', targetArticleId);
      return new Request('https://strovyn.com/api/admin/insights/media', {
        method: 'POST',
        headers: { origin: 'https://strovyn.com', host: 'strovyn.com' },
        body: fd,
      });
    };

    assert.equal(
      (await mediaRoute.POST(makeMediaPost(new File([Buffer.from('MZ_BAD')], 'evil.jpg', { type: 'image/jpeg' }), 'Valid alt text'))).status,
      415
    );
    assert.equal(
      (await mediaRoute.POST(makeMediaPost(new File([makeValidPngBuffer(4, 4)], 'tiny.png', { type: 'image/png' }), 'Valid alt text'))).status,
      422
    );

    // Audit failure during upload -> MUST rollback storage object & metadata row!
    const beforePrivCount = adapter.bucketObjects.get('editorial-media').size;
    adapter.faultHooks.beforeTableOp = (table, op) => {
      if (table === 'editorial_media_audit_log' && op === 'insert') {
        return { error: { message: 'Simulated audit insert failure' } };
      }
      return null;
    };
    const failAuditUpload = await mediaRoute.POST(
      makeMediaPost(new File([makeValidPngBuffer(600, 400)], 'abort.png', { type: 'image/png' }), 'Mineral plaster coat', articleId)
    );
    assert.equal(failAuditUpload.status, 500);
    assert.equal(adapter.bucketObjects.get('editorial-media').size, beforePrivCount, 'Storage object must be cleaned up on audit error');
    assert.equal(
      (await db.query(`SELECT COUNT(*)::int AS c FROM public.editorial_media_assets WHERE article_id = $1`, [articleId])).rows[0].c,
      0
    );

    // Thrown exception during audit insert -> fails safely and rolls back storage & metadata
    adapter.faultHooks.beforeTableOp = (table, op) => {
      if (table === 'editorial_media_audit_log' && op === 'insert') {
        throw new Error('Thrown exception during audit log insert');
      }
      return null;
    };
    const thrownAuditUpload = await mediaRoute.POST(
      makeMediaPost(new File([makeValidPngBuffer(600, 400)], 'throw-abort.png', { type: 'image/png' }), 'Mineral plaster coat', articleId)
    );
    assert.equal(thrownAuditUpload.status, 500);
    assert.equal(adapter.bucketObjects.get('editorial-media').size, beforePrivCount);

    // Both audit insert failure AND cleanup remove failure -> fails cleanly without claiming success!
    adapter.faultHooks.beforeStorageOp = (bucket, op) => {
      if (op === 'remove') return { error: { message: 'Simulated remove failure' } };
      return null;
    };
    const doubleFailUpload = await mediaRoute.POST(
      makeMediaPost(new File([makeValidPngBuffer(600, 400)], 'double-abort.png', { type: 'image/png' }), 'Mineral plaster coat')
    );
    assert.equal(doubleFailUpload.status, 500);
    adapter.faultHooks.beforeTableOp = null;
    adapter.faultHooks.beforeStorageOp = null;

    // Upload valid private PNG, JPEG, and WebP assets
    const pngRes = await mediaRoute.POST(
      makeMediaPost(new File([makeValidPngBuffer(1200, 800)], 'finish-sample.png', { type: 'image/png' }), 'Matte mineral plaster closeup', articleId)
    );
    assert.equal(pngRes.status, 201);
    const pngJson = await pngRes.json();
    assert.equal(pngJson.asset.bucket_id, 'editorial-media');
    assert.equal(pngJson.asset.visibility, 'private');
    assert.equal(pngJson.asset.public_url, null, 'Private draft upload MUST NOT return a permanent public_url');
    assert.equal(pngJson.asset.media_ref, mediaPolicy.buildCanonicalEditorialMediaRef(pngJson.asset.id));
    assert.equal(pngJson.asset.staff_preview_url, mediaPolicy.buildStaffMediaPreviewRef(pngJson.asset.id));
    assert.ok(pngJson.asset.signed_preview_url?.includes('/storage/v1/object/sign/editorial-media/'));
    assert.ok(pngJson.asset.signed_expires_at);

    // Anonymous direct retrieval of private bucket object MUST fail in Storage simulation!
    const anonStorageFetch = await adapter.simulateAnonymousPublicObjectFetch('editorial-media', pngJson.asset.storage_path);
    assert.equal(anonStorageFetch.status, 403, 'Anonymous fetch on private editorial-media object must be denied');

    // Public delivery endpoint rejects unreferenced private asset with 404 + private, no-store
    const fetchPublicAsset = (assetId) =>
      publicMediaRoute.GET(new Request(`https://strovyn.com/api/editorial-media/${assetId}`), {
        params: Promise.resolve({ id: assetId }),
      });
    const orphanPublicRes = await fetchPublicAsset(pngJson.asset.id);
    assert.equal(orphanPublicRes.status, 404);
    assert.equal(orphanPublicRes.headers.get('cache-control'), 'private, no-store');

    // Authenticated media item endpoint succeeds; anonymous returns 401
    const staffMediaFetch = await mediaItemRoute.GET(
      new Request(`https://strovyn.com/api/admin/insights/media/${pngJson.asset.id}?format=json`),
      { params: Promise.resolve({ id: pngJson.asset.id }) }
    );
    assert.equal(staffMediaFetch.status, 200);
    const staffMediaJson = await staffMediaFetch.json();
    assert.ok(staffMediaJson.signedUrl.includes('/sign/editorial-media/'));
    assert.ok(staffMediaFetch.headers.get('cache-control')?.includes('no-store'));

    const jpgBuffer = makeValidJpegBuffer(1024, 768);
    const jpgRes = await mediaRoute.POST(
      makeMediaPost(new File([jpgBuffer], 'trim-joinery.jpg', { type: 'image/jpeg' }), 'Low-VOC satin enamel', articleId)
    );
    assert.equal(jpgRes.status, 201);
    const jpgAsset = (await jpgRes.json()).asset;

    const webpRes = await mediaRoute.POST(
      makeMediaPost(new File([makeValidWebpBuffer(800, 600)], 'exterior.webp', { type: 'image/webp' }), 'Exterior mineral facade', articleId)
    );
    assert.equal(webpRes.status, 201);
    const webpAsset = (await webpRes.json()).asset;

    // Test orphan deletion state machine: storage remove error -> delete_failed + no fake media_delete audit!
    adapter.faultHooks.beforeStorageOp = (bucket, op) => {
      if (op === 'remove') return { error: { message: 'Storage transient failure' } };
      return null;
    };
    const failDelRes = await mediaRoute.DELETE(
      makeJsonReq('DELETE', 'https://strovyn.com/api/admin/insights/media', { id: pngJson.asset.id })
    );
    assert.equal(failDelRes.status, 500);
    const failedAssetState = (
      await db.query(`SELECT delete_state, deleted_at FROM public.editorial_media_assets WHERE id = $1`, [pngJson.asset.id])
    ).rows[0];
    assert.equal(failedAssetState.delete_state, 'delete_failed');
    assert.equal(failedAssetState.deleted_at, null);
    const failDelAudits = (
      await db.query(`SELECT action FROM public.editorial_media_audit_log WHERE asset_id = $1`, [pngJson.asset.id])
    ).rows.map((r) => r.action);
    assert.equal(failDelAudits.includes('media_delete'), false, 'MUST NOT write media_delete when Storage remove fails');
    assert.equal(failDelAudits.includes('media_delete_failed'), true);

    // Clear fault hook and retry deletion from `delete_failed` -> succeeds!
    adapter.faultHooks.beforeStorageOp = null;
    const retryDelRes = await mediaRoute.DELETE(
      makeJsonReq('DELETE', 'https://strovyn.com/api/admin/insights/media', { id: pngJson.asset.id })
    );
    assert.equal(retryDelRes.status, 200);
    const deletedRow = (
      await db.query(`SELECT delete_state, deleted_at FROM public.editorial_media_assets WHERE id = $1`, [pngJson.asset.id])
    ).rows[0];
    assert.equal(deletedRow.delete_state, 'deleted');
    assert.ok(deletedRow.deleted_at !== null);

    // -----------------------------------------------------------------------
    // 5. Section 8 Missing-Alt Workflow Test (422) + Signed Preview + Promotion on Publish
    // -----------------------------------------------------------------------
    // Attach JPEG private media_ref WITHOUT featured_image_alt -> MUST fail submit-for-review with 422!
    const docWithPrivateImg = {
      ...realTiptapDoc,
      content: [
        ...realTiptapDoc.content,
        { type: 'image', attrs: { src: jpgAsset.media_ref, alt: 'Inline trim sample closeup' } },
      ],
    };

    const attachNoAltRes = await articleDetailRoute.PATCH(
      makeJsonReq('PATCH', `https://strovyn.com/api/admin/insights/${articleId}`, {
        featured_image_url: jpgAsset.media_ref,
        featured_image_alt: null,
        content_json: docWithPrivateImg,
      }),
      { params: Promise.resolve({ id: articleId }) }
    );
    assert.equal(attachNoAltRes.status, 200);

    // Deletion of referenced JPEG MUST fail with 409 Conflict!
    assert.equal(
      (await mediaRoute.DELETE(makeJsonReq('DELETE', 'https://strovyn.com/api/admin/insights/media', { id: jpgAsset.id }))).status,
      409
    );

    const auditsBefore422 = (
      await db.query(`SELECT COUNT(*)::int AS c FROM public.article_audit_log WHERE article_id = $1`, [articleId])
    ).rows[0].c;

    const missingAltSubmit = await transitionRoute.POST(
      makeJsonReq('POST', `https://strovyn.com/api/admin/insights/${articleId}/transition`, {
        toStatus: 'review',
      }),
      { params: Promise.resolve({ id: articleId }) }
    );
    assert.equal(missingAltSubmit.status, 422, 'Submit for review without featured_image_alt MUST fail with 422');

    const statusAfter422 = (
      await db.query(`SELECT status FROM public.articles WHERE id = $1`, [articleId])
    ).rows[0].status;
    assert.equal(statusAfter422, 'draft');
    const auditsAfter422 = (
      await db.query(`SELECT COUNT(*)::int AS c FROM public.article_audit_log WHERE article_id = $1`, [articleId])
    ).rows[0].c;
    assert.equal(auditsAfter422, auditsBefore422, 'Failed 422 transition MUST NOT insert audit row');

    // Supply valid featured_image_alt and preview BEFORE publication
    await articleDetailRoute.PATCH(
      makeJsonReq('PATCH', `https://strovyn.com/api/admin/insights/${articleId}`, {
        featured_image_alt: 'Architectural satin enamel joinery finish',
      }),
      { params: Promise.resolve({ id: articleId }) }
    );

    const previewRes = await previewRoute.GET(
      new Request(`https://strovyn.com/api/admin/insights/${articleId}/preview`),
      { params: Promise.resolve({ id: articleId }) }
    );
    assert.equal(previewRes.status, 200);
    assert.ok(previewRes.headers.get('cache-control')?.includes('no-store'));
    assert.ok(previewRes.headers.get('x-robots-tag')?.includes('noindex'));
    const previewJson = await previewRes.json();
    assert.ok(
      previewJson.article.featured_image_url.includes('/storage/v1/object/sign/editorial-media/'),
      'Staff preview must resolve private featured image into short-lived signed URL'
    );
    assert.ok(
      previewJson.article.sanitizedHtml.includes('/storage/v1/object/sign/editorial-media/'),
      'Staff preview body must resolve inline private image into short-lived signed URL'
    );

    // Draft DB still holds private media_ref, NEVER permanent public URL or expiring token!
    const storedDraftRow = (
      await db.query(`SELECT featured_image_url, status FROM public.articles WHERE id = $1`, [articleId])
    ).rows[0];
    assert.equal(storedDraftRow.featured_image_url, jpgAsset.media_ref);
    assert.equal(storedDraftRow.status, 'draft');

    // Draft article references jpgAsset -> public endpoint MUST return 404!
    assert.equal((await fetchPublicAsset(jpgAsset.id)).status, 404, 'Draft article image must return 404 publicly');

    // Editor advances draft -> review; Publisher advances review -> approved
    assert.equal(
      (
        await transitionRoute.POST(
          makeJsonReq('POST', `https://strovyn.com/api/admin/insights/${articleId}/transition`, {
            toStatus: 'review',
            note: 'Ready for review',
          }),
          { params: Promise.resolve({ id: articleId }) }
        )
      ).status,
      200
    );
    assert.equal((await fetchPublicAsset(jpgAsset.id)).status, 404, 'Review article image must return 404 publicly');

    assert.equal(
      (
        await transitionRoute.POST(
          makeJsonReq('POST', `https://strovyn.com/api/admin/insights/${articleId}/transition`, {
            toStatus: 'approved',
          }),
          { params: Promise.resolve({ id: articleId }) }
        )
      ).status,
      403
    );

    currentAuthUser = { id: staffByKey.publisher.auth_user_id, email: staffByKey.publisher.email };
    assert.equal(
      (
        await transitionRoute.POST(
          makeJsonReq('POST', `https://strovyn.com/api/admin/insights/${articleId}/transition`, {
            toStatus: 'approved',
            note: 'Approved specs',
          }),
          { params: Promise.resolve({ id: articleId }) }
        )
      ).status,
      200
    );
    assert.equal((await fetchPublicAsset(jpgAsset.id)).status, 404, 'Approved article image must return 404 publicly');

    // Deferred scheduling remains blocked (422)
    assert.equal(
      (
        await transitionRoute.POST(
          makeJsonReq('POST', `https://strovyn.com/api/admin/insights/${articleId}/transition`, {
            toStatus: 'scheduled',
          }),
          { params: Promise.resolve({ id: articleId }) }
        )
      ).status,
      422
    );

    // Publication RPC failure MUST leave article unpublished and public image returning 404!
    adapter.faultHooks.beforeRpc = (fnName) =>
      fnName === 'cms_transition_article_status'
        ? { error: { message: 'Simulated transition RPC outage' } }
        : null;
    const rpcAbortPublish = await transitionRoute.POST(
      makeJsonReq('POST', `https://strovyn.com/api/admin/insights/${articleId}/transition`, {
        toStatus: 'published',
      }),
      { params: Promise.resolve({ id: articleId }) }
    );
    assert.equal(rpcAbortPublish.status, 500);
    assert.equal(
      (await db.query(`SELECT status, published_at FROM public.articles WHERE id = $1`, [articleId])).rows[0].status,
      'approved'
    );
    assert.equal((await fetchPublicAsset(jpgAsset.id)).status, 404, 'Failed publish RPC must keep image 404');
    adapter.faultHooks.beforeRpc = null;

    // Successful publication -> database status commits `published`, ZERO bucket promotion needed!
    const pubRes = await transitionRoute.POST(
      makeJsonReq('POST', `https://strovyn.com/api/admin/insights/${articleId}/transition`, {
        toStatus: 'published',
        note: 'Go live cleanly',
      }),
      { params: Promise.resolve({ id: articleId }) }
    );
    assert.equal(pubRes.status, 200);
    const pubJson = await pubRes.json();
    assert.equal(pubJson.article.status, 'published');
    assert.ok(pubJson.article.published_at !== null);
    assert.equal(pubJson.article.featured_image_url, jpgAsset.media_ref);
    assert.ok(pubJson.article.content_html.includes(jpgAsset.media_ref));

    // Public delivery endpoint NOW streams image bytes (`200`) with `private, no-store`!
    const livePubImgRes = await fetchPublicAsset(jpgAsset.id);
    assert.equal(livePubImgRes.status, 200);
    assert.equal(livePubImgRes.headers.get('content-type'), 'image/jpeg');
    assert.equal(livePubImgRes.headers.get('cache-control'), 'private, no-store');
    assert.equal(livePubImgRes.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await livePubImgRes.arrayBuffer()), jpgBuffer);

    // Non-authoritative reference test: referencing webpAsset ONLY inside paragraph text (prose)
    // of a PUBLISHED article must NOT authorize `/api/editorial-media/<webpId>`!
    const proseMentionRes = await db.query(
      `INSERT INTO public.articles (title, slug, excerpt, content, content_json, content_html, category, status, published_at, created_by)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'Surface Preparation', 'published', NOW(), $7)
       RETURNING id`,
      [
        'Published Article With Prose Media String Only',
        'published-prose-media-string-only',
        'Verifies arbitrary text URLs never unlock gated private media assets.',
        `Mentioned path ${webpAsset.media_ref} in prose.`,
        JSON.stringify(makeDoc([`Mentioned path ${webpAsset.media_ref} in prose without an image node.`])),
        `<p>Mentioned path ${webpAsset.media_ref} in prose.</p>`,
        staffByKey.publisher.id,
      ]
    );
    assert.ok(proseMentionRes.rows[0].id);
    assert.equal(
      (await fetchPublicAsset(webpAsset.id)).status,
      404,
      'Non-authoritative prose mention must NEVER authorize public image delivery'
    );

    // Future `published_at` or `scheduled` state MUST return 404!
    await db.transaction(async (tx) => {
      await tx.query(`ALTER TABLE public.articles DISABLE TRIGGER articles_enforce_workflow`);
      await tx.query(
        `UPDATE public.articles SET status = 'scheduled', scheduled_at = NOW() + INTERVAL '1 hour', published_at = NULL WHERE id = $1`,
        [articleId]
      );
      await tx.query(`ALTER TABLE public.articles ENABLE TRIGGER articles_enforce_workflow`);
    });
    assert.equal((await fetchPublicAsset(jpgAsset.id)).status, 404, 'Scheduled article before publish time must return 404');

    // Also test `status = 'published'` with future `published_at > NOW()` -> MUST return 404!
    await db.transaction(async (tx) => {
      await tx.query(`ALTER TABLE public.articles DISABLE TRIGGER articles_enforce_workflow`);
      await tx.query(
        `UPDATE public.articles SET status = 'published', scheduled_at = NULL, published_at = NOW() + INTERVAL '2 hours' WHERE id = $1`,
        [articleId]
      );
      await tx.query(`ALTER TABLE public.articles ENABLE TRIGGER articles_enforce_workflow`);
    });
    assert.equal((await fetchPublicAsset(jpgAsset.id)).status, 404, 'Future published_at must return 404');

    // Restore live published_at <= NOW()
    await db.transaction(async (tx) => {
      await tx.query(`ALTER TABLE public.articles DISABLE TRIGGER articles_enforce_workflow`);
      await tx.query(
        `UPDATE public.articles SET status = 'published', published_at = NOW() - INTERVAL '1 minute' WHERE id = $1`,
        [articleId]
      );
      await tx.query(`ALTER TABLE public.articles ENABLE TRIGGER articles_enforce_workflow`);
    });
    assert.equal((await fetchPublicAsset(jpgAsset.id)).status, 200);

    // Asset `pending_delete` state MUST immediately return 404 even while referenced by published article!
    await db.query(`UPDATE public.editorial_media_assets SET delete_state = 'pending_delete' WHERE id = $1`, [jpgAsset.id]);
    assert.equal((await fetchPublicAsset(jpgAsset.id)).status, 404, 'pending_delete asset must return 404');
    await db.query(`UPDATE public.editorial_media_assets SET delete_state = 'active' WHERE id = $1`, [jpgAsset.id]);
    assert.equal((await fetchPublicAsset(jpgAsset.id)).status, 200);

    // Shared image scenario: Create & publish a SECOND article sharing jpgAsset.media_ref
    const sharedArticleRes = await insightsRoute.POST(
      makeJsonReq('POST', 'https://strovyn.com/api/admin/insights', {
        title: 'Shared Substrate Joinery Standard',
        category: 'Painting Techniques',
        excerpt: 'Second published article referencing the same private asset via featured_image_url.',
        content_json: realTiptapDoc,
        featured_image_url: jpgAsset.media_ref,
        featured_image_alt: 'Shared joinery finish photo',
      })
    );
    assert.equal(sharedArticleRes.status, 201);
    const sharedId = (await sharedArticleRes.json()).article.id;
    assert.equal(
      (await transitionRoute.POST(makeJsonReq('POST', `https://strovyn.com/api/admin/insights/${sharedId}/transition`, { toStatus: 'review' }), { params: Promise.resolve({ id: sharedId }) })).status,
      200
    );
    assert.equal(
      (await transitionRoute.POST(makeJsonReq('POST', `https://strovyn.com/api/admin/insights/${sharedId}/transition`, { toStatus: 'approved' }), { params: Promise.resolve({ id: sharedId }) })).status,
      200
    );
    assert.equal(
      (await transitionRoute.POST(makeJsonReq('POST', `https://strovyn.com/api/admin/insights/${sharedId}/transition`, { toStatus: 'published' }), { params: Promise.resolve({ id: sharedId }) })).status,
      200
    );

    // Archive FIRST article -> image MUST STILL be served (200) because sharedId is still published!
    assert.equal(
      (await transitionRoute.POST(makeJsonReq('POST', `https://strovyn.com/api/admin/insights/${articleId}/transition`, { toStatus: 'archived' }), { params: Promise.resolve({ id: articleId }) })).status,
      200
    );
    assert.equal(
      (await fetchPublicAsset(jpgAsset.id)).status,
      200,
      'Archiving article 1 must keep shared image accessible while article 2 stays published'
    );

    // Archive SECOND article -> NOW ZERO published articles reference jpgAsset -> MUST immediately return 404!
    assert.equal(
      (await transitionRoute.POST(makeJsonReq('POST', `https://strovyn.com/api/admin/insights/${sharedId}/transition`, { toStatus: 'archived' }), { params: Promise.resolve({ id: sharedId }) })).status,
      200
    );
    assert.equal(
      (await fetchPublicAsset(jpgAsset.id)).status,
      404,
      'Archiving last referencing published article must revoke public image delivery immediately (404)'
    );

    // Verify zero `editorial-media-public` uploads or permanent public URLs ever exist in DB or logs
    assert.equal(adapter.bucketObjects.get('editorial-media-public').size, 0);
    const assetRowFinal = (
      await db.query(`SELECT visibility, public_url FROM public.editorial_media_assets WHERE id = $1`, [jpgAsset.id])
    ).rows[0];
    assert.equal(assetRowFinal.visibility, 'private');
    assert.equal(assetRowFinal.public_url, null);

    // Restore article 1 back to published via archived -> draft -> review -> approved -> published for audit assertions
    assert.equal(
      (await transitionRoute.POST(makeJsonReq('POST', `https://strovyn.com/api/admin/insights/${articleId}/transition`, { toStatus: 'draft' }), { params: Promise.resolve({ id: articleId }) })).status,
      200
    );
    assert.equal(
      (await transitionRoute.POST(makeJsonReq('POST', `https://strovyn.com/api/admin/insights/${articleId}/transition`, { toStatus: 'review' }), { params: Promise.resolve({ id: articleId }) })).status,
      200
    );
    assert.equal(
      (await transitionRoute.POST(makeJsonReq('POST', `https://strovyn.com/api/admin/insights/${articleId}/transition`, { toStatus: 'approved' }), { params: Promise.resolve({ id: articleId }) })).status,
      200
    );
    assert.equal(
      (await transitionRoute.POST(makeJsonReq('POST', `https://strovyn.com/api/admin/insights/${articleId}/transition`, { toStatus: 'published' }), { params: Promise.resolve({ id: articleId }) })).status,
      200
    );
    assert.equal((await fetchPublicAsset(jpgAsset.id)).status, 200);

    // Downloaded byte & MIME integrity verification on public delivery (fail closed):
    const privateStore = adapter.bucketObjects.get('editorial-media');
    const originalJpgObj = privateStore.get(jpgAsset.storage_path);
    // 1. Truncated/size-mismatched bytes must fail closed (500)
    privateStore.set(jpgAsset.storage_path, { buffer: jpgBuffer.subarray(0, 8), contentType: 'image/jpeg' });
    const sizeMismatchRes = await fetchPublicAsset(jpgAsset.id);
    assert.equal(sizeMismatchRes.status, 500, 'Byte-size mismatch must fail closed without serving image bytes');
    assert.equal(sizeMismatchRes.headers.get('cache-control'), 'private, no-store');

    // 2. Exact matching byte length with spoofed PNG magic header for JPEG asset must fail closed (500)
    const spoofedSameLen = Buffer.alloc(jpgBuffer.length, 0);
    makeValidPngBuffer(100, 100).subarray(0, Math.min(20, jpgBuffer.length)).copy(spoofedSameLen, 0);
    privateStore.set(jpgAsset.storage_path, { buffer: spoofedSameLen, contentType: 'image/png' });
    const magicMismatchRes = await fetchPublicAsset(jpgAsset.id);
    assert.equal(magicMismatchRes.status, 500, 'Magic-byte mismatch must fail closed without trusting Content-Type');
    assert.equal(magicMismatchRes.headers.get('cache-control'), 'private, no-store');

    // Restore valid JPEG object
    privateStore.set(jpgAsset.storage_path, originalJpgObj);
    assert.equal((await fetchPublicAsset(jpgAsset.id)).status, 200);

    // Public RLS under `anon` exposes published article ONLY; asset references & media metadata stay hidden!
    await db.transaction(async (tx) => {
      await tx.exec('SET LOCAL ROLE anon');
      const anonVisible = (await tx.query(`SELECT slug, featured_image_url FROM public.articles WHERE id = $1`, [articleId])).rows;
      assert.equal(anonVisible.length, 1);
      assert.equal(anonVisible[0].featured_image_url, jpgAsset.media_ref);
    });

    // Audit API check
    const auditRes = await auditRoute.GET(new Request(`https://strovyn.com/api/admin/insights/${articleId}/audit`), {
      params: Promise.resolve({ id: articleId }),
    });
    assert.equal(auditRes.status, 200);
    const auditActions = (await auditRes.json()).entries.map((e) => e.action);
    assert.equal(auditActions.filter((a) => a === 'submit_for_review').length, 2);
    assert.equal(auditActions.filter((a) => a === 'approve').length, 2);
    assert.equal(auditActions.filter((a) => a === 'publish_now').length, 2);
    assert.equal(auditActions.filter((a) => a === 'archive').length, 1);

    assert.ok(
      adapter.bucketAccessLog.every((b) => b === 'editorial-media'),
      'Only private editorial-media bucket may ever be accessed (customer-documents and editorial-media-public never touched)'
    );
    console.log('[OK] Publication-gated media delivery, archive revocation, shared asset preservation & zero-public-bucket isolation verified.');

    // -----------------------------------------------------------------------
    // 6. Browser bundle secret scan across `.next/static` (if present)
    // -----------------------------------------------------------------------
    const nextStaticDir = path.join(REPO_ROOT, '.next', 'static');
    if (fs.existsSync(nextStaticDir)) {
      const stack = [nextStaticDir];
      let scanned = 0;
      while (stack.length > 0) {
        const cur = stack.pop();
        for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
          const full = path.join(cur, entry.name);
          if (entry.isDirectory()) stack.push(full);
          else if (/\.(js|mjs|cjs)$/.test(entry.name)) {
            scanned += 1;
            const content = fs.readFileSync(full, 'utf8');
            for (const forbidden of [
              'SUPABASE_SERVICE_ROLE_KEY',
              'createServiceRoleClient',
              'cms_transition_article_status',
              'requireStaffSession',
              'editorial_media_audit_log',
            ]) {
              assert.equal(
                content.includes(forbidden),
                false,
                `Forbidden server-only token '${forbidden}' found in browser bundle ${full}`
              );
            }
          }
        }
      }
      console.log(`[OK] Zero server-only secrets/APIs found across ${scanned} .next/static browser chunks.`);
    }
  } finally {
    if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    if (prevAnon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevAnon;
    if (prevSvc === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevSvc;
    await db.close();
  }

  console.log('=== ALL CMS-2.3 INTEGRATION, PRIVACY & PUBLICATION-GATED MEDIA CHECKS PASSED ===');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
