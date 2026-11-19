# STROVYN EDITORIAL CMS — PHASE 0 ARCHITECTURE & READINESS SPECIFICATION

**Baseline Repository:** `https://github.com/nayefsiddique-eng/strovyn-.git`  
**Verified Branch & Commit:** `main` @ `91eb515` (`origin/main` synchronized)  
**Target Stack:** Next.js `16.4.6` (App Router, `cacheComponents: true`, `partialPrefetching: true`) · React `19.3.0` · TypeScript `^5` · Supabase (`@supabase/supabase-js` `^2.119.0`, `@supabase/ssr` `^0.12.7`) · Zod `^4.6.7`

---

## 1. Read-Only Codebase & Baseline Validation

### 1.1 Existing Supabase Migrations & `articles` Schema
Inspected `supabase/migrations/001_initial_schema.sql` and `supabase/migrations/002_idempotency_and_hardening.sql`:

- **`001_initial_schema.sql` (`articles` table, lines 71–84):**
  - Columns: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `title TEXT NOT NULL`, `slug TEXT UNIQUE NOT NULL`, `content TEXT NOT NULL`, `excerpt TEXT NOT NULL`, `featured_image_url TEXT`, `category TEXT NOT NULL`, `status TEXT DEFAULT 'draft'` (`'draft'`, `'published'`), `reading_time INT DEFAULT 5`, `published_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()`.
  - RLS (`lines 158, 169`): RLS enabled (`ALTER TABLE articles ENABLE ROW LEVEL SECURITY`); only one policy exists: `"Public articles read" ON articles FOR SELECT USING (status = 'published')`.
  - No explicit secondary indexes exist beyond primary key (`id`) and unique constraint (`slug`).
- **`001_initial_schema.sql` (`profiles` table, lines 4–11):**
  - Exists (`id`, `email`, `full_name`, `role`, `created_at`, `updated_at`) with RLS enabled and zero RLS policies configured.
- **`002_idempotency_and_hardening.sql`:** Adds `idempotency_key` unique partial indexes to `quote_requests`, `job_applications`, and `customer_feedback`. Does not touch `articles`.

### 1.2 Inventory of All 7 Existing Articles (`src/data/articlesData.ts`)
Currently hardcoded in TypeScript (`ARTICLES_DATA`), using local `/images/*` and curated Unsplash URLs. Verified article URLs should be preserved, while unapproved heritage-implying slugs must be held out of public feeds until client sign-off (see **Section 11**):

| # | Slug | Title | Category | Date | Read Time | Flags / Cover |
|---|---|---|---|---|---|---|
| 1 | `achieving-as-nzs-2311-level-5-surface-standards` | Achieving Level 5 Surface Standards in High-Raking Sunlight | Surface Preparation | Feb 12, 2026 | 6 min | `featured: true` · `/images/architectural-paint-swatch.jpg` |
| 2 | `chemistry-of-potassium-silicate-mineral-coatings` | The Mineral Chemistry of Pure Potassium Silicate Coatings | Paint Chemistry | Jan 28, 2026 | 5 min | Unsplash `photo-1600585154340...` |
| 3 | `authentic-venetian-plaster-vs-synthetic-render` | Authentic Slaked Lime Plaster vs. Synthetic Textures: The Architect’s Guide | Painting Techniques | Jan 14, 2026 | 8 min | Unsplash `photo-1618221195710...` |
| 4 | `lead-safe-conservation-protocols-heritage-homes` | Modern Surface Preparation for Residential Painting | Surface Preparation | Nov 20, 2025 | 6 min | `/images/painted-texture-detail.jpg` |
| 5 | `architectural-sheen-selection-raking-light` | Architectural Sheen Selection Across High-Raking Daylight Planes | Painting Techniques | Oct 15, 2025 | 5 min | Unsplash `photo-1600210492486...` |
| 6 | `low-voc-waterborne-enamels-residential-joinery` | Waterborne Polyurethane Enamels for Interior Architectural Joinery | Paint Chemistry | Sep 28, 2025 | 5 min | Unsplash `photo-1556911220...` |
| 7 | `moisture-equilibration-masonry-coatings` | Substrate Moisture Equilibration in Architectural Masonry Painting | Surface Preparation | Aug 14, 2025 | 6 min | Unsplash `photo-1600596542815...` |

*(Note: `lead-safe-conservation-protocols-heritage-homes` has updated body content titled "Modern Surface Preparation for Residential Painting", **but the heritage-implying slug has NOT been confirmed by Strovyn**. Seed as `'draft'` under Section 11 pending client approval of a clean slug replacement.)*

### 1.3 Current Public Rendering & Caching Configuration
- **Homepage (`src/app/page.tsx` → `src/components/home/InsightsArticles.tsx`):** `'use client'` component calling static `getLatestArticles(3)`.
- **Listing (`src/app/insights/page.tsx`):** `'use client'` component calling `ARTICLES_DATA`, `getFeaturedArticle()`, and `getCategories()`, with category filtering, client search, and pagination (`ARTICLES_PER_PAGE = 6`). Wrapped by SSR metadata layout `src/app/insights/layout.tsx`.
- **Detail (`src/app/insights/[slug]/page.tsx`):** Async Server Component reading `ARTICLES_DATA`, exporting `generateStaticParams()` and `generateMetadata()`.
- **Next.js 16 Feature Flags (`next.config.ts`):** `cacheComponents: true` and `partialPrefetching: true` are enabled. **Critical implication:** Standard route-segment `export const revalidate` conflicts with `cacheComponents: true`; CMS data fetching must use Next.js 16 Cache Components directives (`'use cache'`, `cacheTag()`, `cacheLife()`) + `<Suspense>` boundaries and explicit invalidation (`revalidateTag(..., 'max')` / `revalidatePath()`).

