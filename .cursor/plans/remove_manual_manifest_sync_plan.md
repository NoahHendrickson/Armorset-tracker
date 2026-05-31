# Remove Manual Manifest Sync — Implementation Plan

> **For agent execution:** use the full handoff doc → [`remove_manual_manifest_sync_handoff.md`](./remove_manual_manifest_sync_handoff.md) (paste prompt, file checklist, code refs, verification commands).

**Goal:** Users never press “Sync Bungie manifest.” Manifest sync is fully automatic; **Refresh** is the only deliberate Bungie action in the UI.

**Principle:** Manifest is shared, environment-level data. `WorkspaceAutoSync` already runs manifest → inventory on dashboard load when unhealthy/stale. Manual buttons duplicate that and imply user responsibility.

---

## Phase 0: Documentation Discovery (complete)

### Allowed APIs / patterns (verified in repo)

| Mechanism | Source | Notes |
|-----------|--------|-------|
| Auto pipeline | `src/components/dashboard/workspace-auto-sync.tsx` | `runPipeline()` — manifest when `health.manifestNeedsSync`, then inventory |
| Health flags | `src/app/dashboard/page.tsx:69-79` | `manifestNeedsSync` = no version, schema outdated, or live version drift |
| Retry escape hatch | `workspace-auto-sync.tsx:261-264` | `registerRetry(() => runPipeline({ forceManifest: true, forceInventory: true }))` |
| Empty states | `src/lib/workspace/workspace-data-health.shared.ts` | `inventoryTableEmptyState()` — loading/error copy |
| Cron config | `vercel.json` | Tue 18:00 UTC → `/api/admin/manifest/sync` |
| Manifest route | `src/app/api/admin/manifest/sync/route.ts` | **POST only**, `requireSessionFromRequest` |
| Dev script | `scripts/sync-manifest.ts` | Developer-only; keep |

### Anti-patterns to avoid

- Do **not** invent a new client-side manifest sync hook — reuse `WorkspaceAutoSync` + `retrySync`.
- Do **not** remove the `/api/admin/manifest/sync` route — auto-sync and cron still need it.
- Do **not** merge manifest into Refresh — different cost/frequency; Refresh stays inventory-only.
- Do **not** assume Vercel cron works today — it likely 405s (GET vs POST) and would 401 (no session).

---

## Phase 1: Fix background manifest sync (production safety net)

**Why:** Shared DB should update on Tuesday without any user visit. Today cron is broken.

### Tasks

1. **Add cron-authenticated entry point** to `src/app/api/admin/manifest/sync/route.ts`:
   - Export `GET` that delegates to shared handler (Vercel cron uses GET).
   - Accept `Authorization: Bearer ${CRON_SECRET}` (add `CRON_SECRET` to `src/lib/env.ts` server schema; optional in dev).
   - When cron auth matches → call `syncManifest({ force: false })` without session.
   - When session present (browser POST) → keep existing behavior for auto-sync client calls.

2. **Keep POST + session** for browser-initiated sync from `WorkspaceAutoSync` (credentials: include).

3. **Document env var** in README/CLAUDE: `CRON_SECRET` required on Vercel for weekly sync.

### Verification

- [ ] `curl -X GET /api/admin/manifest/sync -H "Authorization: Bearer $CRON_SECRET"` → 200
- [ ] Unauthenticated GET without secret → 401
- [ ] Authenticated POST from signed-in browser still works
- [ ] `npm run build` passes

---

## Phase 2: Remove all user-facing manifest buttons

### 2a. Header

**File:** `src/components/app-header.tsx`

- Remove `SyncManifestButton` import and `<SyncManifestButton variant="header-large" />`.
- Keep `RefreshButton variant="header-large"`.

### 2b. Manifest status banner → passive only

**File:** `src/components/dashboard/manifest-status-banner.tsx`

- Remove `SyncManifestButton` import and all three CTA slots (lines ~31, 55, 78).
- Update copy to passive/auto language (see copy table in Phase 3).
- Optional: wrap in client component that reads `useWorkspaceSync().phase` and hides banner while `syncingManifest` (avoids “update available” + spinner duplicate).

### 2c. Table empty panel

**File:** `src/components/dashboard/inventory-table-view.tsx`

- Remove `SyncManifestButton` import and all usages in `InventoryTableEmptyPanel`.
- **`syncing-manifest`:** spinner + passive copy only (no button).
- **`manifest-error`:** “Retry sync” button only (`onRetry` → existing `retrySync`).
- Remove dead `no-cache` branch (kind never returned from `inventoryTableEmptyState`).
- **`inventory-error` / `empty-inventory`:** keep `RefreshButton` + Retry where appropriate.

### 2d. Delete component

- Delete `src/components/dashboard/sync-manifest-button.tsx` after grep confirms zero imports.

### Verification

- [ ] `rg SyncManifestButton` → no matches in `src/`
- [ ] Header shows: feedback, refresh, profile, sign-out (no database icon)
- [ ] Manual test: fresh DB + sign in → manifest loads without any button press

---

## Phase 3: Update copy (no “sync the manifest” imperatives)

