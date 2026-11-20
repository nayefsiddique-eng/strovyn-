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

function createPglitePublicAnonAdapter(db) {
  function sanitizeCol(name) {
    assert.match(name, /^[a-zA-Z_][a-zA-Z0-9_]*$/);
    return `"${name}"`;
  }

  class AnonQueryBuilder {
    constructor(table) {
      this.table = table;
      this.selectCols = '*';
      this.filters = [];
      this.orExpr = null;
      this.orders = [];
      this.limitVal = null;
      this.expectMaybeSingle = false;
    }

    select(cols = '*') {
      this.selectCols = cols;
      return this;
    }

    eq(col, val) {
      this.filters.push({ col, val });
      return this;
    }

    or(expr) {
      this.orExpr = expr;
      return this;
    }

    order(col, { ascending = true, nullsFirst } = {}) {
      this.orders.push({ col, ascending, nullsFirst });
      return this;
    }

    limit(n) {
      this.limitVal = n;
      return this;
    }

    maybeSingle() {
      this.expectMaybeSingle = true;
      return this;
    }

    async execute() {
      const values = [];
      const clauses = this.filters.map((f) => {
        values.push(f.val);
        return `${sanitizeCol(f.col)} = $${values.length}`;
      });

      if (this.orExpr === undefined || this.orExpr !== null) {
        // Parse `col.is.null,col.lte.val` cleanly
        const orClauses = String(this.orExpr)
          .split(',')
          .map((part) => {
            const firstDot = part.indexOf('.');
            const secondDot = part.indexOf('.', firstDot + 1);
            const col = part.slice(0, firstDot);
            const op = part.slice(firstDot + 1, secondDot);
            const val = part.slice(secondDot + 1);
            if (op === 'is' && val === 'null') {
              return `${sanitizeCol(col)} IS NULL`;
            }
            if (op === 'lte') {
              values.push(val);
              return `${sanitizeCol(col)} <= $${values.length}`;
            }
            throw new Error(`Unsupported test OR clause: ${part}`);
          });
        clauses.push(`(${orClauses.join(' OR ')})`);
      }

      const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
      const orderSql =
        this.orders.length > 0
          ? `ORDER BY ${this.orders
              .map(
                (o) =>
                  `${sanitizeCol(o.col)} ${o.ascending ? 'ASC' : 'DESC'}${
                    o.nullsFirst === false ? ' NULLS LAST' : ''
                  }`
              )
              .join(', ')}`
          : '';
      const limitSql = this.limitVal ? `LIMIT ${Number(this.limitVal)}` : '';

      const sql = `SELECT ${this.selectCols} FROM public.${sanitizeCol(this.table)} ${whereSql} ${orderSql} ${limitSql}`;

      await db.query('BEGIN');
      try {
        await db.query('SET LOCAL ROLE anon');
        const res = await db.query(sql, values);
        await db.query('COMMIT');
        const data = this.expectMaybeSingle ? res.rows[0] ?? null : res.rows;
        return { data, error: null };
      } catch (err) {
        await db.query('ROLLBACK').catch(() => {});
        return { data: null, error: { message: err.message } };
      }
    }

    then(resolve, reject) {
      return this.execute().then(resolve, reject);
    }
  }

  return {
    from(table) {
      return new AnonQueryBuilder(table);
    },
  };
}

