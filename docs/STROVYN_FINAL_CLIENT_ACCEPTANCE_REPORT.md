# STROVYN — Final Client Handover & Acceptance Report

## 1. Executive Summary
- **Engineering Acceptance Verdict:** **PASS (Technical Build & Security Verified; 0 Unresolved P0/P1 Defects)**
- **Business Handover Verdict:** **CONDITIONAL GO / HOLD FOR EXTERNAL CLIENT LAUNCH**
- **Why Public Customer Launch Is Held:**
  1. **Netlify Private Access (`sso_login: true`)**: Intentionally kept Private per operator request (`HTTP 401` to unauthenticated visitors).
  2. **Custom Domain (`strovynpaints.com`)**: Not yet registered or attached to Netlify.
  3. **Branded Email & Custom SMTP**: Production `RESEND_FROM_EMAIL` remains `onboarding@resend.dev`; `STROVYN_CRON_ENABLED=false` and `RESEND_SEND_ACKNOWLEDGMENTS=false` until `strovynpaints.com` is verified in Resend.
  4. **Netlify Ownership Transfer & Supabase Continuity**: Site remains on `nayefsiddique-eng`; Supabase Free-tier pauses after 7 days of inactivity without Pro upgrade (recommended for production continuity/backups, though not mandatory for technical launch).
  5. **Portfolio Content**: `0` published projects, `0` published articles, and `0` published testimonials in production (`qktgxxbmdvmpyipltamo`) until client sign-off.

## 2. Git Commit & Deployed Build
- **Repository:** `https://github.com/nayefsiddique-eng/strovyn-`
- **Production Branch (`main`) & Development Branch (`design/strovyn-cinematic-3d`):** Synchronized at **`4e1857d`**.
- **Handover Documentation Branch:** `docs/client-handover` (preserves `docs/`, the true HTTP `404` dynamic-route fix across `next.config.ts` and route pages, and `scripts/test-invalid-slugs-404.mjs`; `main` untouched at `4e1857d`).
- **Netlify Production Deploy ID:** `6b04f8786d5faec7a7335f60` (`state: ready`, `https://strovynpaints.netlify.app`).

## 3. Complete Route & Component Inventory
- **App Router Pages:** `30` (`page.tsx` routes)
- **API Route Handlers:** `53` (`route.ts` handlers)
- **React Components:** `72` (`src/components/**`)
- **Library Modules:** `59` (`src/lib/**`)
- **PostgreSQL Migrations:** `17` (`supabase/migrations/001–017`, synchronized on staging & production)

## 4. Test Evidence & Verification Scope Matrix
| Workflow / Check | Evidence Type | Result |
| :--- | :--- | :---: |
| `npm audit --omit=dev` | Production dependency CVE scan | **PASS** (`0` CVEs) |
| `npm run lint` & `npx tsc --noEmit` | Static analysis & TypeScript | **PASS** (`0` errors, `0` warnings) |
| `npm run build` | Production build (`69/69` routes) | **PASS** |
| `npm run test:cms` (8 suites) | PGlite PostgreSQL RLS/RPC/triggers + unit/RBAC | **PASS** |
| Invalid & Draft Slug HTTP Status (`test-invalid-slugs-404.mjs`) | Live local prod-build (`next start`) + staging DB | **PASS** (`404` on invalid/draft, `200` on valid) |
| Testimonials (`phase-c`) & Careers (`phase-d`) | PGlite DB + service RBAC & consent/deadlines | **PASS** |
| Resend & Outbox (`test-netlify-resend.mjs`) | Mocked Resend + durable outbox/backoff | **PASS** |
| Staff Onboarding (`test-staff-onboarding-staging.mjs`) | Live staging Supabase DB + Auth | **PASS** (cleaned up) |
| Customer Quote & Feedback (`run-handover-three-role-e2e.mjs`) | Live local prod-build + staging DB persistence | **PASS** (cleaned up) |
| Employee (Editor) & Admin Journeys (`run-handover-three-role-e2e.mjs`) | Live Playwright + staging DB + RBAC `403` | **PASS** (cleaned up) |
| Dark Mode & Visualiser (`run-visualiser-and-darkmode-qa.mjs`) | Live hosted preview (`design-strovyn-cinematic-3d`) | **PASS** (`BEFORE` invariant, `5` distinct colours) |
| 6-Viewport Responsive + A11y (`run-playwright-qa-gate.mjs`) | Chromium `320`–`1920`, `axe-core` | **PASS** (`0` violations/overlaps) |
| Homepage CLS Fix (`src/app/layout.tsx` Suspense `fallback={null}`) | Playwright `layout-shift` diagnostics (`next start`) | **PASS** (`CLS: 0`, `0` shifts) |
| Live-browser Careers CV upload & private download | PGlite/unit verified (`test-submission-hardening.mjs`); live browser upload | **NOT VERIFIED** in live browser |
| Production owner login (`nayefsiddique@gmail.com` / `strovyn@gmail.com`) | Account state `is_active: true` verified in `qktgxxbmdvmpyipltamo`; interactive login | **NOT VERIFIED** (owner-controlled password) |
| Manual NVDA/VoiceOver screen-reader & Firefox/WebKit testing | Cross-browser / AT manual testing | **NOT VERIFIED** |
| `strovynpaints.com` HTTPS, DNS, live Resend SMTP & CDN field telemetry | External infrastructure | **BLOCKED** (domain unregistered) |

