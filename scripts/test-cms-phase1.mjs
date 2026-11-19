import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

function transpileTsFile(relPath) {
  const fullPath = path.join(REPO_ROOT, relPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    fileName: fullPath,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      strict: true,
    },
  });
  return transpiled.outputText;
}

function loadProjectTsModule(relPath, customModules = {}, cache = new Map()) {
  const normalizedRel = relPath.replace(/\\/g, '/');
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
      const targetRel = `src/${specifier.slice(2)}.ts`;
      return loadProjectTsModule(targetRel, customModules, cache);
    }
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      const joined = path.posix.normalize(path.posix.join(dir, specifier));
      const targetRel = joined.endsWith('.ts') ? joined : `${joined}.ts`;
      return loadProjectTsModule(targetRel, customModules, cache);
    }
    return require(specifier);
  };

  const fn = new vm.Script(`(function(exports, require, module, __filename, __dirname) {\n${code}\n})`, {
    filename: normalizedRel,
  });
  const wrapper = fn.runInThisContext();
  wrapper(mod.exports, localRequire, mod, path.join(REPO_ROOT, normalizedRel), path.join(REPO_ROOT, dir));
  return mod.exports;
}

function makeStaff(overrides = {}) {
  return {
    id: 'staff-1',
    auth_user_id: 'auth-1',
    email: 'staff@strovyn.com.au',
    full_name: 'Strovyn Staff',
    role: 'editor',
    is_active: true,
    last_login_at: null,
    created_at: '2026-11-20T00:00:00Z',
    updated_at: '2026-11-20T00:00:00Z',
    ...overrides,
  };
}

