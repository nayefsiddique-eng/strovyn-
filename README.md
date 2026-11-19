# Strovyn Painting Co.

Web platform for **Strovyn Painting Co.** — architectural painting, heritage restoration, bespoke surface finishes, interactive wall-colour visualiser, and quote concierge for Adelaide, South Australia.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack), React 19, TypeScript
- **Styling:** Tailwind CSS v4 (`src/app/globals.css`)
- **Motion & 3D:** GSAP + Three.js (`@react-three/fiber`, `@react-three/drei`)
- **Backend & Storage:** Supabase (PostgreSQL + Storage), Resend (transactional email), Google Gemini (optional AI concierge)

## Getting Started

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure environment variables:**

   Copy `.env.local.example` to `.env.local` and populate your production credentials:

   ```bash
   cp .env.local.example .env.local
   ```

   See `.env.local.example` for required Supabase, Resend, optional Gemini AI, and admin authentication variables.

3. **Apply Supabase database migrations (in order):**
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_idempotency_and_hardening.sql`

4. **Run locally or build for production:**

   ```bash
   npm run dev      # Local development server
   npm run lint     # ESLint check
   npx tsc --noEmit # TypeScript typecheck
   npm run build    # Production build
   npm start        # Serve production build
   ```

## Key Routes

- `/` — Architectural homepage with 3D raking-light alcove & intro opening
- `/services` & `/services/[slug]` — Finishing disciplines & Level 5 specifications
- `/projects` & `/projects/[slug]` — Completed Adelaide project portfolio
- `/visualiser` — Interactive wall-colour visualiser
- `/insights` & `/insights/[slug]` — Technical finishing & coating articles
- `/contact` — Quotation & site assessment request form
- `/about`, `/careers`, `/feedback`, `/admin/photos` — Company, careers, feedback, and photo management