### 1.4 Existing Auth, CSRF, Uploads & Storage Boundaries
- **Admin Auth (`src/lib/security/auth.ts`):** Uses shared passphrase `STROVYN_ADMIN_KEY` verified via `sha256` + `timingSafeEqual`, signing a single shared-role `'admin'` HMAC cookie (`ADMIN_SESSION_SECRET`, `8h` TTL) with in-memory + `private_storage/security/revoked_sessions.json` JTI revocation. **Limitation:** Cannot attribute edits/approvals to individual staff members or enforce Editor vs. Publisher roles.
- **Admin Photo Management (`/admin/photos`, `/api/admin/photos`):** Protects `GET`/`POST` with `verifySessionToken()`, fail-closed `Origin === Host` CSRF check, rate limiting (`5` attempts / `15m`), magic-byte image validation (`10MB` limit), and Supabase bucket `project-photos`.
- **Public Customer Upload (`/api/upload`):** Routes PDF/DOC/DOCX/JPEG/PNG/WebP (`15MB`) into **private** bucket `customer-documents`.
- **Supabase Server Client (`src/lib/supabase/server.ts`):** Uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` only. `SUPABASE_SERVICE_ROLE_KEY` is defined in `.env.local.example` as reserved server-only secret but has no client helper yet. `.env.local` does not exist on disk yet.

---

## 2. Resolved Architectural Decisions

### Decision 1 — Individual Staff Authentication & Enforceable RBAC
- **Model:** Replace the shared-password-only model for CMS access with **Supabase Auth (Email + Password / invite-only staff accounts)** combined with a server-enforced `staff_users` / `profiles` role table (`editor`, `publisher`, `admin`).
- **Enforcement:**
  - Public registration/self-signup is **disabled** in Supabase Auth (`Allow new users to sign up = OFF`); staff accounts are provisioned/invited strictly by an Admin.
  - Every `/admin/insights` UI route and `/api/admin/insights/**` endpoint reads the verified Supabase Auth JWT server-side (`supabase.auth.getUser()` — never `getSession()` alone), resolves the user's record in `staff_users` (`is_active = true`), and checks role permission before any action.
  - Legacy `/admin/photos` passphrase auth (`STROVYN_ADMIN_KEY`) remains backward-compatible for `/admin/photos` during transition or can optionally accept `admin`-role Supabase sessions cleanly without breaking existing security tests (`scripts/test-security.mjs`).

### Decision 2 — Additive Database Migration (`003_editorial_cms.sql`)
- Never modify `001_initial_schema.sql` or `002_idempotency_and_hardening.sql`.
- Keep existing `articles.status` unconstrained or safely add a `CHECK` constraint **after** validating existing rows, allowing all 6 lifecycle states: `'draft'`, `'review'`, `'approved'`, `'scheduled'`, `'published'`, `'archived'`.
- Keep existing `articles.content TEXT NOT NULL` intact alongside new structured fields (`content_json`, `content_html`) so legacy rows remain valid during and after migration.

### Decision 3 — Server-Only Service Role Boundary
- Create `src/lib/supabase/serviceRole.ts` marked with `import 'server-only';` (verified at build time so bundling into a `'use client'` module fails the build immediately).
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in client components or `NEXT_PUBLIC_*` vars.
- Anon client (`src/lib/supabase/server.ts`) serves public reads (`/`, `/insights`, `/insights/[slug]`, `/sitemap.xml`) strictly bounded by PostgreSQL RLS (`status = 'published' AND (published_at IS NULL OR published_at <= NOW())`).
- Service-role client handles: staff editorial CRUD (only after verifying `supabase.auth.getUser()` + active role), audit log inserts, and the cron publisher.

### Decision 4 — Structured Content Storage & Server-Side HTML Sanitization
- **Storage Format:** Store both canonical **ProseMirror/Tiptap JSON** (`content_json JSONB`) and pre-rendered **sanitized HTML** (`content_html TEXT`), plus a plain-text summary in `content TEXT` for search indexing and fallback.
- **Sanitization Boundary:** **Never trust client-submitted HTML.** On every create/update (`POST`/`PATCH`), validate `content_json` against a strict Zod node schema AND sanitize generated HTML server-side using a pure allowlist sanitizer (only `p`, `h2`, `h3`, `h4`, `strong`, `em`, `blockquote`, `ul`, `ol`, `li`, `a[href,rel,target]`, `img[src,alt,width,height]`, `hr`). Strip all `<script>`, `<style>`, `<iframe>`, `on*` attributes, `data:` URIs, and restrict `a[href]` / `img[src]` strictly to `https://` (approved hosts or `/images/`).

### Decision 5 — Dedicated Editorial Media Storage (`editorial-media`)
- Create a dedicated Supabase Storage bucket `editorial-media` (public-read via CDN URL, write/delete restricted to authenticated service-role API endpoints).
- **Never** upload, read, or link files from `customer-documents` (which remains strictly private for quotes and CVs).
- Reuse `validateUploadFile()` magic-byte inspection (`image/jpeg`, `image/png`, `image/webp`, max `5MB`), require non-empty `alt` text before article approval/scheduling, store metadata in an `article_media` tracking table or JSON reference, and support safe replacement/orphan deletion for unused draft images.

### Decision 6 — Hosting & Scheduler Selection (Platform Validation)
- **Current Finding:** No hosting config (`vercel.json`, `netlify.toml`, `railway.json`, `render.yaml`, `Dockerfile`, or `.github/workflows/`) is committed yet.
- **Architecture Decision:** Keep scheduler execution in a **stateless, secret-authenticated HTTP endpoint** (`POST /api/cron/publish-scheduled`) so it works identically regardless of whether the final host is **Vercel, Railway, Render, or a VPS**:
  - **Primary Option A (Vercel Pro):** Native `vercel.json` Cron triggering `/api/cron/publish-scheduled` every 5 minutes (`*/5 * * * *`) with `CRON_SECRET`.
  - **Primary Option B (Platform-Agnostic Zero-Cost):** GitHub Actions scheduled workflow (`.github/workflows/publish-scheduled.yml`, `*/5 * * * *`) issuing a signed `POST` with `Authorization: Bearer ${{ secrets.CRON_SECRET }}` — works with **any** host (Vercel Hobby, Railway, Render, VPS) at **$0 cost** once repository secrets are configured.
  - **Reject:** In-process JS `setInterval` / `node-cron` inside Next.js routes (unreliable on serverless or sleeping containers).

### Decision 7 — Atomic Publishing, Retries, Idempotency & Audit Trail
- **PostgreSQL Atomic Transition Function (`publish_due_scheduled_articles()` RPC or transactional SQL):**
  - Selects ONLY rows where `status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= NOW() AND (next_retry_at IS NULL OR next_retry_at <= NOW())`.
  - Uses row-level `FOR UPDATE SKIP LOCKED` + precondition check (`title`, `slug`, `excerpt`, body non-empty, `featured_image_alt` non-empty if `featured_image_url` is set) to transition `status = 'published'`, `published_at = COALESCE(published_at, scheduled_at, NOW())`.
  - Prevents duplicate execution when two cron runs overlap.
- **Retries & Failure Logging:** If validation or cache invalidation fails for a row, increment `publish_attempts`, write `last_publish_error`, set `next_retry_at = NOW() + interval '5 minutes' * LEAST(publish_attempts, 6)`, record an entry in `article_audit_log`, and alert via `RESEND_API_KEY` admin notification after ≥ 3 failures.

### Decision 8 — Static-to-DB Transition & URL Continuity
- **Data Access Abstraction (`src/lib/articles.ts`):** Expose `getPublishedArticles()`, `getPublishedArticleBySlug(slug)`, `getFeaturedPublishedArticle()`, `getLatestPublishedArticles(limit)`.
- **Zero Downtime & Verified-Only Transition:**
  1. Seed the 7 existing articles from `ARTICLES_DATA` into Supabase (`003` seed script) following the **Section 11 Tiered Seeding Policy** (verified articles → `published`, editorial-review articles → `review`, unapproved heritage-slug article → `draft`), preserving historical timestamps and records without deleting source data.
  2. When Supabase env vars are configured, public pages read from Supabase (`'use cache'` + `cacheTag('articles')`); if Supabase is unconfigured in local dev (`!isSupabaseConfigured()`), fall back cleanly **only** to verified Tier 1 articles (never serving unapproved/heritage-slug drafts publicly).
  3. Preserve verified URLs (`/insights/<slug>`); retire/replace unapproved slugs via archive or explicit 301 redirect once approved. Update the hardcoded Practitioner Note in `src/app/insights/[slug]/page.tsx` so it does not blanket-claim universal AS/NZS 2311 compliance on every article.

### Decision 9 — Secure Unpublished Preview Access
- Unpublished statuses (`draft`, `review`, `approved`, `scheduled`, `archived`) return `notFound()` (HTTP 404) on `/insights/[slug]` by default.
- Preview is permitted **only** via:
  1. **Authenticated Preview Route (`/admin/insights/preview/[id]`):** Server component gated by verified Supabase staff session, fetching via `createServiceRoleClient()`, rendering with `<meta name="robots" content="noindex, nofollow">` and HTTP header `Cache-Control: private, no-store`.
  2. **Time-Limited Signed Share Preview Link (`/insights/[slug]?preview=<hmac_token>`):** Short-lived (e.g., `1 hour`) HMAC token encoding `{ articleId, exp }` verified via `timingSafeEqual` inside `<Suspense>` (never cached in CDN/ISR because `searchParams` opts out cleanly under explicit `no-store` / preview boundary).

### Decision 10 — SEO Metadata, Structured Data, Sitemap & Cache Invalidation
- **Cache Components (`next.config.ts` `cacheComponents: true`):** Cached article queries carry `cacheTag('articles')` and `cacheTag('article:' + slug)` with `cacheLife({ revalidate: 300, expire: 3600 })`.
- **Instant Invalidation:** Publish, edit-live, archive, and cron endpoints call `revalidateTag('articles', 'max')`, `revalidateTag('article:' + slug, 'max')`, `revalidatePath('/')`, `revalidatePath('/insights')`, `revalidatePath('/insights/' + slug)`, and `revalidatePath('/sitemap.xml')`.
- **Metadata & JSON-LD:** `generateMetadata()` emits `seo_title || title`, `seo_description || excerpt`, canonical URL (`NEXT_PUBLIC_SITE_URL/insights/${slug}`), `openGraph` (`type: 'article'`, `publishedTime`, `modifiedTime`, `images`), and JSON-LD `@type: 'Article'`.
- **Sitemap & Robots:** Add `src/app/sitemap.ts` (including all published article slugs + static routes) and `src/app/robots.ts` (blocking `/admin/` and `/api/` from search crawlers).

---

## 4. Complete Staff Editorial Workflow Specification

```text
  [Draft] ──(submit)──▶ [Review] ──(approve)──▶ [Approved] ──┬──(set future time)──▶ [Scheduled] ──(cron / now)──▶ [Published]
     ▲                      │                       │                                      │                            │
     └────(request changes)─┴───────────────────────┴───────────(unschedule)───────────────┘                            │
                                                                                                                        ▼
                                                                                                                    [Archived]
