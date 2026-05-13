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

## Storybook

Stories live next to their components as `*.stories.tsx`. Run `npm run storybook` to start the dev server on `http://localhost:6066`. Vitest-based interaction + a11y tests are wired through `@storybook/addon-vitest`; run them with `npm run test-storybook` (or `npx vitest --project=storybook`).

Shared mock fixtures (`ViewRow`, `ViewProgress`, `DerivedArmorPieceJson`, etc.) live in `.storybook/mocks/`. Reuse them when adding new stories instead of inventing fresh shapes — they import the canonical types from `src/lib/db/types.ts`.

### Storybook MCP (`armor-checklist-sb-mcp`)

When working on UI components, use the `armor-checklist-sb-mcp` MCP tools to access Storybook's component knowledge before answering or making changes. Storybook must be running (`npm run storybook`) for the MCP endpoint to be reachable at `http://localhost:6066/mcp`.

- **Never hallucinate component props.** Before using any prop on a component from `src/components/`, query `list-all-documentation` and then `get-documentation` for that component to confirm the prop exists.
- Use `get-storybook-story-instructions` when authoring or updating a `*.stories.tsx` file to follow current conventions.
- After changing a component, run `run-story-tests` for that component's stories — it covers `play()` interaction tests *and* axe-core a11y checks. Fix violations and re-run.
- If a prop isn't documented in the stories or component types, ask the user instead of guessing based on naming conventions from other libraries.
