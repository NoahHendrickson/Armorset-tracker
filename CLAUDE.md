# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

A Next.js 16 web app for tracking Destiny 2 Armor 3.0 set completion. The core domain is the
triple `(set × archetype × tuning)` — a "view" pins those three hashes plus a class type, and the
UI shows which of the 5 armor slots are covered by pieces in the player's vault and characters.
Inventory comes from the Bungie API on demand (cached server-side); the manifest (sets,
archetypes, tunings, plug→archetype/tuning lookups, stat metadata) is pre-derived into Supabase
once per Bungie release and queried from there. The dashboard is a free-form pannable canvas
("workspace") of tracker panels that can be merged together.

## Commands

```bash
npm run dev              # next dev --experimental-https → https://localhost:3000 (REQUIRED for Bungie OAuth)
npm run dev:http         # plain HTTP — Bungie sign-in will not work
npm run build            # next build
npm run start            # next start (after build)
npm run lint             # eslint (eslint-config-next + core-web-vitals + typescript)
npm run db:push          # apply pending Supabase migrations
npm run db:push:dry-run  # preview pending migrations without applying

# After signing in once locally, populate manifest-derived tables:
curl -kX POST https://localhost:3000/api/admin/manifest/sync -b cookies.txt
```

There is no test suite. The `spike/` directory is a one-off Phase-0 Node script (excluded from
the main `tsconfig.json`) and is unrelated to the production build.

## Architecture

### Top-level layout
- `src/app/` — App Router. Pages are `/` (landing), `/dashboard` (workspace), `/views/new`,
  `/views/[id]`, `/debug`. API routes live under `src/app/api/`.
- `src/lib/` — All server logic. Most files are marked `import "server-only"`.
- `src/components/` — Client + server components. `ui/` is hand-rolled shadcn-style primitives.
- `supabase/migrations/` — Postgres schema. **Always add a new numbered migration**; never edit
  existing ones. Re-run `npm run db:push` after pulling.
- `docs/` — PRD and Bungie API research notes.
- `spike/` — Standalone Node script (separate `package.json`, excluded from tsconfig).

### Server boundaries
- The Bungie access token never leaves the server. OAuth tokens are stored in `oauth_tokens`
  encrypted with AES-256-GCM (`src/lib/auth/crypto.ts`), keyed by `APP_TOKEN_ENCRYPTION_KEY`.
- Sessions are HS256 JWTs in an HTTP-only cookie (`armor_checklist_session`), signed with
  `APP_SESSION_SECRET`. See `src/lib/auth/session.ts`.
- All Supabase access uses the **service-role** client (`getServiceRoleClient`) — there is no RLS
  layer that the app code relies on. Authorization is enforced in the route handlers via
  `getSession()` / `requireSession()` and per-row `user_id` filters.
- Validate environment variables through `serverEnv()` / `clientEnv()` from `src/lib/env.ts`;
  these cache and throw on misconfigured envs. Don't read `process.env.*` directly in app code.

### Auth flow (gotchas worth knowing)
- `src/app/api/auth/bungie/login` mints a state cookie and redirects to Bungie.
- `src/app/api/auth/bungie/callback` exchanges the code, upserts the user, persists encrypted
  tokens, and sets the session cookie. **The session cookie is emitted via raw
  `response.headers.append("Set-Cookie", …)`, not `response.cookies.set(...)`** — see the long
  comment block in `setSessionCookieOnResponse` (`src/lib/auth/session.ts`). The Next API adds an
  `Expires=` attribute alongside `Max-Age` that Chrome was rejecting on the redirect chain.
  Match the hand-crafted shape exactly when touching session cookies.
- The session cookie uses `SameSite=Lax` (not `None`). Lax is reliably stored on top-level
  navigations like the OAuth redirect, and the app only ever calls its own `/api/*` via
  same-origin fetch, both of which carry Lax cookies.
- `getSessionFromRequest` reads cookies from three sources (raw `Cookie` header,
  `request.cookies`, `cookies()` from `next/headers`) because Vercel/Chrome edge cases sometimes
  hide a valid JWT behind an empty duplicate. Don't simplify this without testing on Vercel.
- Bungie requires HTTPS for redirect URLs, which is why local dev runs `--experimental-https`.

### Bungie API client (`src/lib/bungie/`)
- `client.ts` — typed wrappers. Throws `BungieApiError` with a `maintenance` flag for `ErrorCode`
  5/1641 (Bungie Tuesday maintenance) — surface these as 503s, never silently retry.
- `rate-limit.ts` — per-user request queue + jitter + exponential backoff. Wrap user-scoped Bungie
  calls in `withUserRateLimit(userId, () => withBackoff(() => …))`.