```

| Transition | Permitted Roles | Mandatory Preconditions | System Side Effects |
|---|---|---|---|
| **Create -> `draft`** | Editor, Publisher, Admin | `title`, valid unique `slug`, `category` | Saves `author_id`, audit log `create_draft`. Never public. |
| **Edit `draft` / `review`** | Editor (own or all drafts), Publisher, Admin | Valid schema, sanitized HTML | Updates `updated_at`, `updated_by`, audit log entry. |
| **`draft` -> `review`** | Editor, Publisher, Admin | `title`, `slug`, `excerpt`, non-empty body, `featured_image_alt` (if image set) | Audit log `submit_for_review`. Still private (404 publicly). |
| **`review` -> `draft`** | Editor, Publisher, Admin | Optional review note | Returns to draft for revision. |
| **`review` -> `approved`** | **Publisher, Admin only** | All required fields + SEO review check | Marks `approved_by`, `approved_at`. Still NOT public. |
| **`approved` -> `scheduled`** | **Publisher, Admin only** | Valid future UTC `scheduled_at` (`> NOW()`) | Indexed for cron pickup. Still NOT public. |
| **`scheduled` -> `approved` / `draft`** | **Publisher, Admin only** | Clear or preserve future schedule | Cancels pending auto-publish immediately. |
| **`approved` / `scheduled` -> `published`** | **Publisher, Admin only** (or System Cron for `scheduled` when `scheduled_at <= NOW()`) | `status` precondition verified atomically | Sets `published_at`, audit log `publish`, flushes cache tags & sitemap. Immediately live. |
| **Edit `published` article** | **Publisher, Admin only** *(Editor edits create a draft proposal or are blocked from mutating live rows)* | Full field validation + HTML sanitization | Preserves original `published_at`, updates `updated_at`, flushes cache tags. |
| **`published` -> `archived`** | **Publisher, Admin only** | Confirmation in UI | Sets `archived_at`, flushes cache tags & sitemap; route returns 404 publicly. |

---

## 5. Authentication & Permissions Matrix

| Capability / Route / Action | Public Visitor | `editor` | `publisher` | `admin` | System Cron (`CRON_SECRET`) |
|---|---|---|---|---|---|
| View `/`, `/insights`, `/insights/[slug]` (`status = 'published'`) | Allow | Allow | Allow | Allow | — |
| View unpublished article (`draft`/`review`/`approved`/`scheduled`/`archived`) | **404** | Own/All via `/admin/insights/preview` | Via Admin Preview | Via Admin Preview | **No** |
| Share tokenized preview link | Only w/ valid HMAC `?preview=` | Generate for drafts | Generate | Generate | **No** |
| Login `/admin/insights` (Supabase Auth, invite-only) | **Denied** | Allow | Allow | Allow | **No** |
| Create / Edit `draft`, Upload editorial image (`editorial-media`) | **401** | Allow | Allow | Allow | **No** |
| Transition `draft` ↔ `review` | **401** | Allow | Allow | Allow | **No** |
| Transition `review` → `approved` | **401** | **403 Forbidden** | Allow | Allow | **No** |
| Schedule / Publish / Edit Live / Archive article | **401** | **403 Forbidden** | Allow | Allow | `scheduled` → `published` only |
| Manage Staff Roles (`staff_users`) | **401** | **403 Forbidden** | **403 Forbidden** | Allow | **No** |
| Existing `/admin/photos` portal | Unchanged during CMS-1 (continues using `STROVYN_ADMIN_KEY` passphrase auth) | — | — | — | — |

---

## 6. Database Migration Impact Assessment

| Migration File | Impact on Existing Data | Constraints & Safety Checks |
|---|---|---|
| `001_initial_schema.sql` | Untouched (never rewrite historical migrations) | Retains existing tables & public `articles` read RLS. |
| `002_idempotency_and_hardening.sql` | Untouched | Preserves quote/application/feedback idempotency. |
| **`003_editorial_cms.sql` (Planned Additive)** | Zero data loss. Existing `articles` rows retain original `id`, `slug`, `content`, and `status`. All 7 existing static articles are seeded cleanly using **Section 11's Tiered Policy**: **3** `'published'`, **3** `'review'`, **1** `'draft'` (`lead-safe-conservation-protocols-heritage-homes`). | 1. Use `ALTER TABLE articles ADD COLUMN IF NOT EXISTS ...`.<br>2. Migrate/verify any existing rows before adding `CHECK (status IN ('draft','review','approved','scheduled','published','archived'))`.<br>3. Add conditional `CHECK (status <> 'scheduled' OR scheduled_at IS NOT NULL)`.<br>4. Create `staff_users`, `article_audit_log`, `revoked_admin_sessions` (with RLS enabled + zero anon access).<br>5. Add partial indexes (`articles_scheduled_due_idx`, `articles_published_feed_idx`, `article_audit_log_article_idx`). |

---

## 7. Hosting & Scheduler Compatibility Assessment

- **Repository Hosting State:** Platform-agnostic Next.js 16 SSR build (`next build && next start`). No host config committed yet.
- **Compatibility with `next.config.ts` (`cacheComponents: true`):**
  - **Vercel (Pro or Hobby):** Full native support for Cache Components, Partial Prefetching, `revalidateTag`, `revalidatePath`, and image optimization. Note: Vercel Hobby cron jobs are limited to daily frequency unless triggered externally, whereas Vercel Pro supports 5-minute crons natively.
  - **Railway / Render / VPS:** Supports persistent Node `20+` SSR + Next.js Cache Components (`incrementalCache`), compatible with external cron hitting `POST /api/cron/publish-scheduled` every 5 minutes.
  - **Recommended Zero-Cost Platform-Independent Cron:** GitHub Actions scheduled workflow (`*/5 * * * *`) or Uptime/Cron webhook calling `https://<domain>/api/cron/publish-scheduled` with `Authorization: Bearer <CRON_SECRET>` works cleanly on **any** host (including Vercel Hobby, Railway, Render) without vendor lock-in.

