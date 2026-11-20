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

const sql001 = fs.readFileSync(path.join(MIGRATIONS_DIR, '20261113212535_initial_schema.sql'), 'utf8');
const sql002 = fs.readFileSync(path.join(MIGRATIONS_DIR, '20261119140214_idempotency_and_hardening.sql'), 'utf8');
const sql003 = fs.readFileSync(path.join(MIGRATIONS_DIR, '20261119191815_editorial_cms.sql'), 'utf8');
const sql004 = fs.readFileSync(path.join(MIGRATIONS_DIR, '20261119202922_editorial_cms_hardening.sql'), 'utf8');

function loadArticlesData() {
  const source = fs.readFileSync(path.join(REPO_ROOT, 'src', 'data', 'articlesData.ts'), 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new vm.Script(`(function(exports, require, module) {\n${transpiled}\n})`).runInThisContext()(
    mod.exports,
    require,
    mod
  );
  return mod.exports.ARTICLES_DATA;
}

async function expectSqlError(db, query, params, label, insideTx = false) {
  let threw = false;
  if (insideTx) {
    await db.exec('SAVEPOINT sp_expect_err');
  }
  try {
    await db.query(query, params);
  } catch (err) {
    threw = true;
    console.log(`  [OK-REJECTED] ${label}: ${err.message}`);
    if (insideTx) {
      await db.exec('ROLLBACK TO SAVEPOINT sp_expect_err');
    }
  }
  assert.equal(threw, true, `Expected SQL rejection for: ${label}`);
}

/**
 * Executes `fn(tx)` inside a transaction switched to a non-superuser role
 * (`anon`, `authenticated`, or `service_role`) and asserts `current_user === role`
 * so PostgreSQL genuinely evaluates GRANT/REVOKE and RLS.
 */
async function asRole(db, role, fn, authUid = null) {
  return db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE ${role}`);
    if (authUid) {
      await tx.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [authUid]);
    }
    const who = (await tx.query(`SELECT current_user::text AS u, current_setting('role', true) AS r`)).rows[0];
    assert.equal(who.u, role, `Role switch failed: expected current_user=${role}, got ${who.u}`);
    assert.equal(who.r, role, `Role setting mismatch: expected ${role}, got ${who.r}`);
    return fn(tx);
  });
}

async function createSupabaseSimulatedDb() {
  const db = new PGlite();

  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS UUID
    LANGUAGE sql
    STABLE
    AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;
      END IF;
    END;
    $$;

    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
  `);

  return db;
}