async function run() {
  console.log('=== CMS-4 Stage 1 Public Insights Database Cutover Suite ===');
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

    const modCache = new Map();
    const stubs = { 'server-only': {} };
    const publicArticles = loadProjectTsModule('src/lib/cms/publicArticles.ts', stubs, modCache);
    const anonClient = createPglitePublicAnonAdapter(db);

    // 1. Seeded published-only database cutover (never returning review or draft rows)
    const initialList = await publicArticles.listPublishedArticles({ clientOverride: anonClient });
    assert.equal(initialList.length, 3, 'Anon cutover must return strictly the 3 published articles');
    const publishedSlugs = initialList.map((a) => a.slug);
    assert.ok(publishedSlugs.includes('achieving-as-nzs-2311-level-5-surface-standards'));
    assert.ok(publishedSlugs.includes('architectural-sheen-selection-raking-light'));
    assert.ok(publishedSlugs.includes('moisture-equilibration-masonry-coatings'));
    assert.equal(
      publishedSlugs.includes('lead-safe-conservation-protocols-heritage-homes'),
      false,
      'Draft article must never appear in public index'
    );
    assert.equal(
      publishedSlugs.includes('chemistry-of-potassium-silicate-mineral-coatings'),
      false,
      'Review article must never appear in public index'
    );
    assert.equal(
      publicArticles.selectFeaturedPublicArticle(initialList)?.slug,
      'achieving-as-nzs-2311-level-5-surface-standards'
    );
    assert.deepEqual(publicArticles.derivePublicCategories(initialList), [
      'All',
      'Surface Preparation',
      'Painting Techniques',
    ]);

    // Limit works cleanly for homepage 3-card showcase
    const topTwo = await publicArticles.listPublishedArticles({ limit: 2, clientOverride: anonClient });
    assert.equal(topTwo.length, 2);

    // 2. Non-published slugs & unsafe slugs must fail closed to null (404)
    assert.equal(
      await publicArticles.getPublishedArticleBySlug('lead-safe-conservation-protocols-heritage-homes', anonClient),
      null
    );
    assert.equal(
      await publicArticles.getPublishedArticleBySlug('chemistry-of-potassium-silicate-mineral-coatings', anonClient),
      null
    );
    assert.equal(
      await publicArticles.getPublishedArticleBySlug('../etc/passwd', anonClient),
      null
    );

    // 3. Publish a new Tiptap article with custom SEO metadata & canonical /api/editorial-media/<uuid>
    const publisherId = '99999999-aaaa-4bbb-8ccc-111111111111';
    await db.query(
      `INSERT INTO public.staff_users (id, auth_user_id, email, full_name, role, is_active)
       VALUES ($1, '99999999-aaaa-4bbb-8ccc-222222222222', 'pub4@strovyn.invalid', 'Pub Four', 'publisher', true)`,
      [publisherId]
    );

    const mediaId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    await db.query(
      `INSERT INTO public.editorial_media_assets (id, bucket_id, storage_path, mime_type, byte_size, width, height, alt_text, uploaded_by, delete_state)
       VALUES ($1, 'editorial-media', 'articles/2026/11/cms4-test.png', 'image/png', 1024, 800, 600, 'CMS-4 cover mineral texture', $2, 'active')`,
      [mediaId, publisherId]
    );

    const mediaRef = `/api/editorial-media/${mediaId}`;
    const newArticleId = '12121212-3434-4567-89ab-cdef01234567';
    await db.query(
      `INSERT INTO public.articles (
         id, slug, title, subtitle, category, excerpt, content, content_json, content_html,
         featured_image_url, featured_image_alt, og_image_url, seo_title, seo_description,
         status, is_featured, reading_time, author_name, author_role, created_by, updated_by
       ) VALUES (
         $1, 'cms4-mineral-primer-field-study', 'CMS-4 Mineral Primer Field Study',
         'Subsurface alkalinity measurements', 'Paint Chemistry',
         'Empirical absorption tests comparing silicate primers on weathered lime render.',
         'Paragraph one with technical substrate metrics and alkalinity checks.',
         $2, $3, $4, 'CMS-4 lime render test panel', $4,
         'CMS-4 SEO Title | Mineral Primers', 'CMS-4 custom SEO description for mineral primers.',
         'draft', false, 5, 'Strovyn Painting Co.', 'Lead Coatings Chemist', $5, $5
       )`,
      [
        newArticleId,
        JSON.stringify({
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Alkalinity Results' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph one with technical substrate metrics and alkalinity checks.' }] },
            { type: 'image', attrs: { src: mediaRef, alt: 'Inline silicate crystal close-up' } },
          ],
        }),
        `<h2>Alkalinity Results</h2><p>Paragraph one with technical substrate metrics and alkalinity checks.</p><img src="${mediaRef}" alt="Inline silicate crystal close-up" />`,
        mediaRef,
        publisherId,
      ]
    );

    // Transition to published via authoritative RPC
    for (const nextStatus of ['review', 'approved', 'published']) {
      await db.query(
        `SELECT public.cms_transition_article_status($1, $2, $3, 'staff', NULL, 'CMS-4 test publish')`,
        [newArticleId, nextStatus, publisherId]
      );
    }

    const updatedList = await publicArticles.listPublishedArticles({ clientOverride: anonClient });
    assert.equal(updatedList.length, 4);

    const detail = await publicArticles.getPublishedArticleBySlug('cms4-mineral-primer-field-study', anonClient);
    assert.ok(detail, 'Newly published DB article must load on /insights/[slug]');
    assert.equal(detail.seoTitle, 'CMS-4 SEO Title | Mineral Primers');
    assert.equal(detail.seoDescription, 'CMS-4 custom SEO description for mineral primers.');
    assert.equal(detail.subtitle, 'Subsurface alkalinity measurements');
    assert.equal(detail.coverImage, mediaRef);
    assert.equal(detail.ogImage, mediaRef);
    assert.ok(detail.sanitizedHtml.includes('<h2>Alkalinity Results</h2>'));
    assert.ok(detail.sanitizedHtml.includes(`src="${mediaRef}"`));

    // Archival immediately hides from public index & slug detail
    await db.query(
      `SELECT public.cms_transition_article_status($1, 'archived', $2, 'staff', NULL, 'CMS-4 test archive')`,
      [newArticleId, publisherId]
    );
    assert.equal(await publicArticles.getPublishedArticleBySlug('cms4-mineral-primer-field-study', anonClient), null);
    assert.equal((await publicArticles.listPublishedArticles({ clientOverride: anonClient })).length, 3);

    // 4. Defense-in-depth HTML sanitization strips scripts, handlers & signed URLs
    const sanitized = publicArticles.renderSafePublicArticleHtml({
      content_html:
        '<p onclick="alert(1)">Clean copy</p><script>evil()</script><img src="https://evil.example.supabase.co/storage/v1/object/sign/editorial-media/x.png?token=abc" alt="bad" /><img src="/api/editorial-media/11111111-1111-4111-8111-111111111111" alt="good" />',
    });
    assert.equal(sanitized.includes('<script>'), false);
    assert.equal(sanitized.includes('onclick'), false);
    assert.equal(sanitized.includes('/object/sign/'), false);
    assert.ok(sanitized.includes('src="/api/editorial-media/11111111-1111-4111-8111-111111111111"'));

    // 5. Cutover boundary checks: public pages must NOT use articlesData or serviceRole, and never proxy private media via Next Image
    for (const rel of [
      'src/app/page.tsx',
      'src/app/insights/page.tsx',
      'src/app/insights/[slug]/page.tsx',
      'src/components/home/InsightsArticles.tsx',
      'src/components/home/HomeInsightsSection.tsx',
      'src/components/insights/PublicInsightsCatalog.tsx',
      'src/components/insights/PublicArticleMedia.tsx',
      'src/lib/cms/publicArticles.ts',
      'src/lib/supabase/public.ts',
    ]) {
      const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      assert.equal(src.includes('articlesData'), false, `${rel} must not reference static articlesData`);
      assert.equal(src.includes('ARTICLES_DATA'), false, `${rel} must not reference ARTICLES_DATA`);
      assert.equal(src.includes('serviceRole'), false, `${rel} must not import serviceRole`);
      assert.equal(src.includes('SUPABASE_SERVICE_ROLE_KEY'), false, `${rel} must not reference service role key`);
    }

    const mediaCompSrc = fs.readFileSync(
      path.join(REPO_ROOT, 'src/components/insights/PublicArticleMedia.tsx'),
      'utf8'
    );
    assert.ok(
      mediaCompSrc.includes('isPrivateGatedEditorialMediaSrc('),
      'PublicArticleMedia must bypass Next Image cache for /api/editorial-media/<uuid>'
    );

    console.log('ALL CMS-4 STAGE 1 PUBLIC CUTOVER TESTS PASSED');
  } finally {
    await db.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