---

## 8. Implementation Sequence & Acceptance Criteria

1. **Milestone CMS-1 — Database & Server Security Core (Hosting-Independent)**
   - *Deliverables:* `supabase/migrations/003_editorial_cms.sql` (preserving `001` & `002`), idempotent tiered seed script (Section 11: 3 `published`, 3 `review`, 1 `draft`), `src/lib/supabase/serviceRole.ts` (`server-only`), Supabase Auth staff helper & RBAC guards (`editor`/`publisher`/`admin`). Leaves `/admin/photos` passphrase auth untouched.
   - *Acceptance Criteria:* Migration runs cleanly on fresh + seeded DB; zero dependency on hosting-platform choice; client bundle audit verifies zero `SUPABASE_SERVICE_ROLE_KEY` leakage; role matrix rejects unauthorized actions (`401`/`403`).
2. **Milestone CMS-2 — Editorial APIs, Sanitization & Media Pipeline**
   - *Deliverables:* `/api/admin/insights` CRUD + workflow state machine endpoints, strict server HTML/JSON sanitizer, Zod validators, `/api/admin/insights/media` (`editorial-media` bucket, `5MB`, JPEG/PNG/WebP magic-byte check, alt text enforcement), audit logging.
   - *Acceptance Criteria:* Invalid transitions (e.g., Editor attempting `draft -> published`) return `403`; XSS payloads in editor HTML/links are stripped; private `customer-documents` remains inaccessible.