async function run() {
  console.log('=== CMS-1.4 PostgreSQL Migration, Privilege Role-Switch & Audit Suite (PGlite) ===');
  const db = await createSupabaseSimulatedDb();
  try {
    const staticArticles = loadArticlesData();

    // 1. Run DDL migrations 001 -> 002 -> legacy rows -> 003 -> 004 as schema owner
    await db.exec(sql001);
    await db.exec(sql002);

    await db.query(
      `INSERT INTO public.articles (title, slug, content, excerpt, category, status, published_at, created_at)
       VALUES
         ('Legacy Null Date Published', 'legacy-null-date-published', 'Legacy published body.', 'Legacy excerpt.', 'Surface Preparation', 'published', NULL, '2025-05-01T00:00:00Z'),
         ('Legacy Null Status Row', 'legacy-null-status-row', 'Legacy draft body.', 'Legacy excerpt.', 'Paint Chemistry', NULL, NULL, '2025-05-02T00:00:00Z')`
    );
    await db.exec(`
      ALTER TABLE public.articles
        ADD CONSTRAINT legacy_articles_status_check CHECK (status IN ('draft', 'published') OR status IS NULL);
    `);

    await db.exec(sql003);
    await db.exec(sql004);
    console.log('[OK] Sequential migrations 001 -> 002 -> 003 -> 004 executed over legacy data.');

    // 2. Verify legacy backfill + idempotent re-runs of 003 and 004 (without losing review edits)
    await asRole(db, 'service_role', async (tx) => {
      const legacyRes = (
        await tx.query(`SELECT slug, status, published_at FROM public.articles WHERE slug LIKE 'legacy-%' ORDER BY slug`)
      ).rows;
      assert.equal(legacyRes[0].status, 'published');
      assert.equal(new Date(legacyRes[0].published_at).toISOString(), '2025-05-01T00:00:00.000Z');
      assert.equal(legacyRes[1].status, 'draft');
      assert.equal(legacyRes[1].published_at, null);

      await tx.query(
        `UPDATE public.articles SET title = 'Reviewed Draft Edit Preserved' WHERE slug = 'chemistry-of-potassium-silicate-mineral-coatings'`
      );
    });

    await db.exec(sql003);
    await db.exec(sql004);

    await asRole(db, 'service_role', async (tx) => {
      const row = (
        await tx.query(`SELECT title, status FROM public.articles WHERE slug = 'chemistry-of-potassium-silicate-mineral-coatings'`)
      ).rows[0];
      assert.equal(row.title, 'Reviewed Draft Edit Preserved');
      assert.equal(row.status, 'review');
    });
    console.log('[OK] Legacy backfill (A-1) and idempotent re-execution of 003 & 004 verified.');

    // 3. Reset `public` schema within the SAME PGlite instance (avoids duplicate WASM
    //    ArrayBuffer allocation) for clean DB catalog audit + parity + role-switched tests.
    await db.exec(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    `);
    const cleanDb = db;
    await cleanDb.exec(sql001);
    await cleanDb.exec(sql002);
    await cleanDb.exec(sql003);
    await cleanDb.exec(sql004);

  // Inspect pg_proc catalog for search_path and SECURITY DEFINER boundaries
  const procRows = (
    await cleanDb.query(`
      SELECT proname, prosecdef, COALESCE(array_to_string(proconfig, ','), '') AS config
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN (
          'cms_touch_updated_at',
          'prevent_article_audit_log_mutation',
          'prevent_article_audit_log_truncate',
          'cms_article_editorial_snapshot',
          'cms_article_audit_snapshot',
          'cms_audit_article_changes',
          'cms_prevent_article_hard_delete',
          'cms_enforce_article_workflow',
          'cms_transition_article_status'
        )
      ORDER BY proname
    `)
  ).rows;
  assert.equal(procRows.length, 9);
  for (const fn of procRows) {
    assert.ok(fn.config.includes('search_path=pg_catalog, public'), `Missing safe search_path on ${fn.proname}`);
    if (fn.proname === 'cms_audit_article_changes' || fn.proname === 'cms_transition_article_status') {
      assert.equal(fn.prosecdef, true, `${fn.proname} should be SECURITY DEFINER`);
    } else {
      assert.equal(fn.prosecdef, false, `${fn.proname} should NOT be SECURITY DEFINER`);
    }
  }
  console.log('[OK] All 9 CMS functions carry explicit safe search_path and minimal SECURITY DEFINER boundaries.');

  // Database-queried content & date parity checked via service_role
  const expectedStatusMap = {
    'achieving-as-nzs-2311-level-5-surface-standards': 'published',
    'chemistry-of-potassium-silicate-mineral-coatings': 'review',
    'authentic-venetian-plaster-vs-synthetic-render': 'review',
    'lead-safe-conservation-protocols-heritage-homes': 'draft',
    'architectural-sheen-selection-raking-light': 'published',
    'low-voc-waterborne-enamels-residential-joinery': 'review',
    'moisture-equilibration-masonry-coatings': 'published',
  };

  await asRole(cleanDb, 'service_role', async (tx) => {
    const dbArticles = (
      await tx.query(`
        SELECT slug, title, category, excerpt, content, content_json, content_html,
               featured_image_url, status, is_featured, reading_time, author_name, author_role,
               published_at, legacy_static_date
        FROM public.articles
        ORDER BY created_at DESC
      `)
    ).rows;
    assert.equal(dbArticles.length, 7);

    for (const staticArt of staticArticles) {
      const row = dbArticles.find((r) => r.slug === staticArt.slug);
      assert.ok(row, `Missing seeded article ${staticArt.slug}`);
      assert.equal(row.title, staticArt.title);
      assert.equal(row.category, staticArt.category);
      assert.equal(row.excerpt, staticArt.excerpt);
      assert.equal(row.content, staticArt.content.join('\n\n'));
      assert.equal(row.featured_image_url, staticArt.coverImage);
      assert.equal(row.author_name, staticArt.author);
      assert.equal(row.author_role, staticArt.authorRole);
      assert.equal(row.is_featured, Boolean(staticArt.featured));
      assert.equal(row.reading_time, parseInt(staticArt.readTime, 10));
      assert.equal(row.status, expectedStatusMap[staticArt.slug]);
      assert.deepEqual(
        row.content_json.content.map((p) => p.content[0].text),
        staticArt.content
      );
      assert.equal(row.content_html, staticArt.content.map((p) => `<p>${p}</p>`).join(''));
      if (row.status === 'published') {
        assert.equal(new Date(row.published_at).toISOString(), new Date(row.legacy_static_date).toISOString());
      } else {
        assert.equal(row.published_at, null);
      }
    }
  });
  console.log('[OK] All 7 seeded articles match articlesData.ts verbatim (queried as service_role).');

  // 4. Runtime constraint, audit attribution, workflow & privilege tests UNDER NON-SUPERUSER service_role!
  const editorAuthId = '11111111-1111-4111-8111-111111111111';
  const publisherAuthId = '22222222-2222-4222-8222-222222222222';
  const adminAuthId = '33333333-3333-4333-8333-333333333333';
  const inactiveAuthId = '44444444-4444-4444-8444-444444444444';
  const outsiderAuthId = '55555555-5555-4555-8555-555555555555';

  let editorStaffId;
  let publisherStaffId;
  let adminStaffId;
  let inactiveStaffId;
  let testArticleId;

  await asRole(cleanDb, 'service_role', async (tx) => {
    // Constraints under service_role
    await expectSqlError(
      tx,
      `INSERT INTO public.articles (title, slug, content, excerpt, category, status, published_at)
       VALUES ('No Date Pub', 'no-date-pub', 'Body', 'Excerpt', 'Paint Chemistry', 'published', NULL)`,
      [],
      'published without published_at rejected',
      true
    );
    await expectSqlError(
      tx,
      `INSERT INTO public.articles (title, slug, content, excerpt, category, status, scheduled_at)
       VALUES ('No Time Sched', 'no-time-sched', 'Body', 'Excerpt', 'Paint Chemistry', 'scheduled', NULL)`,
      [],
      'scheduled without scheduled_at rejected',
      true
    );
    await expectSqlError(
      tx,
      `INSERT INTO public.articles (title, slug, content, excerpt, category, status)
       VALUES ('Bogus Status', 'bogus-status', 'Body', 'Excerpt', 'Paint Chemistry', 'bogus')`,
      [],
      'invalid status rejected',
      true
    );
    await expectSqlError(
      tx,
      `INSERT INTO public.articles (title, slug, content, excerpt, category, status, publish_attempts)
       VALUES ('Neg Attempts', 'neg-attempts', 'Body', 'Excerpt', 'Paint Chemistry', 'draft', -1)`,
      [],
      'negative publish_attempts rejected',
      true
    );

    const staffRes = (
      await tx.query(
        `INSERT INTO public.staff_users (auth_user_id, email, full_name, role, is_active)
         VALUES
           ($1, 'editor@strovyn.com.au', 'Editorial Writer', 'editor', TRUE),
           ($2, 'publisher@strovyn.com.au', 'Lead Publisher', 'publisher', TRUE),
           ($3, 'admin@strovyn.com.au', 'CMS Admin', 'admin', TRUE),
           ($4, 'former@strovyn.com.au', 'Former Admin', 'admin', FALSE)
         RETURNING id, role, is_active`,
        [editorAuthId, publisherAuthId, adminAuthId, inactiveAuthId]
      )
    ).rows;
    editorStaffId = staffRes[0].id;
    publisherStaffId = staffRes[1].id;
    adminStaffId = staffRes[2].id;
    inactiveStaffId = staffRes[3].id;

    await expectSqlError(
      tx,
      `INSERT INTO public.staff_users (auth_user_id, email, full_name, role)
       VALUES (gen_random_uuid(), 'EDITOR@STROVyN.COM.AU', 'Dup', 'editor')`,
      [],
      'duplicate case-insensitive email rejected',
      true
    );
    await expectSqlError(
      tx,
      `INSERT INTO public.staff_users (auth_user_id, email, full_name, role)
       VALUES (gen_random_uuid(), 'bad@strovyn.com.au', 'Bad', 'superadmin')`,
      [],
      'invalid staff role rejected',
      true
    );

    // Insert draft as editor under service_role
    const draftRes = (
      await tx.query(
        `INSERT INTO public.articles (title, slug, content, excerpt, category, status, reading_time, created_by, updated_by)
         VALUES ('Hardened Draft', 'hardened-draft', 'Body.', 'Excerpt.', 'Surface Preparation', 'draft', 5, $1, $1)
         RETURNING id`,
        [editorStaffId]
      )
    ).rows;
    testArticleId = draftRes[0].id;

    // Reading-time-only update must capture audit log with reading_time included (Low Finding 4 / Phase 2 #7)
    await tx.query(
      `UPDATE public.articles SET reading_time = 9, updated_by = $1 WHERE id = $2`,
      [editorStaffId, testArticleId]
    );
    // No-op updated_at touch must NOT add an audit row
    await tx.query(`UPDATE public.articles SET updated_at = NOW() WHERE id = $1`, [testArticleId]);

    // Operational-only retry update WHILE OLD.updated_by = editorStaffId MUST log as 'cron' / system, NEVER editor!
    await tx.query(
      `UPDATE public.articles
       SET publish_attempts = 1, last_publish_error = 'Transient timeout', next_retry_at = NOW() + INTERVAL '5 minutes'
       WHERE id = $1`,
      [testArticleId]
    );

    // Unattributed draft editorial update (`updated_by = NULL`) logs as 'system', NEVER OLD.updated_by!
    await tx.query(
      `UPDATE public.articles SET title = 'System Normalized Draft Title', updated_by = NULL WHERE id = $1`,
      [testArticleId]
    );

    // Restoring attribution as inactive staff member on draft must be rejected
    await expectSqlError(
      tx,
      `UPDATE public.articles SET title = 'Inactive Edit', updated_by = $1 WHERE id = $2`,
      [inactiveStaffId, testArticleId],
      'inactive staff updated_by rejected on draft edit',
      true
    );

    const draftAudits = (
      await tx.query(
        `SELECT action, actor_type, actor_staff_id, actor_role, previous_snapshot, new_snapshot
         FROM public.article_audit_log
         WHERE article_id = $1
         ORDER BY created_at ASC, event_seq ASC`,
        [testArticleId]
      )
    ).rows;
    assert.equal(draftAudits.length, 4, 'Expected exactly 4 audit rows (insert, reading_time update, cron retry, system draft update; no-op excluded)');

    assert.equal(draftAudits[0].action, 'db_insert');
    assert.equal(draftAudits[0].actor_staff_id, editorStaffId);
    assert.equal(draftAudits[0].new_snapshot.reading_time, 5);

    assert.equal(draftAudits[1].action, 'db_update');
    assert.equal(draftAudits[1].actor_staff_id, editorStaffId);
    assert.equal(draftAudits[1].previous_snapshot.reading_time, 5);
    assert.equal(draftAudits[1].new_snapshot.reading_time, 9);

    assert.equal(draftAudits[2].action, 'cron_retry_recorded');
    assert.equal(draftAudits[2].actor_type, 'cron');
    assert.equal(draftAudits[2].actor_staff_id, null, 'Cron retry must NEVER inherit OLD.updated_by');
    assert.equal(draftAudits[2].actor_role, 'system');
    assert.equal(draftAudits[2].new_snapshot.publish_attempts, 1);

    assert.equal(draftAudits[3].action, 'db_update');
    assert.equal(draftAudits[3].actor_type, 'system');
    assert.equal(draftAudits[3].actor_staff_id, null, 'updated_by=NULL must NEVER inherit OLD.updated_by');
    assert.equal(draftAudits[3].actor_role, 'system');

    // Test RPC under actual `service_role`!
    await expectSqlError(
      tx,
      `SELECT * FROM public.cms_transition_article_status($1, 'review', $2, 'staff', NULL, NULL, 'invented_evil_action')`,
      [testArticleId, editorStaffId],
      'disallowed p_action rejected by RPC allowlist',
      true
    );
    await expectSqlError(
      tx,
      `SELECT * FROM public.cms_transition_article_status($1, 'review', $2, 'staff', NULL, NULL, '${'x'.repeat(80)}')`,
      [testArticleId, editorStaffId],
      'oversized p_action rejected by RPC',
      true
    );
    await expectSqlError(
      tx,
      `UPDATE public.articles SET status = 'published', published_at = NOW() WHERE id = $1`,
      [testArticleId],
      'direct status bypass rejected under service_role',
      true
    );

    // Editor submits draft -> review, Publisher approves review -> approved
    await tx.query(`SELECT * FROM public.cms_transition_article_status($1, 'review', $2, 'staff')`, [testArticleId, editorStaffId]);
    await expectSqlError(
      tx,
      `SELECT * FROM public.cms_transition_article_status($1, 'approved', $2, 'staff')`,
      [testArticleId, editorStaffId],
      'editor blocked from approving under service_role RPC',
      true
    );
    await tx.query(`SELECT * FROM public.cms_transition_article_status($1, 'approved', $2, 'staff')`, [testArticleId, publisherStaffId]);

    // Editor demotion blocked (A-2)
    await expectSqlError(
      tx,
      `SELECT * FROM public.cms_transition_article_status($1, 'draft', $2, 'staff')`,
      [testArticleId, editorStaffId],
      'editor blocked from approved -> draft',
      true
    );
    await expectSqlError(
      tx,
      `SELECT * FROM public.cms_transition_article_status($1, 'review', $2, 'staff')`,
      [testArticleId, editorStaffId],
      'editor blocked from approved -> review',
      true
    );

    // Protected editorial edits MUST reject BOTH editor AND updated_by = NULL!
    await expectSqlError(
      tx,
      `UPDATE public.articles SET title = 'NULL Actor Bypass Attempt', updated_by = NULL WHERE id = $1`,
      [testArticleId],
      'protected edit with updated_by = NULL rejected by workflow trigger',
      true
    );
    await expectSqlError(
      tx,
      `UPDATE public.articles SET title = 'Editor Protected Edit', updated_by = $1 WHERE id = $2`,
      [editorStaffId, testArticleId],
      'protected edit by editor rejected by workflow trigger',
      true
    );

    // Protected edit by active publisher SUCCEEDS and audits properly!
    await tx.query(
      `UPDATE public.articles SET title = 'Publisher Polished Approved Title', updated_by = $1 WHERE id = $2`,
      [publisherStaffId, testArticleId]
    );

    // Schedule due in past: first test active retry backoff blocking cron, then clear/re-schedule & publish cleanly
    await tx.query(
      `SELECT * FROM public.cms_transition_article_status($1, 'scheduled', $2, 'staff', NOW() - INTERVAL '1 minute')`,
      [testArticleId, publisherStaffId]
    );
    await tx.query(
      `UPDATE public.articles SET publish_attempts = 2, last_publish_error = 'SMTP/Cache glitch', next_retry_at = NOW() + INTERVAL '5 minutes' WHERE id = $1`,
      [testArticleId]
    );
    await expectSqlError(
      tx,
      `SELECT * FROM public.cms_transition_article_status($1, 'published', NULL, 'cron')`,
      [testArticleId],
      'cron blocked during active retry backoff window',
      true
    );
    await tx.query(`UPDATE public.articles SET next_retry_at = NOW() - INTERVAL '1 second' WHERE id = $1`, [testArticleId]);
    const pubRow = (
      await tx.query(`SELECT * FROM public.cms_transition_article_status($1, 'published', NULL, 'cron')`, [testArticleId])
    ).rows[0];
    assert.equal(pubRow.status, 'published');
    assert.ok(pubRow.published_at !== null);

    // Even published row rejects updated_by = NULL editorial changes, while cron operational update works if needed
    await expectSqlError(
      tx,
      `UPDATE public.articles SET title = 'Published NULL Bypass', updated_by = NULL WHERE id = $1`,
      [testArticleId],
      'published edit with updated_by = NULL rejected',
      true
    );

    // Confirm service_role STILL cannot mutate or delete audit logs or hard-delete articles!
    await expectSqlError(tx, `UPDATE public.article_audit_log SET note = 'tamper'`, [], 'service_role UPDATE audit log denied', true);
    await expectSqlError(tx, `DELETE FROM public.article_audit_log`, [], 'service_role DELETE audit log denied', true);
    await expectSqlError(tx, `DELETE FROM public.articles WHERE id = $1`, [testArticleId], 'service_role DELETE article denied', true);

    // Future published article for public RLS negative test
    await tx.query(
      `INSERT INTO public.articles (title, slug, content, excerpt, category, status, published_at, created_by)
       VALUES ('Future Published', 'future-published-article', 'Body', 'Excerpt', 'Paint Chemistry', 'published', NOW() + INTERVAL '2 days', $1)`,
      [adminStaffId]
    );
  });
  console.log('[OK] service_role role-switched CRUD, RPC, audit attribution, and immutability verified.');

  // 5. Strict non-superuser `anon` tests (current_user === 'anon')
  await asRole(cleanDb, 'anon', async (tx) => {
    const visible = (await tx.query(`SELECT slug FROM public.articles`)).rows.map((r) => r.slug);
    assert.ok(visible.includes('achieving-as-nzs-2311-level-5-surface-standards'));
    assert.ok(!visible.includes('lead-safe-conservation-protocols-heritage-homes'));
    assert.ok(!visible.includes('future-published-article'));

    await expectSqlError(tx, `SELECT * FROM public.staff_users`, [], 'anon SELECT staff_users denied', true);
    await expectSqlError(tx, `SELECT * FROM public.article_audit_log`, [], 'anon SELECT article_audit_log denied', true);
    await expectSqlError(
      tx,
      `INSERT INTO public.articles (title, slug, content, excerpt, category, status, published_at)
       VALUES ('X', 'x', 'y', 'z', 'c', 'published', NOW())`,
      [],
      'anon INSERT articles denied',
      true
    );
    await expectSqlError(
      tx,
      `SELECT * FROM public.cms_transition_article_status($1, 'archived', $2, 'staff')`,
      [testArticleId, adminStaffId],
      'anon EXECUTE cms_transition_article_status denied',
      true
    );
    await expectSqlError(
      tx,
      `SELECT public.cms_article_editorial_snapshot(a) FROM public.articles a LIMIT 1`,
      [],
      'anon EXECUTE cms_article_editorial_snapshot denied',
      true
    );
  });
  console.log('[OK] anon role-switched GRANT/REVOKE & RLS negative assertions verified.');

  // 6. Strict non-superuser `authenticated` tests (current_user === 'authenticated')
  await asRole(
    cleanDb,
    'authenticated',
    async (tx) => {
      const visible = (await tx.query(`SELECT slug, status FROM public.articles`)).rows;
      assert.ok(visible.every((r) => r.status === 'published'));
      assert.ok(!visible.some((r) => r.slug === 'lead-safe-conservation-protocols-heritage-homes'));
      assert.ok(!visible.some((r) => r.slug === 'future-published-article'));

      const own = (await tx.query(`SELECT email, role FROM public.staff_users`)).rows;
      assert.deepEqual(own, [{ email: 'editor@strovyn.com.au', role: 'editor' }]);
      const peer = (await tx.query(`SELECT * FROM public.staff_users WHERE email = 'admin@strovyn.com.au'`)).rows;
      assert.equal(peer.length, 0);

      await expectSqlError(tx, `UPDATE public.staff_users SET role = 'admin'`, [], 'authenticated UPDATE staff_users denied', true);
      await expectSqlError(tx, `SELECT * FROM public.article_audit_log`, [], 'authenticated SELECT article_audit_log denied', true);
      await expectSqlError(tx, `UPDATE public.articles SET title = 'hack'`, [], 'authenticated UPDATE articles denied', true);
      await expectSqlError(tx, `DELETE FROM public.articles WHERE id = $1`, [testArticleId], 'authenticated DELETE articles denied', true);
      await expectSqlError(
        tx,
        `SELECT * FROM public.cms_transition_article_status($1, 'archived', $2, 'staff')`,
        [testArticleId, adminStaffId],
        'authenticated EXECUTE cms_transition_article_status denied',
        true
      );
      await expectSqlError(
        tx,
        `SELECT public.cms_article_editorial_snapshot(a) FROM public.articles a LIMIT 1`,
        [],
        'authenticated EXECUTE cms_article_editorial_snapshot denied',
        true
      );
    },
    editorAuthId
  );

  for (const [label, subId] of [
    ['inactive staff', inactiveAuthId],
    ['unregistered outsider', outsiderAuthId],
  ]) {
    await asRole(
      cleanDb,
      'authenticated',
      async (tx) => {
        const rows = (await tx.query(`SELECT * FROM public.staff_users`)).rows;
        assert.equal(rows.length, 0, `${label} must see 0 staff rows`);
      },
      subId
    );
  }
    console.log('[OK] authenticated role-switched GRANT/REVOKE, peer isolation & inactive/outsider denial verified.');
  } finally {
    await db.close();
  }
  console.log('=== ALL CMS-1.4 POSTGRESQL HARDENING CHECKS PASSED ===');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