- `oauth.ts` — code exchange and refresh.
- Inventory uses `Destiny2.GetProfile` with components `100, 102, 200, 201, 205, 300, 305, 310`.
  `310` (ItemReusablePlugs) is what lets us infer the *destined* tuning of an empty tuning socket
  — `tuningCommitted` flips false for that case.

### Manifest pipeline (`src/lib/manifest/`)
- `sync.ts` is a full replace: it deletes all 9 derived tables (FK-ordered) and re-inserts in
  chunks. Triggered manually via `POST /api/admin/manifest/sync` and weekly via the
  `vercel.json` cron (`0 18 * * 2` — Tuesday after Bungie maintenance).
- `derive.ts` walks `DestinyInventoryItemDefinition` + related tables to produce the small lookup
  tables (`armor_sets`, `armor_items`, `archetypes`, `tunings`, `plug_to_archetype`,
  `plug_to_tuning`, `archetype_stat_pairs`, `armor_stat_plugs`, `armor_stat_icons`).
  The 50MB+ raw manifest is **never sent to the client**.
- `lookups.ts` keeps an in-memory cache of the derived data. Call `invalidateManifestLookups()`
  after a sync.

### Inventory pipeline (`src/lib/inventory/`)
- `sync.ts` — `syncUserInventory()` returns cached rows from `inventory_cache` if they're under
  `INVENTORY_TTL_MS` (5 min), otherwise refetches. `force: true` bypasses the cache.
- `derive.ts` — turns a raw `ProfileResponse` into `DerivedArmorPieceJson[]` by joining against
  the manifest lookups. Each piece carries its slot, set/archetype/tuning hashes, the stat
  triple, and a `location` discriminator (`vault` vs `character`).
- **Withheld-component detection**: `rawInventoryItemCounts()` warns if Bungie returned only
  equipped items (typically a missing `ReadDestinyInventoryAndVault` OAuth scope). The warning
  is surfaced through `RefreshButton` as a sticky toast.

### Workspace / canvas (`src/components/workspace/`, `src/lib/workspace/`, `src/lib/views/`)
- The dashboard is a single pannable/zoomable canvas (`react-zoom-pan-pinch`) with draggable,
  resizable tracker panels (`react-rnd`). Each tracker is one `views` row.
- Per-tracker geometry lives in `views.layout` (zod-validated by `workspaceLayoutSchema`).
  Per-user pan/zoom lives in `users.workspace_camera`.
- **Merge model**: two trackers can be merged. `layout.mergedWith` is the partner's `views.id`
  and **must be symmetric** — if A.mergedWith=B then B.mergedWith=A. Merge target detection
  reads each tracker's *actual* width (varies by tertiary-stat columns), not a hardcoded width;
  see `pickMergeDropTarget()` and `mergeOverlapRatio()` in `src/lib/views/canvas-merge.ts`.
  `TrackerPanel` exposes a `layoutLiveRef` so `onDragStop` reads the live position rather than
  stale React state.
- Persistence for camera + layouts goes through `PATCH /api/me/workspace` and the per-view
  `PATCH /api/views/[id]` route. Debounce mutations on the client.

### Database (`src/lib/db/`)
- `types.ts` is the single source of truth for table shapes — keep it in sync with migrations
  manually. Convenience aliases (`UserRow`, `ViewRow`, etc.) are defined at the bottom.
- `ARMOR_STAT_NAMES` is the closed set of 6 Armor 3.0 stats (`Weapons`, `Health`, `Class`,
  `Grenade`, `Melee`, `Super`). Stats are stored as strings everywhere — they survive JSON
  round-trips and play nicely with the UI.

## Conventions

- **Path alias**: `@/` → `src/`.
- **Strict TypeScript**, `moduleResolution: bundler`. No `any` slipping in.
- **Server-only files** start with `import "server-only";` — keeps secrets out of client bundles.
- **Validation at boundaries**: zod for inputs (route handlers, workspace schema). Trust internal
  types; don't double-validate.
- **Icons**: Phosphor regular weight via `@phosphor-icons/react/dist/ssr` (SSR variant).
- **UI primitives**: hand-rolled in `components/ui/` (the new shadcn registry presets require
  auth). Style is `new-york`, `baseColor: neutral`, CSS variables enabled (`components.json`).
- **Tailwind 4** with PostCSS. Global tokens in `src/app/globals.css`.
- **Toasts**: `sonner`. Persistent OAuth-scope warnings use `toast.warning` with a long duration.
- **Date / version handling**: a manual `manifest_versions` row tracks the active Bungie
  manifest version; `checkManifestVersion()` is what UI components use to detect drift.

## Production deploy

Deployed on Vercel. The `vercel.json` cron re-runs `/api/admin/manifest/sync` every Tuesday at
18:00 UTC. `NEXT_PUBLIC_APP_URL` must match the Bungie app's registered redirect URI exactly
(including scheme), or OAuth fails with a state mismatch.