3. **Milestone CMS-3 — Staff Editorial Dashboard (`/admin/insights`)**
   - *Deliverables:* Staff login view, filterable status tabs (`Draft`, `Review`, `Approved`, `Scheduled`, `Published`, `Archived`), rich-text editor (Tiptap configured for React 19 `immediatelyRender: false`), media picker/uploader with alt-text input, Adelaide-timezone schedule picker, SEO preview card, revision/audit drawer, and staff-gated live-typography preview (`/admin/insights/preview/[id]`).
   - *Acceptance Criteria:* Full workflow exercised end-to-end; unsaved edits warn before navigation; mobile & desktop staff UI verified cleanly.
4. **Milestone CMS-4 — Scheduled Publisher & Dynamic Public Website**
   - *Deliverables:* Idempotent atomic `POST /api/cron/publish-scheduled` (`CRON_SECRET`), `src/lib/articles.ts` (Cache Components `'use cache'` + `cacheTag('articles')` + local fallback when DB unconfigured), dynamic `/insights`, `/insights/[slug]`, and `InsightsArticles` SSR wrapper, `src/app/sitemap.ts`, `src/app/robots.ts`, `Article` JSON-LD, OpenGraph article tags.
   - *Acceptance Criteria:* Cron call publishes due `scheduled` row once, skips `draft`/`review`/`future scheduled`, updates `/`, `/insights`, `/insights/[slug]`, and `/sitemap.xml` without redeployment; unpublished slugs return `404` without valid preview.
5. **Milestone CMS-5 — Test Suite & Live Production Verification**
   - *Deliverables:* Automated security/RBAC/sanitization/cron-idempotency test suite in `scripts/`, production build (`40+` routes), Playwright browser QA (Light/Dark + responsive), live verification against real Supabase + host cron.
   - *Acceptance Criteria:* All automated checks pass after final edit; verified end-to-end in staging/production environment.

---

## 9. External Configuration Checklist

- [ ] **Supabase Project Setup:** Provision live project, obtain `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] **Apply SQL Migrations:** Run `001_initial_schema.sql`, `002_idempotency_and_hardening.sql`, and future `003_editorial_cms.sql` in order; run 7-article seed.
- [ ] **Supabase Auth Configuration:** Disable public signup (`Allow new users to sign up = OFF`); invite initial staff emails and assign `admin` / `publisher` / `editor` roles in `staff_users`.
- [ ] **Supabase Storage Buckets:**
  - `editorial-media`: Public read, write/delete via service role only.
  - `project-photos`: Existing bucket for `/admin/photos`.
  - `customer-documents`: Strictly **Private** (never public).
- [ ] **Environment Variables on Host:** Configure `NEXT_PUBLIC_SITE_URL`, Supabase keys (`URL`, `ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), `CRON_SECRET` (≥ 32 random bytes), `RESEND_API_KEY` + verified domain (`RESEND_FROM_EMAIL`, `NOTIFICATION_EMAIL`), existing `STROVYN_ADMIN_KEY` & `ADMIN_SESSION_SECRET`.
- [ ] **Host Cron Setup:** Configure 5-minute cron trigger (`vercel.json` on Vercel Pro or GitHub Actions `.github/workflows/publish-scheduled.yml` / external host cron) targeting `/api/cron/publish-scheduled` with `CRON_SECRET`.

---

## 10. Unresolved Decisions & Risks

1. **Client Content Sign-Off Required (Phase 0.1):** Confirm fate of Article #4 (`lead-safe-conservation-protocols-heritage-homes` -> retire vs. republish under non-heritage slug), confirm offering Venetian Marmorino plaster (Article #3) & mineral silicate wording (Article #2), and approve removing the blanket AS/NZS 2311 footer assertion on `/insights/[slug]` (plus adjacent heritage labels in `servicesData.ts` & `constants.ts` in a dedicated cleanup).
2. **Hosting Provider Confirmation Required (Needed Before CMS-4 Scheduler Wiring, NOT Blocking CMS-1):** Exact target host (Vercel Hobby vs. Vercel Pro vs. Railway/Render) determines whether `vercel.json` native cron or GitHub Actions external cron triggers `/api/cron/publish-scheduled`.
3. **Legacy `/admin/photos` Auth Alignment:** Retained unchanged (`STROVYN_ADMIN_KEY`) during `CMS-1`; decide whether to unify behind Supabase Auth `admin` role later in `CMS-3`.
4. **Rich-Text Editor Package Compatibility:** React `19.3.0` is installed; before CMS-2/3 package install, verify `@tiptap/react` peer dependencies and configure `immediatelyRender: false` under Next.js 16 SSR.
5. **Live Environment Testing Constraint:** Full end-to-end verification of Supabase Auth, RLS, `editorial-media` uploads, ISR invalidation, and real cron execution cannot be completed against local mocks alone — live staging/production credentials are mandatory in CMS-5.