async function run() {
  console.log('=== CMS-1.4 Unit, RBAC, Config Template & Default Auth Wrapper Suite ===');

  // 1. Verify `server-only` throws on client-condition import of serviceRole.ts and staffAuth.ts
  assert.throws(
    () => loadProjectTsModule('src/lib/supabase/serviceRole.ts'),
    /Client Component/i,
    'serviceRole.ts must fail closed outside react-server'
  );
  assert.throws(
    () => loadProjectTsModule('src/lib/cms/staffAuth.ts', { '@/lib/supabase/server': {} }),
    /Client Component/i,
    'staffAuth.ts must fail closed outside react-server'
  );
  console.log('[OK] server-only guard blocks client-condition imports of serviceRole.ts and staffAuth.ts.');

  const serverModules = {
    'server-only': {},
    '@/lib/supabase/server': {
      createClient: async () => {
        throw new Error('Mocked below when testing default wrapper');
      },
    },
  };
  const cache = new Map();
  const rolesMod = loadProjectTsModule('src/lib/cms/roles.ts', serverModules, cache);
  const rbacMod = loadProjectTsModule('src/lib/cms/rbac.ts', serverModules, cache);
  const serviceRoleMod = loadProjectTsModule('src/lib/supabase/serviceRole.ts', serverModules, cache);
  const staffAuthMod = loadProjectTsModule('src/lib/cms/staffAuth.ts', serverModules, cache);

  // 2. Verify Supabase config guards (including exact .env.local.example template values!)
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const prevSvc = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const validJwtAnon =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIn0.signaturePayloadAnon123';
  const validJwtService =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UifQ.signaturePayloadService123';
  const validPublishable = 'sb_publishable_liveKeyToken1234567890';
  const validSecret = 'sb_secret_liveSecretToken1234567890';

  try {
    // Exact template values from .env.local.example MUST fail closed, even individually paired with valid values!
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://your-project-id.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'your_supabase_anon_key_here';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'your_supabase_service_role_key_here';
    assert.equal(serviceRoleMod.isSupabaseAnonConfigured(), false);
    assert.equal(serviceRoleMod.isServiceRoleConfigured(), false);
    assert.equal(serviceRoleMod.isCmsSupabaseConfigured(), false);
    assert.throws(() => serviceRoleMod.createServiceRoleClient(), /unavailable/i);

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://strovynprodref.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'your_supabase_anon_key_here';
    process.env.SUPABASE_SERVICE_ROLE_KEY = validJwtService;
    assert.equal(serviceRoleMod.isSupabaseAnonConfigured(), false, 'Template anon key MUST fail even with valid URL + service key');
    assert.equal(serviceRoleMod.isCmsSupabaseConfigured(), false);

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://strovynprodref.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = validJwtAnon;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'your_supabase_service_role_key_here';
    assert.equal(serviceRoleMod.isServiceRoleConfigured(), false, 'Template service key MUST fail even with valid URL + anon key');
    assert.equal(serviceRoleMod.isCmsSupabaseConfigured(), false);
    assert.throws(() => serviceRoleMod.createServiceRoleClient(), /unavailable/i);

    // Arbitrary plain text >= 20 chars MUST NOT pass length-only checks; swapped sb_ keys MUST fail!
    for (const badAnon of [
      'arbitrary_long_non_jwt_string_that_is_over_twenty_chars',
      'replace_with_real_anon_key',
      'placeholder-anon-key-1234567890',
      validSecret, // sb_secret_ must NOT validate as anon key!
      '',
      '   ',
    ]) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://strovynprodref.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = badAnon;
      process.env.SUPABASE_SERVICE_ROLE_KEY = validJwtService;
      assert.equal(serviceRoleMod.isSupabaseAnonConfigured(), false, `Bad anon key must fail: ${badAnon}`);
    }

    for (const badSvc of [
      'arbitrary_long_non_jwt_string_that_is_over_twenty_chars',
      'replace_with_service_role_secret',
      'your_service_role_key_placeholder',
      validPublishable, // sb_publishable_ must NOT validate as service_role key!
      'eyJshort.seg.seg',
      '',
      'key with spaces 12345.abc.def',
    ]) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://strovynprodref.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = validJwtAnon;
      process.env.SUPABASE_SERVICE_ROLE_KEY = badSvc;
      assert.equal(serviceRoleMod.isServiceRoleConfigured(), false, `Bad service key must fail: ${badSvc}`);
    }

    for (const badUrl of [
      'https://your-project-id.supabase.co',
      'https://placeholder.supabase.co',
      'https://user:pass@strovynprodref.supabase.co',
      'https://localhostless',
      'http://remote.example.com',
      'not-a-url',
    ]) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = badUrl;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = validJwtAnon;
      process.env.SUPABASE_SERVICE_ROLE_KEY = validJwtService;
      assert.equal(serviceRoleMod.isCmsSupabaseConfigured(), false, `Bad URL must fail: ${badUrl}`);
    }

    // Valid JWTs & modern sb_publishable_ / sb_secret_ formats MUST succeed
    for (const [goodUrl, goodAnon, goodSvc] of [
      ['https://strovynprodref.supabase.co', validJwtAnon, validJwtService],
      ['http://127.0.0.1:54321', validPublishable, validSecret],
      ['http://localhost:54321', validJwtAnon, validSecret],
    ]) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = goodUrl;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = goodAnon;
      process.env.SUPABASE_SERVICE_ROLE_KEY = goodSvc;
      assert.equal(serviceRoleMod.isCmsSupabaseConfigured(), true, `Valid config rejected: ${goodUrl}`);
      const client = serviceRoleMod.createServiceRoleClient();
      assert.ok(client && typeof client.from === 'function');
    }
    console.log('[OK] Config validator rejects .env.local.example templates, non-JWT strings, and swapped keys while allowing real JWT & sb_* formats.');

    // 3. Test REAL default dependency wrapper in staffAuth.ts (`getDefaultStaffDependencies` without depsOverride!)
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://strovynprodref.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = validJwtAnon;
    process.env.SUPABASE_SERVICE_ROLE_KEY = validJwtService;

    let sessionAuthBehavior = async () => ({ data: { user: null }, error: { message: 'expired' } });
    let staffQueryBehavior = async () => ({ data: null, error: null });

    const defaultTestModules = {
      'server-only': {},
      '@/lib/supabase/server': {
        createClient: async () => ({
          auth: {
            getUser: () => sessionAuthBehavior(),
          },
        }),
      },
      '@supabase/supabase-js': {
        createClient: () => ({
          from: (table) => {
            assert.equal(table, 'staff_users');
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: () => staffQueryBehavior(),
                }),
              }),
            };
          },
        }),
      },
    };
    const defaultStaffAuth = loadProjectTsModule('src/lib/cms/staffAuth.ts', defaultTestModules, new Map());

    // 3a. Supabase Auth returns error -> 401 UNAUTHENTICATED
    await assert.rejects(
      () => defaultStaffAuth.requireStaffSession({ action: 'article:create_draft' }),
      (err) => err.status === 401 && err.code === 'UNAUTHENTICATED'
    );

    // 3b. Supabase Auth THROWS transport exception -> normalized 503 AUTH_SERVICE_UNAVAILABLE (no raw secrets/URLs!)
    sessionAuthBehavior = async () => {
      throw new Error('connect ECONNREFUSED https://strovynprodref.supabase.co secret_token_abc');
    };
    await assert.rejects(
      () => defaultStaffAuth.requireStaffSession({ action: 'article:create_draft' }),
      (err) =>
        err.status === 503 &&
        err.code === 'AUTH_SERVICE_UNAVAILABLE' &&
        !/ECONNREFUSED|strovynprodref|secret_token/i.test(err.message)
    );

    // 3c. DB lookup returns error -> 500 STAFF_LOOKUP_FAILED
    sessionAuthBehavior = async () => ({ data: { user: { id: 'auth-pub', email: 'pub@strovyn.com.au' } }, error: null });
    staffQueryBehavior = async () => ({ data: null, error: { message: 'postgres relation failure' } });
    await assert.rejects(
      () => defaultStaffAuth.requireStaffSession({ action: 'article:approve' }),
      (err) => err.status === 500 && err.code === 'STAFF_LOOKUP_FAILED' && !/postgres/i.test(err.message)
    );

    // 3d. DB lookup THROWS transport exception -> normalized 503 STAFF_LOOKUP_FAILED
    staffQueryBehavior = async () => {
      throw new Error('fetch failed internal socket error');
    };
    await assert.rejects(
      () => defaultStaffAuth.requireStaffSession({ action: 'article:approve' }),
      (err) => err.status === 503 && err.code === 'STAFF_LOOKUP_FAILED' && !/socket/i.test(err.message)
    );

    // 3e. Valid default auth + DB resolution succeeds cleanly
    staffQueryBehavior = async () => ({
      data: makeStaff({ id: 'pub-1', auth_user_id: 'auth-pub', email: 'Pub@Strovyn.com.au', role: 'publisher', is_active: true }),
      error: null,
    });
    const resolvedPub = await defaultStaffAuth.requireStaffSession({ transition: { from: 'approved', to: 'draft' } });
    assert.equal(resolvedPub.id, 'pub-1');
    assert.equal(resolvedPub.role, 'publisher');
    console.log('[OK] Real getDefaultStaffDependencies() handles Auth errors, thrown network failures, DB errors, and active lookups cleanly.');
  } finally {
    if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    if (prevAnon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevAnon;
    if (prevSvc === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevSvc;
  }

  // 4. Exhaustive 3x6x6 (108-case) RBAC transition & action matrix
  const allowedTransitionsByRole = {
    editor: new Set(['draft->review', 'review->draft']),
    publisher: new Set([
      'draft->review',
      'review->draft',
      'review->approved',
      'approved->draft',
      'approved->review',
      'approved->scheduled',
      'approved->published',
      'scheduled->approved',
      'scheduled->draft',
      'scheduled->published',
      'published->archived',
      'archived->draft',
    ]),
    admin: new Set([
      'draft->review',
      'review->draft',
      'review->approved',
      'approved->draft',
      'approved->review',
      'approved->scheduled',
      'approved->published',
      'scheduled->approved',
      'scheduled->draft',
      'scheduled->published',
      'published->archived',
      'archived->draft',
    ]),
  };

  let checks = 0;
  for (const role of rolesMod.EDITORIAL_ROLES) {
    for (const from of rolesMod.ARTICLE_STATUSES) {
      for (const to of rolesMod.ARTICLE_STATUSES) {
        checks += 1;
        const result = rbacMod.canTransitionArticleStatus(role, from, to);
        assert.equal(result.allowed, allowedTransitionsByRole[role].has(`${from}->${to}`));
      }
    }
  }
  assert.equal(checks, 108);

  // Also test DI mocks for remaining edge cases
  await assert.rejects(
    () =>
      staffAuthMod.requireStaffSession(
        {},
        {
          isConfigured: () => false,
          getAuthenticatedUser: async () => ({ id: 'a' }),
          findStaffByAuthUserId: async () => makeStaff(),
        }
      ),
    (err) => err.status === 503 && err.code === 'CMS_NOT_CONFIGURED'
  );
  await assert.rejects(
    () =>
      staffAuthMod.requireStaffSession(
        {},
        {
          isConfigured: () => true,
          getAuthenticatedUser: async () => ({ id: 'a', email: 'other@strovyn.com.au' }),
          findStaffByAuthUserId: async () => makeStaff({ email: 'staff@strovyn.com.au' }),
        }
      ),
    (err) => err.status === 403 && err.code === 'FORBIDDEN'
  );
  console.log('[OK] 108-case RBAC transition matrix and staffAuth DI checks passed.');

  // 5. Client bundle isolation check
  const nextStaticDir = path.join(REPO_ROOT, '.next', 'static');
  if (fs.existsSync(nextStaticDir)) {
    const stack = [nextStaticDir];
    let scannedFiles = 0;
    while (stack.length > 0) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else if (/\.(js|mjs|cjs)$/.test(entry.name)) {
          scannedFiles += 1;
          const content = fs.readFileSync(full, 'utf8');
          assert.equal(content.includes('SUPABASE_SERVICE_ROLE_KEY'), false);
          assert.equal(content.includes('createServiceRoleClient'), false);
          assert.equal(content.includes('cms_transition_article_status'), false);
        }
      }
    }
    console.log(`[OK] Client bundle isolation verified across ${scannedFiles} built .next/static chunks.`);
  }

  console.log('=== ALL CMS-1.4 UNIT & RBAC CHECKS PASSED ===');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
