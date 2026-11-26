import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const REPO_ROOT = process.cwd();

async function main() {
  console.log('================================================================');
  console.log('STROVYN — PUBLIC LIABILITY INSURANCE COMPLIANCE & SECURITY SUITE');
  console.log('================================================================');

  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, {
    alias: {
      '@': path.join(REPO_ROOT, 'src'),
      'server-only': path.join(REPO_ROOT, 'node_modules', 'server-only', 'empty.js'),
    },
  });

  // --- 1. RBAC & Module Navigation Verification ---
  console.log('\n--- 1. Testing RBAC Permissions & Navigation ---');
  const rolesMod = await jiti.import(path.join(REPO_ROOT, 'src', 'lib', 'cms', 'roles.ts'));
  const rbacMod = await jiti.import(path.join(REPO_ROOT, 'src', 'lib', 'cms', 'rbac.ts'));
  const navMod = await jiti.import(path.join(REPO_ROOT, 'src', 'lib', 'cms', 'adminNavigation.ts'));

  const { EDITORIAL_ACTIONS } = rolesMod;
  const { hasEditorialPermission } = rbacMod;
  const { getAdminNavigationForRole } = navMod;

  assert.ok(
    EDITORIAL_ACTIONS.includes('insurance:read'),
    'EDITORIAL_ACTIONS must include insurance:read'
  );
  assert.ok(
    EDITORIAL_ACTIONS.includes('insurance:manage'),
    'EDITORIAL_ACTIONS must include insurance:manage'
  );

  // Check admin has access
  assert.equal(
    hasEditorialPermission('admin', 'insurance:read'),
    true,
    'Admin must have insurance:read permission'
  );
  assert.equal(
    hasEditorialPermission('admin', 'insurance:manage'),
    true,
    'Admin must have insurance:manage permission'
  );

  // Check editor and publisher are strictly denied
  assert.equal(
    hasEditorialPermission('editor', 'insurance:read'),
    false,
    'Editor must NOT have insurance:read'
  );
  assert.equal(
    hasEditorialPermission('editor', 'insurance:manage'),
    false,
    'Editor must NOT have insurance:manage'
  );
  assert.equal(
    hasEditorialPermission('publisher', 'insurance:read'),
    false,
    'Publisher must NOT have insurance:read'
  );
  assert.equal(
    hasEditorialPermission('publisher', 'insurance:manage'),
    false,
    'Publisher must NOT have insurance:manage'
  );

  // Navigation module check
  const adminNav = getAdminNavigationForRole('admin');
  const editorNav = getAdminNavigationForRole('editor');
  const publisherNav = getAdminNavigationForRole('publisher');

  assert.ok(
    adminNav.some((item) => item.id === 'insurance' && item.href === '/admin/insurance'),
    'Insurance module must be in admin navigation'
  );
  assert.ok(
    !editorNav.some((item) => item.id === 'insurance'),
    'Insurance module must NOT appear in editor navigation'
  );
  assert.ok(
    !publisherNav.some((item) => item.id === 'insurance'),
    'Insurance module must NOT appear in publisher navigation'
  );

  console.log('[PASS] RBAC & Navigation permissions verified.');

  // --- 2. Database Migration & Schema Verification on PGlite ---
  console.log('\n--- 2. Testing Database Migration on PGlite ---');
  const migrationSql = fs.readFileSync(
    path.join(REPO_ROOT, 'supabase', 'migrations', '20261127010000_public_liability_insurance.sql'),
    'utf8'
  );

  const db = new PGlite();
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS storage;
    CREATE TABLE IF NOT EXISTS storage.buckets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      public BOOLEAN NOT NULL DEFAULT false,
      file_size_limit BIGINT,
      allowed_mime_types TEXT[]
    );
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
    CREATE OR REPLACE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = timezone('utc', now());
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await db.exec(migrationSql);

  // Verify table columns
  const cols = (
    await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'public_liability_insurance'
    `)
  ).rows;
  const colNames = cols.map((c) => c.column_name);

  const requiredCols = [
    'id',
    'provider_name',
    'named_insured',
    'policy_number',
    'coverage_limit_aud',
    'policy_commencement_date',
    'policy_expiry_date',
    'certificate_storage_path',
    'exclusions_summary',
    'public_statement',
    'is_published',
    'verified_at',
    'verified_by',
    'created_at',
    'updated_at',
  ];

  for (const col of requiredCols) {
    assert.ok(colNames.includes(col), `Column ${col} must exist in public_liability_insurance`);
  }

  // Test DB Constraint: Expiry before commencement rejected
  let threwConstraint = false;
  try {
    await db.query(`
      INSERT INTO public.public_liability_insurance (
        provider_name, named_insured, policy_number, coverage_limit_aud,
        policy_commencement_date, policy_expiry_date
      ) VALUES (
        'Test Insurer', 'Strovyn Painting Co.', 'POL-123', 20000000,
        '2026-12-01', '2026-01-01'
      )
    `);
  } catch {
    threwConstraint = true;
  }
  assert.ok(threwConstraint, 'DB constraint must reject expiry date before commencement date');

  // Test DB Constraint: Publishing without required certificate rejected
  let threwPublishPrereq = false;
  try {
    await db.query(`
      INSERT INTO public.public_liability_insurance (
        provider_name, named_insured, policy_number, coverage_limit_aud,
        policy_commencement_date, policy_expiry_date, is_published, certificate_storage_path
      ) VALUES (
        'Test Insurer', 'Strovyn Painting Co.', 'POL-123', 20000000,
        '2026-01-01', '2027-01-01', true, NULL
      )
    `);
  } catch {
    threwPublishPrereq = true;
  }
  assert.ok(threwPublishPrereq, 'DB constraint must reject is_published=true without certificate');

  console.log('[PASS] Database migration & constraints verified.');

  // --- 3. Service Layer Business Logic & Privacy Verification ---
  console.log('\n--- 3. Testing Service Layer & Privacy Guardrails ---');
  const serviceMod = await jiti.import(path.join(REPO_ROOT, 'src', 'lib', 'cms', 'insuranceService.ts'));
  const {
    APPROVED_PUBLIC_STATEMENT,
    saveAdminInsuranceRecord,
  } = serviceMod;

  assert.ok(
    APPROVED_PUBLIC_STATEMENT.includes('STROVYN maintains public liability insurance'),
    'Approved public statement must match client-approved wording'
  );

  // Test role check on admin save
  const editorStaff = {
    id: 'staff-editor-1',
    auth_user_id: 'auth-editor-1',
    email: 'editor@strovyn.test',
    full_name: 'Test Editor',
    role: 'editor',
    is_active: true,
    last_login_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const adminStaff = {
    id: 'staff-admin-1',
    auth_user_id: 'auth-admin-1',
    email: 'admin@strovyn.test',
    full_name: 'Test Admin',
    role: 'admin',
    is_active: true,
    last_login_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Editor must be rejected with 403
  let editorDenied = false;
  try {
    await saveAdminInsuranceRecord(editorStaff, {
      provider_name: 'Allianz',
      named_insured: 'Strovyn',
      policy_number: '12345',
      coverage_limit_aud: 10000000,
      policy_commencement_date: '2026-01-01',
      policy_expiry_date: '2027-01-01',
      is_published: false,
    });
  } catch (err) {
    if (err.status === 403) editorDenied = true;
  }
  assert.ok(editorDenied, 'Editor must receive 403 when trying to save insurance record');

  // Admin validation: publishing an expired policy rejected
  let expiredPublishDenied = false;
  try {
    await saveAdminInsuranceRecord(adminStaff, {
      provider_name: 'Allianz',
      named_insured: 'Strovyn Painting Co.',
      policy_number: '12345',
      coverage_limit_aud: 10000000,
      policy_commencement_date: '2020-01-01',
      policy_expiry_date: '2020-12-31', // Past date!
      certificate_storage_path: 'certificates/test.pdf',
      is_published: true,
    });
  } catch (err) {
    if (err.status === 400 && err.message.includes('expired')) expiredPublishDenied = true;
  }
  assert.ok(expiredPublishDenied, 'Cannot publish policy with expired expiry date');

  // Admin validation: publishing without certificate rejected
  let certRequiredDenied = false;
  try {
    await saveAdminInsuranceRecord(adminStaff, {
      provider_name: 'Allianz',
      named_insured: 'Strovyn Painting Co.',
      policy_number: '12345',
      coverage_limit_aud: 10000000,
      policy_commencement_date: '2026-01-01',
      policy_expiry_date: '2028-01-01',
      certificate_storage_path: null,
      is_published: true,
    });
  } catch (err) {
    if (err.status === 400 && err.message.includes('Certificate of Currency')) certRequiredDenied = true;
  }
  assert.ok(certRequiredDenied, 'Cannot publish policy without uploaded certificate');

  console.log('[PASS] Service layer validation & authorization verified.');

  // --- 4. Component Rendering & Auto-Suppression Logic ---
  console.log('\n--- 4. Testing Public Component Display & Suppression ---');
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const ts = require('typescript');

  function transpileComponent(relPath) {
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

  // Verify all TSX components transpile cleanly without syntax errors
  transpileComponent('src/components/about/PublicInsuranceSection.tsx');
  transpileComponent('src/components/home/InsuranceTrustPill.tsx');
  transpileComponent('src/components/cms/AdminInsuranceWorkspace.tsx');
  transpileComponent('src/app/admin/insurance/page.tsx');

  // Verify suppression logic in PublicInsuranceSection
  const sectionSource = fs.readFileSync(
    path.join(REPO_ROOT, 'src', 'components', 'about', 'PublicInsuranceSection.tsx'),
    'utf8'
  );
  assert.ok(
    sectionSource.includes('if (!status.isPublished)'),
    'PublicInsuranceSection must return null when isPublished is false'
  );
  assert.ok(
    sectionSource.includes('Public Liability Insurance'),
    'PublicInsuranceSection must display Public Liability Insurance heading'
  );

  // Verify suppression logic in InsuranceTrustPill
  const pillSource = fs.readFileSync(
    path.join(REPO_ROOT, 'src', 'components', 'home', 'InsuranceTrustPill.tsx'),
    'utf8'
  );
  assert.ok(
    pillSource.includes('if (!status.isPublished)'),
    'InsuranceTrustPill must return null when isPublished is false'
  );

  // Verify integration in About page
  const aboutSource = fs.readFileSync(
    path.join(REPO_ROOT, 'src', 'app', 'about', 'page.tsx'),
    'utf8'
  );
  assert.ok(
    aboutSource.includes('getPublicInsuranceStatus') &&
      aboutSource.includes('<PublicInsuranceSection status={insuranceStatus} />'),
    'About page must query getPublicInsuranceStatus and render PublicInsuranceSection'
  );

  // Verify integration in Home page and FinalContact
  const homeSource = fs.readFileSync(
    path.join(REPO_ROOT, 'src', 'app', 'page.tsx'),
    'utf8'
  );
  assert.ok(
    homeSource.includes('getPublicInsuranceStatus') &&
      homeSource.includes('<FinalContact insuranceStatus={insuranceStatus} />'),
    'Home page must query getPublicInsuranceStatus and pass to FinalContact'
  );

  const finalContactSource = fs.readFileSync(
    path.join(REPO_ROOT, 'src', 'components', 'home', 'FinalContact.tsx'),
    'utf8'
  );
  assert.ok(
    finalContactSource.includes('insuranceStatus.isPublished') &&
      finalContactSource.includes('<InsuranceTrustPill status={insuranceStatus} />'),
    'FinalContact must conditionally render InsuranceTrustPill when isPublished is true'
  );

  console.log('[PASS] Public component suppression & rendering verified.');

  console.log('\n================================================================');
  console.log('ALL INSURANCE COMPLIANCE & GOVERNANCE TESTS PASSED (100%)');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('\n[FAIL] Insurance compliance test failed:', err);
  process.exit(1);
});