---

## 11. Content Integrity Audit & Migration Seeding Policy (Phase 0.1)

### 11.1 Confirmed Strovyn Business Baseline vs. Audit Scope
Confirmed in `src/lib/constants.ts` and client guidance: Strovyn Painting Co. operates across Greater Adelaide, South Australia (WhatsApp `0406 646 061`) providing residential & commercial painting, interior precision finishes, exterior cladding, cabinet/millwork finishing, and daylight sign-offs. **Strovyn has NOT confirmed that it offers heritage restoration, historic-building remediation, or specialist conservation services.**

### 11.2 Article-by-Article Content Integrity Findings

| # | Slug & Exact Title | Claims / Technical Statements | Verification Finding | Recommended Initial Status | URL Policy |
|---|---|---|---|---|---|
| **1** | `achieving-as-nzs-2311-level-5-surface-standards`<br>*Achieving Level 5 Surface Standards in High-Raking Sunlight* | Explains Level 4 vs Level 5 drywall finishing under raking light, full skim coating, and raking cross-light inspection. | Article body is general technical prep education with zero unverified company warranties/qualifications. *(Note: slug mentions `as-nzs-2311`, and the shared `insights/[slug]/page.tsx` practitioner note blanket-claims strict AS/NZS 2311 correspondence — remove blanket template claim in CMS-4.)* | **`published`** | Preserve existing URL |
| **2** | `chemistry-of-potassium-silicate-mineral-coatings`<br>*The Mineral Chemistry of Pure Potassium Silicate Coatings* | Contrasts acrylic films vs potassium silicate (`waterglass`), silicification reaction, European **EN 1062-1 Class 1** vapor permeability, and `"century-long permanence"` in excerpt. | Broad `"century-long permanence"` claim in excerpt and European EN 1062-1 Class 1 spec are unverified against specific products Strovyn supplies in Adelaide. Needs editorial moderation. | **`review`** | Preserve existing URL once reviewed |
| **3** | `authentic-venetian-plaster-vs-synthetic-render`<br>*Authentic Slaked Lime Plaster vs. Synthetic Textures: The Architect’s Guide* | Contrasts Italian Marmorino (slaked lime + Carrara marble dust curing via carbonation), `pH 12–13` alkalinity, mold/bacteria resistance. | Educational material comparison without explicit warranties, **but** specialized Venetian Marmorino / Carrara lime plastering requires explicit client confirmation as an offered Adelaide service. | **`review`** | Preserve URL pending client service sign-off |
| **4** | `lead-safe-conservation-protocols-heritage-homes`<br>*Modern Surface Preparation for Residential Painting* | Body text describes general residential prep (cleaning, filling, priming) plus a safety note advising licensed remediation for pre-1970 hazardous coatings. | **CRITICAL SLUG MISMATCH:** Body text was previously rewritten cleanly, **but the URL slug `lead-safe-conservation-protocols-heritage-homes` falsely implies heritage restoration and lead conservation services**, which Strovyn has NOT confirmed. Must NOT be publicly live under a heritage/conservation slug. | **`draft`** *(Unpublished — requires client approval & new clean slug)* | **Do NOT keep live.** Create approved slug (e.g. `modern-surface-preparation-residential-painting`) if client approves; retire old heritage URL. |
| **5** | `architectural-sheen-selection-raking-light`<br>*Architectural Sheen Selection Across High-Raking Daylight Planes* | Explains `1–3%` dead-flat/matte light dispersion vs eggshell/satin washability balanced by room orientation. | Clean technical painting guidance aligned with confirmed interior & woodwork finishing scope. Zero fabricated guarantees or certifications. | **`published`** | Preserve existing URL |
| **6** | `low-voc-waterborne-enamels-residential-joinery`<br>*Waterborne Polyurethane Enamels for Interior Architectural Joinery* | Contrasts solvent alkyds vs low-VOC waterborne polyurethane acrylics; states coatings `"achieve full block resistance within 24 to 48 hours"`. | Matches confirmed woodwork/joinery scope, **but** the specific `24 to 48 hours` block-resistance timeframe varies by product TDS and summer humidity and requires editorial qualification. | **`review`** | Preserve existing URL once reviewed |
| **7** | `moisture-equilibration-masonry-coatings`<br>*Substrate Moisture Equilibration in Architectural Masonry Painting* | Explains efflorescence/blistering prevention, electrical impedance & pin-probe moisture diagnostics, and breathable exterior mineral/micro-porous systems. | Clean educational substrate best practice aligned with confirmed exterior coating work; no fabricated warranties or heritage conservation claims. *(Confirm diagnostic meter phrasing during routine review if needed.)* | **`published`** | Preserve existing URL |

### 11.3 Safe Seeding Policy & Guardrails for `CMS-1`
1. **Preserve Original Static Source Untouched:** Do not delete records from `src/data/articlesData.ts` during `CMS-1`.
2. **Tiered Database Seeding (`003` seed script):**
   - **Verified (`published` — 3 articles):** Articles **#1**, **#5**, **#7** (note: **#1** featured status retained unless client selects another lead monograph).
   - **Editorial Review (`review` — 3 articles):** Articles **#2**, **#3**, **#6** — retained in DB so editors/publishers can refine overstated claims or verify service scope before republishing.
   - **Client Approval / Slug Remediation (`draft` — 1 article):** Article **#4** (`lead-safe-conservation-protocols-heritage-homes`) — **never visible publicly** until the client confirms whether to publish under a clean non-heritage slug (`modern-surface-preparation-residential-painting`) or archive permanently.
