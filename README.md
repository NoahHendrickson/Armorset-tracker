# Armor Set Checklist

A web app for tracking Destiny 2 armor 3.0 set completion against
`(set × archetype × tuning)` configurations. Replaces the manual spreadsheet
many players use today by pulling ownership data directly from the Bungie
API.

## Project layout

- [`docs/`](docs) — PRD and Bungie API research.
- [`spike/`](spike) — Phase 0 spike: a standalone Node script that proves
  `(set, archetype, tuning)` can be derived from a real account before
  trusting the production code paths.
- [`src/app/`](src/app) — Next.js App Router (UI + API routes).
- [`src/lib/`](src/lib) — Bungie API client, manifest sync, OAuth helpers,
  view/inventory derivation.
- [`supabase/migrations/`](supabase/migrations) — Postgres schema.

## One-time setup

### 1. Bungie dev app

1. Sign in at <https://www.bungie.net/en/Application> and click
   **Create New App**.
2. Settings:
   - **Application Name**: anything (only you see it)
   - **Website**: any public https URL (Bungie rejects `localhost` here —
     a GitHub profile or `https://github.com` works fine)
   - **OAuth Client Type**: `Confidential`
   - **Redirect URL**: `https://localhost:3000/api/auth/bungie/callback`
     (Bungie requires HTTPS — see step 4. Add your production URL when you
     deploy.)
   - **Scope**: `Read your Destiny 2 information` (first checkbox only)
   - **Origin Header**: leave blank
3. Copy the **API Key**, **OAuth client_id**, and **OAuth client_secret**.

### 2. Supabase project

1. Create a project at <https://supabase.com/dashboard>.
2. Apply the schema:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   Re-run `npx supabase db push` whenever a new migration lands (e.g. after
   pulling). If you'd rather paste SQL directly, the files in
   `supabase/migrations/` are plain Postgres SQL.
3. Copy the **Project URL**, **anon key**, and **service_role key** from the
   project's API settings.

### 3. Local environment

```bash
cp .env.example .env.local
# Fill in BUNGIE_*, NEXT_PUBLIC_SUPABASE_*, SUPABASE_SERVICE_ROLE_KEY,
# APP_SESSION_SECRET, APP_TOKEN_ENCRYPTION_KEY
# Generate the secrets with: openssl rand -base64 48
```

### 4. Install + run

```bash
npm install
npm run dev
# → https://localhost:3000
```

`npm run dev` runs Next with `--experimental-https`, which generates a
self-signed cert on first run. Your browser will warn the first time —
click through (Chrome: "Advanced" → "Proceed to localhost"). This is
required because Bungie's OAuth refuses non-HTTPS redirect URLs.

If you ever need plain HTTP for some reason, `npm run dev:http` is also
wired up, but Bungie sign-in won't work against it.

### 5. First-run manifest sync

After signing in once (so a session cookie exists), trigger the manifest
sync:

```bash
curl -kX POST https://localhost:3000/api/admin/manifest/sync \
  -b cookies.txt   # use a cookie jar from your signed-in session
```

(`-k` lets curl accept the dev cert.)

This populates `armor_sets`, `armor_items`, `archetypes`, `tunings`, and
the plug → archetype/tuning lookups. Without it, the dropdowns on the
**New view** page are empty.

A weekly cron is wired up in [`vercel.json`](vercel.json) to re-sync after
Tuesday Bungie maintenance.

## Phase 0 spike

Before relying on the production code, run [`spike/`](spike) once against a
real account to verify the derivation logic. See
[`spike/README.md`](spike/README.md) for steps. Findings are written to
`docs/spike-findings.md`.

## Architecture notes

- **Auth**: Bungie OAuth 2.0 → encrypted access/refresh tokens stored in
  Supabase. Sessions are HS256 JWTs in HTTP-only cookies. The Bungie
  access token never leaves the server.
- **Manifest**: Pulled in full server-side, transformed into small derived
  lookup tables. The 50MB+ `DestinyInventoryItemDefinition` is never sent
  to the client.
- **Inventory**: One `Destiny2.GetProfile` call per user with components
  `100, 102, 200, 201, 205, 300, 305`. Cached for 5 minutes; manual
  refresh forces a re-fetch.
- **Rate limits**: Per-user request queue + small jitter + exponential
  backoff (see [`src/lib/bungie/rate-limit.ts`](src/lib/bungie/rate-limit.ts)).
- **Outage detection**: Bungie maintenance (`ErrorCode 5/1641`) bubbles
  up as a 503 with a clear UI banner.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind 4 + shadcn-style primitives (hand-rolled, since the new shadcn
  registry presets require auth)
- Phosphor Icons (regular weight)
- Geist Sans/Mono via `next/font`
- Supabase Postgres
- `jose` for JWTs, `node:crypto` AES-256-GCM for token encryption
- `zod` for input validation, `sonner` for toasts

## Open follow-ups (deferred to v1.1)

- Wildcard view selectors (any archetype / any tuning)
- Near-miss surfacing (right set + archetype, wrong tuning)
- Sunset/removed-set handling
- Native apps
