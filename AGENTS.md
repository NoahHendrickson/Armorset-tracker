# AGENTS.md

## Cursor Cloud specific instructions

### Services overview

| Service | Command | Notes |
|---------|---------|-------|
| Next.js dev server | `npm run dev:http` | Plain HTTP on port 3000. Use `npm run dev` for HTTPS (required for Bungie OAuth). |
| Lint | `npm run lint` | ESLint 9 flat config. Pre-existing warnings/errors in `spike/` and `tracker-panel.tsx` are known. |
| Build | `npm run build` | Runs TypeScript check + Next.js production build. |

### Environment variables

A `.env.local` file must exist at the repo root with all required variables (see `src/lib/env.ts` for the schema). The key variables are:

- `BUNGIE_API_KEY`, `BUNGIE_CLIENT_ID`, `BUNGIE_CLIENT_SECRET` — Bungie OAuth
- `APP_SESSION_SECRET`, `APP_TOKEN_ENCRYPTION_KEY` — app secrets (≥32 chars each)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase
- `NEXT_PUBLIC_APP_URL` — defaults to `http://localhost:3000`

Placeholder values pass validation and allow the dev server to boot, but Bungie OAuth and database operations require real credentials.

### Dev server startup caveats

- `npm run dev` uses `--experimental-https` which auto-generates a self-signed cert. In headless/cloud environments, `npm run dev:http` (plain HTTP, port 3000) is simpler and sufficient for most development tasks. Bungie sign-in will not work over plain HTTP.
- The server reads `.env.local` automatically via Next.js env loading.
- There is **no test suite** — validation is done via lint, build, and manual testing.

### Database

The app uses Supabase (Postgres). Schema migrations live in `supabase/migrations/`. Apply with `npm run db:push` (requires Supabase CLI linked to a project). Without a real Supabase connection, API routes that query the DB will return errors, but the server still boots and serves the landing/auth pages.

### Key file paths

- `src/lib/env.ts` — env var validation (zod schemas)
- `src/app/api/` — all API route handlers
- `src/components/workspace/` — dashboard canvas components
- `supabase/migrations/` — ordered SQL migrations (never edit existing ones)