3. **Strict Public Boundary During Transition (`CMS-1` → `CMS-4`):** Even when falling back to static data locally in development, unapproved/heritage slugs (`lead-safe-conservation-protocols-heritage-homes`) must be filtered out of public feeds until `CMS-4` DB-backed rendering and client approvals take effect.
4. **Out-of-Scope Adjacent References Noted (Not Modified Now):** Unverified heritage references elsewhere in the codebase (`servicesData.ts` Discipline 05 `historic-heritage-conservation` and `exterior-facade-restoration`, `constants.ts` `'Commercial & Heritage'`, and hardcoded AS/NZS 2311 note in `insights/[slug]/page.tsx`) should be queued for separate client content sign-off.

---

## 12. CMS-1.1 Independent Security & Data-Integrity Audit

**Audit Mode:** Read-only code, SQL catalog, RLS, RBAC, audit-log, and test-harness verification across `001_initial_schema.sql`, `002_idempotency_and_hardening.sql`, `003_editorial_cms.sql`, `src/lib/supabase/serviceRole.ts`, `src/lib/cms/*`, `scripts/test-cms-phase1.mjs`, and the scratch PGlite verifier (`scratch/pglite-test/verify-migrations.mjs`). No source files, migrations, dependencies, or Git history were altered during this audit.

### 12.1 Verdict
**Needs targeted `CMS-1.2` corrective milestone prior to `CMS-2`.** Because `003_editorial_cms.sql` has not yet been applied to a live Supabase instance, resolving the findings below now prevents schema, RBAC, and audit-snapshot debt from entering CMS-2 editorial APIs.

### 12.2 Summary of Findings