Replace user-directed manifest language with automatic/loading language.

| Location | Old (examples) | New direction |
|----------|----------------|---------------|
| `workspace-data-health.shared.ts:101-102` | “header database icon or the banner above” | “loads automatically on first visit” |
| `tracker-filter-bar.tsx:110-112` | “Sync the manifest first.” | `manifestEmpty` ? “Loading armor sets…” : “No sets for this class.” |
| `tracker-filter-bar.tsx:261,283` | “No archetypes/tunings — sync the manifest first.” | Gate on `selectors.manifestEmpty` → “Loading…” vs “No … for this class.” |
| `tracker-filter-bar-overflow-menus.tsx` | Same ×4 | Same pattern |
| `armor-set-combobox.tsx:51` | “No sets available — sync the manifest first.” | “No sets available yet.” or loading variant via prop |
| `armor-set-multi-select.tsx` | Same | Same |
| `view-grid.tsx:80-81` | “Sync the manifest to populate…” | “Loading archetype stat data…” when manifest not ready (needs `manifestEmpty` or health prop) |
| `manifest-status-banner.tsx` | “Sync now” / “Resync” CTAs | Passive banners (Phase 2b) |
| `inventory/sync.ts:86` (server warning) | “run /api/admin/manifest/sync first” | “Manifest is still loading — try again shortly.” (may surface in toast warnings) |

### Verification

- [ ] `rg -i "sync the manifest|sync bungie manifest|database icon"` in `src/` → zero user-facing matches (except dev-only comments if any)

---

## Phase 4: Grid mode parity (coverage gap)

**Problem:** Table view has empty/loading panels via `useWorkspaceSync`; grid mode (`grid-workspace.tsx`) does not — users on Canvas tab only see empty filter dropdowns during manifest load.

### Tasks

1. In `GridWorkspace` (or shared wrapper), read `useWorkspaceSync()` health + phase.
2. When `!health.manifestReady` or `phase === "syncingManifest"` or `manifestError`:
   - Show centered loading/error panel (reuse copy from `inventoryTableEmptyState` or extract shared `WorkspaceManifestGate` component).
   - On error: single “Retry sync” button → `retrySync`.
3. When `phase === "syncingInventory"` && no cache: show “Fetching your armor…” (matches table).

### Verification

- [ ] Grid tab on fresh env: shows loading state, not misleading empty filters
- [ ] Retry on manifest error works from grid

---

## Phase 5: Storybook + build verification

### Stories to update

| File | Change |
|------|--------|
| `inventory-table-view.stories.tsx` | `ManifestNotReady` — assert passive copy, no sync button |
| `.storybook/mocks/workspace-health.ts` | Add mock for `syncingManifest` phase if testing spinner states |
| `armor-set-combobox.stories.tsx:148` | Update `emptyCatalogMessage` if default prop changes |

### Optional new stories

- Passive `ManifestStatusBanner` variants (or client wrapper with mock sync context)
- `TrackerFilterBar` with `manifestEmpty: true` fixture

### Commands

```bash
npm run lint
npm run build
npm run test-storybook   # or npx vitest --project=storybook for affected stories
```

---

## Phase 6: Docs cleanup (developer-facing only)

Keep `scripts/sync-manifest.ts` and curl examples for **local dev / ops**, but clarify:

- **README.md** — first-run manifest: “happens automatically when you open the dashboard after sign-in”; curl is optional for headless setup.
- **CLAUDE.md** — same; note `CRON_SECRET` for Vercel cron.

Do **not** remove the API route or `WorkspaceAutoSync`.

---

## Success criteria (final checklist)

- [ ] No `SyncManifestButton` in production UI
- [ ] Header: only Refresh (plus feedback, profile, sign-out)
- [ ] Fresh sign-in + dashboard visit populates manifest without user action
- [ ] Manifest failure recoverable via “Retry sync” (not a separate manifest concept)
- [ ] Filter/grid copy never tells users to sync manifest manually
- [ ] Vercel cron can sync shared manifest without a logged-in user
- [ ] Lint + build green; story tests updated

---

## File change summary

| Action | Files |
|--------|-------|
| Delete | `src/components/dashboard/sync-manifest-button.tsx` |
| Edit | `app-header.tsx`, `manifest-status-banner.tsx`, `inventory-table-view.tsx`, `workspace-data-health.shared.ts`, `tracker-filter-bar.tsx`, `tracker-filter-bar-overflow-menus.tsx`, `armor-set-combobox.tsx`, `armor-set-multi-select.tsx`, `view-grid.tsx`, `inventory/sync.ts` |
| Edit (infra) | `api/admin/manifest/sync/route.ts`, `lib/env.ts`, `vercel.json` (if needed), README, CLAUDE |
| Add (optional) | Shared `WorkspaceManifestGate` or grid loading panel |
| Stories | `inventory-table-view.stories.tsx`, combobox stories |

---

## Out of scope

- Merging Refresh + manifest into one button
- Per-user manifest storage (already global)
- Removing `WorkspaceAutoSync` (this is the automation backbone)
- Debug page auto-sync (debug inherits header fix; no manifest button needed there)