## 5. Invalid Slug Investigation Outcome
- **Root Cause:** Under Next.js 16 `cacheComponents: true` + `partialPrefetching: true` (Partial Prerendering, `◐`), `/projects/[slug]`, `/insights/[slug]`, and `/services/[slug]` streamed the outer `RootLayout` shell with `HTTP 200` headers before dynamic route resolution executed `notFound()`.
- **Fix Applied:** Disabled `cacheComponents` and `partialPrefetching` in [next.config.ts](../next.config.ts), removed `export const instant = false` across all 18 route pages, and invoked `notFound()` directly at the top level of `ProjectDetailPage` in [src/app/projects/[slug]/page.tsx](../src/app/projects/[slug]/page.tsx) (matching `/insights/[slug]` and `/services/[slug]`).
- **Verification (`scripts/test-invalid-slugs-404.mjs` against `next start -p 3000`):**
  - `/projects/nonexistent-qa-slug-check` → `HTTP 404`
  - `/projects/adelaide-hills-coastal-estate` (unpublished staging draft) → `HTTP 404`
  - `/projects/the-north-adelaide-residence` (published staging project) → `HTTP 200`
  - `/insights/nonexistent-qa-slug-check` → `HTTP 404`
  - `/services/nonexistent-qa-slug-check` → `HTTP 404`
  - `/services/interior-architectural-painting` → `HTTP 200`

## 6. Business Launch Blockers (Exact Status)
| Blocker | Current Status | Required Owner / Client Action |
| :--- | :--- | :--- |
| Netlify Private Access | `sso_login: true` (`HTTP 401` public) | Authorize switching to Public at launch |
| Custom Domain (`strovynpaints.com`) | Unregistered (`NXDOMAIN`, `custom_domain: null`) | Register domain & configure DNS/HTTPS in Netlify |
| Resend Verified Sender | `RESEND_FROM_EMAIL=onboarding@resend.dev` | Verify `strovynpaints.com` (`DKIM`/`SPF`) in Resend |
| Supabase Auth Custom SMTP | Free-tier mailer (2 emails/hr cap) | Configure Resend SMTP in `qktgxxbmdvmpyipltamo` |
| Netlify Ownership | Under `nayefsiddique-eng` team | Create client Netlify team & invite `nayefsiddique-eng` as Owner |
| Supabase Continuity | Free tier (7-day inactivity pause, no PITR; not a technical blocker) | Optional/recommended upgrade of `qktgxxbmdvmpyipltamo` to Supabase Pro (`$25/mo`) |
| Portfolio Content | `0` public projects/articles/testimonials | Review & publish approved content in `/admin` |
| Staff Login | `strovyn@gmail.com` & `nayefsiddique@gmail.com` active Admins | Sign in at `/admin` with owner-established passwords |

## 7. Rollback & Recovery Procedures
- **Netlify Instant Rollback:** Netlify → `strovynpaints` → **Deploys** → select previous deploy (`6b04de34b4bff1778b31dcf2` or `6aff4431cae90ef45f5c5c31`) → **Publish deploy**.
- **Emergency Privacy Lock:** Re-enable `sso_login: true` in Netlify Site Access.
- **Database:** Never auto-revert migrations `001–017`; manage content visibility via `/admin`.