| ID | Severity | Component & Reference | Summary |
|---|---|---|---|
| **A-1** | **High** | `supabase/migrations/003_editorial_cms.sql` (`L146–L152`, `L182–L188`) | `articles` has no `CHECK (status <> 'published' OR published_at IS NOT NULL)` constraint, and `"Public articles read"` allows `(published_at IS NULL OR published_at <= NOW())`. A `published` row with `NULL` `published_at` becomes publicly visible and sorts first under PostgreSQL default `DESC NULLS FIRST`. |
| **A-2** | **Medium** | `src/lib/cms/rbac.ts` (`L13`, `L54–L56`, `L130–L141`) | `EDITOR_ACTIONS` includes `'article:request_changes'`, which `STATUS_TRANSITION_MATRIX` also assigns to `approved -> draft` and `approved -> review`. As a result, an `editor` can demote a `publisher`-approved article even though `canEditArticleInStatus('editor', 'approved')` is `false`. |
| **A-3** | **Medium** | `supabase/migrations/003_editorial_cms.sql` (`L193–L236`) | `article_audit_log` records `from_status` / `to_status` only—no dedicated previous/new content snapshot columns for same-status edits, no automatic DB trigger fallback when service-role mutations touch `articles`, and no constraints requiring `actor_staff_id`/`actor_email` when `actor_type = 'staff'` or non-empty `action`. |
| **A-4** | **Medium** | `supabase/migrations/003_editorial_cms.sql` (`L67–L77`, `L179–L188`, `L234–L236`) | RLS enforces row isolation cleanly, **but** `003` omits explicit SQL `REVOKE INSERT, UPDATE, DELETE` (and `REVOKE SELECT` on `article_audit_log`) for `anon`/`authenticated`, relying exclusively on RLS policies rather than defense-in-depth table grants. Also, `approved_by`/`published_by` lack DB-level transition enforcement until CMS-2/4 RPCs land. |
| **A-5** | **Medium** | `scripts/test-cms-phase1.mjs` (`L287–L303`) & scratch `verify-migrations.mjs` | DB migration tests live only in scratch (not in `scripts/verify-migrations.mjs` in-repo); `test-cms-phase1.mjs` checks SQL via substring `.includes()` rather than querying seeded DB columns back against `articlesData.ts`; PGlite cannot test live Supabase Auth/GoTrue, PostgREST, `service_role` vs `anon` HTTP behaviour, or missing `authenticated` negative tests on `articles` & `article_audit_log`. |
| **A-6** | **Low** | `supabase/migrations/003_editorial_cms.sql` (`L296–L329`, `L331–L364`, `L366–L399`, `L436–L469`) & `L170–L174` | Unpublished seeded items (`#2`, `#3`, `#4`, `#6`) retain their historical date in `created_at`/`updated_at` with `published_at = NULL`, so subsequent edits trigger `updated_at = NOW()`. Recommend documenting whether re-published legacy items should carry forward `metadata.legacy_static_date` or use actual approval timestamp. |
| **A-7** | **Low** | `src/lib/cms/staffAuth.ts` (`L55`, `L118–L143`) & `src/lib/supabase/serviceRole.ts` (`L21–L31`) | `resolveAuthenticatedStaff` checks `isServiceRoleConfigured()` cleanly, but does not verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` before calling `createSessionSupabaseClient()`, and does not reject empty/whitespace-only edge keys unless matching explicit placeholder substrings (`placeholder`, `your_service_role`, `your-service-role`). `resolveAuthenticatedStaff` relies solely on `auth_user_id` without checking email sync drift or updating `last_login_at`. |

### 12.3 Recommended `CMS-1.2` Corrections (Prior to CMS-2)
1. **Tighten Publication Date Invariants (`003_editorial_cms.sql`):** Backfill `published_at = COALESCE(published_at, created_at, NOW())` for any existing `status = 'published'` rows, add `CHECK (status <> 'published' OR published_at IS NOT NULL)`, and tighten `"Public articles read"` to `status = 'published' AND published_at IS NOT NULL AND published_at <= NOW()`.
2. **Fix Editor Demotion Gap (`src/lib/cms/rbac.ts`):** Introduce a dedicated `'article:return_approved'` (Publisher/Admin-only) action—or map `approved -> draft` / `approved -> review` to `'article:approve'`—so `editor` can only move `review -> draft`, never demote `approved` articles.
3. **Harden Audit Log & Grants (`003_editorial_cms.sql`):** Add `previous_snapshot JSONB`, `new_snapshot JSONB`, `CHECK (LENGTH(TRIM(action)) > 0)`, `CHECK (actor_type <> 'staff' OR actor_staff_id IS NOT NULL OR actor_email IS NOT NULL)`, an optional safety-net `AFTER UPDATE` audit trigger on `articles` when app code omits explicit audit attribution, and explicit `REVOKE` statements on `anon`/`authenticated`.
4. **Promote & Expand Verification (`scripts/`):** Move the PGlite migration verifier into the repository (`scripts/verify-migrations.mjs`), add negative tests for `authenticated` on `articles` and `article_audit_log`, `ON DELETE RESTRICT`, case-insensitive email uniqueness, `publish_attempts >= 0`, `editor` blocked from `approved -> draft`, and DB-queried string equality vs `ARTICLES_DATA`.

---

## 13. CMS-1.2 Security & Data-Integrity Hardening Implemented

All `A-1` through `A-7` findings and Section 6 workflow hardening have been implemented while keeping `001_initial_schema.sql`, `002_idempotency_and_hardening.sql`, and `003_editorial_cms.sql` untouched:

- **Additive Migration (`supabase/migrations/004_editorial_cms_hardening.sql`):**
  - **A-6 Historical Static Date Preservation:** Adds `articles.legacy_static_date` and backfills exact original dates across all 7 articles while keeping `published_at = NULL` for `#2` (`review`), `#3` (`review`), `#4` (`draft`), and `#6` (`review`). When those articles are eventually published, `published_at` records the real publication timestamp (`NOW()`) rather than copying the historical date.
  - **A-1 Publication Date Integrity:** Backfills any existing `status = 'published' AND published_at IS NULL` rows via `COALESCE(published_at, legacy_static_date, created_at, NOW())`, adds `articles_published_requires_timestamp_check`, preserves `articles_scheduled_requires_timestamp_check`, and tightens `"Public articles read"` RLS to `status = 'published' AND published_at IS NOT NULL AND published_at <= NOW()`.
  - **A-3 Complete Immutable Audit Coverage:** Adds `previous_snapshot JSONB` and `new_snapshot JSONB`, non-empty `action` and `'staff'` attribution checks, `BEFORE TRUNCATE` guard (`article_audit_log_truncate_guard`), `AFTER INSERT OR UPDATE` trigger (`articles_audit_changes`) with redundant no-op suppression (`previous_snapshot IS NOT DISTINCT FROM new_snapshot`), and `BEFORE DELETE` hard-delete guard (`articles_prevent_hard_delete` requiring `archived` workflow state).
  - **A-4 PostgreSQL Table Privileges vs RLS:** PostgreSQL `GRANT`/`REVOKE` controls coarse table and function capabilities (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `EXECUTE`) before RLS row predicates are evaluated. `004` revokes all DML from `PUBLIC`, `anon`, and `authenticated` across `articles`, `staff_users`, and `article_audit_log`, re-granting strictly `SELECT` on `articles` to `anon`/`authenticated` and `SELECT` on `staff_users` to `authenticated` (with zero direct client privileges on `article_audit_log` or internal helper functions).
  - **Database-Controlled Workflow (`cms_transition_article_status` & `articles_enforce_workflow`):** `BEFORE UPDATE` trigger blocks direct `status` mutations outside the transaction-scoped RPC (`strovyn.workflow_rpc`) and blocks `'editor'`/`inactive` mutations on protected states (`approved`, `scheduled`, `published`, `archived`). Restricted `SECURITY DEFINER` RPC (`SET search_path = pg_catalog, public`, `EXECUTE` granted solely to `service_role`) validates transitions, resolves role exclusively from `staff_users`, executes updates and snapshot-bearing audit inserts atomically in one transaction, and restricts `cron` strictly to due `scheduled -> published`.
  - **Rollback Considerations:** Migration `004` documents manual non-destructive revert steps in header comments (`DROP TRIGGER` for the new guards, `DROP FUNCTION` for `cms_transition_article_status`, explicit policy/constraint restoration) and never executes automatic destructive rollbacks.
- **RBAC & Configuration Guards:**
  - **A-2 (`src/lib/cms/roles.ts`, `src/lib/cms/rbac.ts`):** Added `'article:return_approved'` (Publisher/Admin only) for `approved -> draft`/`review` and updated `canTransitionArticleStatus` to require both action permission and edit-in-status permission (`108`-case `3x6x6` transition matrix verified).
  - **A-7 (`src/lib/supabase/serviceRole.ts`, `src/lib/cms/staffAuth.ts`):** Added `isSupabaseAnonConfigured()` and `isCmsSupabaseConfigured()` validating both standard Supabase config and service-role config before staff session resolution, plus case-insensitive email parity between verified auth user and active `staff_users` row without leaking configuration details.
- **Reproducible Verification (`scripts/verify-migrations.mjs`, `scripts/test-cms-phase1.mjs`, `package.json`):** Added `@electric-sql/pglite` to `devDependencies` and `test:cms-db`, `test:cms-rbac`, `test:cms` scripts. Simulated PGlite runs confirm SQL schema, triggers, grants, and RLS behaviour in PostgreSQL WASM; live Supabase Auth (GoTrue), PostgREST HTTP isolation, and hosted project application remain pending live environment provisioning in CMS-5.
