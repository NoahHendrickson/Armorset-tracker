# Handoff: Remove Manual Manifest Sync

**Repo:** `armorset-checklist` (Next.js 16, Supabase, Bungie OAuth)  
**Status:** Not implemented — planning complete, ready for execution  
**Related plan:** [`remove_manual_manifest_sync_plan.md`](./remove_manual_manifest_sync_plan.md)

---

## Paste this to a new agent

```
Implement the "Remove Manual Manifest Sync" handoff in this repo.

Read first:
- .cursor/plans/remove_manual_manifest_sync_handoff.md (this file — full spec)
- AGENTS.md and CLAUDE.md (repo conventions)

Goal: Users never manually sync the Bungie manifest. Refresh is the only user-initiated Bungie action in the UI. Manifest sync must be fully automatic via WorkspaceAutoSync + fixed Vercel cron.

Execute all 6 phases in order. Do not merge manifest sync into Refresh. Do not remove WorkspaceAutoSync or the /api/admin/manifest/sync route.

When done:
- rg SyncManifestButton src/ → zero matches
- rg -i "sync the manifest|sync bungie manifest|database icon" src/ → zero user-facing matches
- npm run lint && npm run build pass
- Update affected Storybook stories; run story tests if play() asserts changed

Commit only if asked.
```

---

## 1. Background & product decision

### What the app does

- **Manifest sync** = download Destiny game definitions (sets, archetypes, tunings) from Bungie, derive lookup tables, store in **shared** Supabase tables. One copy for all users. Takes ~30–60s, multi-MB.
- **Inventory refresh** = fetch *this user's* vault/character armor via Bungie API. Fast, frequent, per-user.

### Decision

Remove all user-facing “Sync Bungie manifest” controls. Users may only press **Refresh** (inventory). Manifest runs automatically.

### Why this is safe

`WorkspaceAutoSync` (`src/components/dashboard/workspace-auto-sync.tsx`) already:

1. On dashboard mount, if `health.manifestNeedsSync` → POST `/api/admin/manifest/sync` (non-force, retries with `?force=1` on failure)
2. Then refreshes inventory if stale or manifest just ran
3. Re-runs on tab visibility when stale
4. Schedules periodic inventory resync (5 min TTL)
5. Exposes `retrySync()` for failures → `runPipeline({ forceManifest: true, forceInventory: true })`

`manifestNeedsSync` is computed in `src/app/dashboard/page.tsx`:

```ts
manifestNeedsSync:
  lookups.version === null ||
  versionCheck.schemaOutdated ||
  versionCheck.needsResync,
```

---

## 2. Architecture map (do not break)

```
Dashboard page (server)
  └─ buildWorkspaceDataHealth + ManifestStatusBanner (when manifestNeedsSync)
  └─ DashboardWorkspace
       └─ WorkspaceSyncProvider (health)
       └─ WorkspaceAutoSync ← automation backbone (KEEP)
       └─ AppHeader (remove SyncManifestButton)
       └─ Table | Grid view
```

| Component | Role |
|-----------|------|
| `workspace-auto-sync.tsx` | Client auto pipeline — **keep, do not replace** |
| `refresh-button.tsx` | User inventory refresh — **keep** |
| `sync-manifest-button.tsx` | Manual manifest UI — **delete** |
| `/api/admin/manifest/sync` | Server endpoint — **keep**, extend for cron |
| `scripts/sync-manifest.ts` | Dev/ops CLI — **keep** |

---

## 3. Known gaps (why manual buttons exist today)

| Gap | Evidence | Fix in phase |
|-----|----------|--------------|
| Header DB icon duplicates auto-sync | `app-header.tsx:61` | Phase 2 |
| Banner has Sync/Resync CTAs | `manifest-status-banner.tsx:34,56,79` | Phase 2 |
| Table empty state shows Sync manifest button | `inventory-table-view.tsx:107` | Phase 2 |
| Filter copy says “sync the manifest first” | `tracker-filter-bar.tsx`, overflow menus, comboboxes | Phase 3 |
| Grid/Canvas has no loading gate | `grid-workspace.tsx` — no `useWorkspaceSync` | Phase 4 |
| Vercel cron broken | `vercel.json` GET → route is POST-only + requires session | Phase 1 |

**Cron detail:** Vercel cron invokes **GET**. Route exports **POST only** with `requireSessionFromRequest`. Cron gets 405/401. Fix with GET + `CRON_SECRET` bearer auth.

---

## 4. Implementation phases

### Phase 1 — Fix Vercel cron (production safety net)

**Files:** `src/app/api/admin/manifest/sync/route.ts`, `src/lib/env.ts`, `README.md`, `CLAUDE.md`

**Tasks:**

1. Add optional `CRON_SECRET` to `serverSchema` in `src/lib/env.ts`:
   - Use same optional-string pattern as GitHub feedback vars (trim, empty → undefined)
   - Add to `ENV_TRIM_KEYS` if string type

2. Refactor manifest sync route:
   - Extract shared handler, e.g. `async function handleManifestSync(force: boolean)`
   - **POST** (existing): require session via `requireSessionFromRequest`; honor `?force=1`
   - **GET** (new): for Vercel cron
     - Validate `Authorization: Bearer ${CRON_SECRET}` against `serverEnv().CRON_SECRET`
     - If secret missing in env OR header mismatch → 401
     - Call `syncManifest({ force: false })` (no session)
   - Both paths: invalidate lookups + version check; same error handling (503 maintenance)

3. Document: set `CRON_SECRET` on Vercel; cron schedule unchanged in `vercel.json`.

**Suggested cron auth pattern:**

```ts
function isCronAuthorized(req: NextRequest): boolean {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
```

**Verify:**

```bash
# With dev server + CRON_SECRET in .env.local
curl -s -o /dev/null -w "%{http_code}" -X GET http://localhost:3000/api/admin/manifest/sync \
  -H "Authorization: Bearer $CRON_SECRET"
# Expect 200 (or 503 during maintenance)

curl -s -o /dev/null -w "%{http_code}" -X GET http://localhost:3000/api/admin/manifest/sync
# Expect 401
```

---

### Phase 2 — Remove all user-facing manifest buttons

#### 2a. Header

**File:** `src/components/app-header.tsx`

- Remove import of `SyncManifestButton`
- Remove line 61: `<SyncManifestButton variant="header-large" />`
- Keep `RefreshButton variant="header-large"`

#### 2b. Manifest status banner → passive only

**File:** `src/components/dashboard/manifest-status-banner.tsx`

- Remove `SyncManifestButton` import and all three CTA `<div>` blocks (lines ~33–35, 55–57, 78–80)
- Update titles/body copy to passive/auto (see Phase 3 copy table)
- Change `role="alert"` → `role="status"` where appropriate (informational, not action-required)
- Banner is only mounted when `dataHealth.manifestNeedsSync` (`dashboard/page.tsx:83–88`) — aligns with auto-sync running

**Optional:** Client wrapper that hides banner while `useWorkspaceSync().phase === "syncingManifest"` to avoid duplicate messaging with table spinner.

#### 2c. Table empty panel

**File:** `src/components/dashboard/inventory-table-view.tsx`

In `InventoryTableEmptyPanel` (lines ~72–121):

- Remove `SyncManifestButton` import and all usages
- **`syncing-manifest` / `!manifestReady` paths:** spinner + passive copy only
- **`manifest-error`:** keep **Retry sync** button (`onRetry` → `retrySync` from parent)
- **`inventory-error` / `empty-inventory`:** keep `RefreshButton` + Retry where already present
- Remove dead branch checking `state.kind === "no-cache"` (kind is never returned from `inventoryTableEmptyState`)

**Reuse pattern:** Table already uses `useWorkspaceSync()` + `inventoryTableEmptyState()` — follow that, don’t invent new state.

#### 2d. Delete component

```bash
rm src/components/dashboard/sync-manifest-button.tsx
rg SyncManifestButton src/   # must be empty before deleting
```

---

### Phase 3 — Update copy (no manual-sync imperatives)

Replace every user-facing “sync the manifest” string. Use `selectors.manifestEmpty` where available (`TrackerFormSelectors` from `manifest-selectors-from-lookup.ts`).

| File | Line(s) | Replace |
|------|---------|---------|
| `workspace-data-health.shared.ts` | ~101–102 | Remove “header database icon or the banner above”. Use: *“Armor names and tuning data come from the Bungie manifest. This loads automatically on first visit — usually under a minute.”* |
| `tracker-filter-bar.tsx` | 110–112 | `manifestEmpty ? "Loading armor sets…" : "No sets for this class."` |
| `tracker-filter-bar.tsx` | 261, 283 | Gate on `selectors.manifestEmpty`: `"Loading archetypes…"` / `"No archetypes for this class."` (same for tunings) |
| `tracker-filter-bar-overflow-menus.tsx` | 144, 164, 228, 248 | Same pattern as filter bar |
| `armor-set-combobox.tsx` | 51 | Default: `"No sets available yet."` |
| `armor-set-multi-select.tsx` | 41, 266 | Same |
| `view-grid.tsx` | 80–81 | *“No tertiary stats available for this archetype yet. Stat data is still loading.”* (or pass `manifestEmpty` if wired) |
| `manifest-status-banner.tsx` | all bodies | See suggested copy below |
| `inventory/sync.ts` | ~86 | `"Manifest is still loading — inventory may be incomplete until it finishes."` |
| `armor-set-combobox.stories.tsx` | 148 | Update if default prop changes |

**Suggested passive banner copy:**

| Condition | Title | Body |
|-----------|-------|------|
| `!manifestVersion` | Loading Destiny manifest | Sets, archetypes, and tunings will populate automatically. This usually takes under a minute. |
| `schemaOutdated` | Updating manifest data | New lookup tables are being backfilled after a schema change. |
| `needsResync` | Updating to a new Bungie manifest | Cached {version} → live {version}. This runs in the background. |

**Verify:**

```bash
rg -i "sync the manifest|sync bungie manifest|database icon|SyncManifestButton" src/
# Expect: no matches (ignore .claude/worktrees if present)
```

---

### Phase 4 — Grid mode parity

**Problem:** Table view shows loading/error via `inventoryTableEmptyState` + `useWorkspaceSync`. Grid (`src/components/workspace/grid-workspace.tsx`) does not — users on Canvas only see empty filter dropdowns during manifest load.

**Tasks:**

1. In `GridWorkspace`, import `useWorkspaceSync` from `workspace-sync-status.tsx`
2. Before rendering tracker grid, check:
   - `phase === "syncingManifest"` OR `!health.manifestReady` → loading panel
   - `manifestError` → error panel + **Retry sync** button
   - `phase === "syncingInventory" && !health.hasInventoryCache` → “Fetching your armor…”
3. **Prefer extracting** a small shared component (e.g. `WorkspaceSyncGatePanel`) used by both table empty panel and grid — only if it reduces duplication without over-abstracting. Inline in grid is fine if simpler.

**Copy source:** Reuse titles/details from `inventoryTableEmptyState()` in `workspace-data-health.shared.ts` — don’t duplicate strings in a third place if avoidable.

**Verify:** Grid tab on empty manifest env shows spinner, not misleading “No sets for this class” everywhere.

---

### Phase 5 — Storybook & tests

**Files:**

| File | Action |
|------|--------|
| `inventory-table-view.stories.tsx` | `ManifestNotReady` story — no sync button in DOM |
| `.storybook/mocks/workspace-health.ts` | Optional: add syncing phase mock |
| `armor-set-combobox.stories.tsx` | Update `emptyCatalogMessage` if default changed |
| `grid-workspace.stories.tsx` | Optional: story with `MOCK_WORKSPACE_HEALTH_NO_MANIFEST` + sync provider |

**Storybook MCP:** Before changing component props, query `armor-checklist-sb-mcp` per AGENTS.md.

**Commands:**

```bash
npm run lint
npm run build
npm run test-storybook
# or: npx vitest --project=storybook
```

---

### Phase 6 — Docs (developer-facing)

**Files:** `README.md`, `CLAUDE.md`

- First-run manifest: happens automatically when user opens `/dashboard` after sign-in
- Keep `curl -kX POST …/manifest/sync` and `scripts/sync-manifest.ts` as **optional** headless/dev setup
- Document `CRON_SECRET` for Vercel weekly cron

Do **not** tell end users to press sync manifest anywhere in docs.

---

## 5. What NOT to do

- ❌ Merge manifest sync into Refresh button
- ❌ Remove `WorkspaceAutoSync`
- ❌ Remove `/api/admin/manifest/sync` route
- ❌ Add a new client manifest sync hook — use existing pipeline + `retrySync`
- ❌ Edit files under `.claude/worktrees/` (not production code)
- ❌ Edit existing Supabase migrations
- ❌ Commit unless user asks

---

## 6. Success criteria (final checklist)

- [ ] `rg SyncManifestButton src/` → zero matches
- [ ] `rg -i "sync the manifest|sync bungie manifest|database icon" src/` → zero user-facing matches
- [ ] Header: feedback, **refresh**, profile, sign-out — no database icon
- [ ] No manifest sync button in banner, table empty state, or grid
- [ ] Manifest failure recoverable via **Retry sync** only
- [ ] GET cron with `CRON_SECRET` works; unauthenticated GET returns 401
- [ ] POST with session still works (auto-sync from browser)
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] Story tests updated/passing for changed stories

---

## 7. File change checklist

| Action | Path |
|--------|------|
| **Delete** | `src/components/dashboard/sync-manifest-button.tsx` |
| **Edit** | `src/components/app-header.tsx` |
| **Edit** | `src/components/dashboard/manifest-status-banner.tsx` |
| **Edit** | `src/components/dashboard/inventory-table-view.tsx` |
| **Edit** | `src/lib/workspace/workspace-data-health.shared.ts` |
| **Edit** | `src/components/workspace/tracker-filter-bar.tsx` |
| **Edit** | `src/components/workspace/tracker-filter-bar-overflow-menus.tsx` |
| **Edit** | `src/components/views/armor-set-combobox.tsx` |
| **Edit** | `src/components/views/armor-set-multi-select.tsx` |
| **Edit** | `src/components/views/view-grid.tsx` |
| **Edit** | `src/lib/inventory/sync.ts` |
| **Edit** | `src/components/workspace/grid-workspace.tsx` |
| **Edit (infra)** | `src/app/api/admin/manifest/sync/route.ts` |
| **Edit (infra)** | `src/lib/env.ts` |
| **Edit (docs)** | `README.md`, `CLAUDE.md` |
| **Edit (stories)** | `inventory-table-view.stories.tsx`, `armor-set-combobox.stories.tsx` |
| **Optional add** | Shared `WorkspaceSyncGatePanel` component |

**Do not edit:** `workspace-auto-sync.tsx` (unless fixing a bug discovered during testing), `refresh-button.tsx`, `dashboard/page.tsx` (unless banner wiring needs tweak).

---

## 8. Key code references

### Auto-sync mount

```154:154:src/components/dashboard/dashboard-workspace.tsx
          <WorkspaceAutoSync health={dataHealth} />
```

### Auto-sync triggers

```268:274:src/components/dashboard/workspace-auto-sync.tsx
    const shouldRun =
      health.manifestNeedsSync ||
      inventoryCacheNeedsSync(syncedAt) ||
      !health.hasInventoryCache;
```

### Retry registration

```261:264:src/components/dashboard/workspace-auto-sync.tsx
    registerRetry(() => {
      void runPipeline({ forceManifest: true, forceInventory: true });
    });
```

### Header (remove line 61)

```58:61:src/components/app-header.tsx
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        <FeedbackHeaderDialog />
        <RefreshButton variant="header-large" />
        <SyncManifestButton variant="header-large" />
```

### Manifest route (extend, don’t delete)

```11:19:src/app/api/admin/manifest/sync/route.ts
export async function POST(req: NextRequest) {
  ...
  try {
    await requireSessionFromRequest(req);
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
```

---

## 9. Suggested commit message (if asked)

```
Remove manual manifest sync UI; automate via cron and existing auto-sync.

Users only refresh inventory manually. Manifest sync runs on dashboard load
and via CRON_SECRET-authenticated Vercel cron. Passive copy replaces
"sync the manifest" prompts; grid view gets loading gate parity with table.
```

---

## 10. Out of scope

- Saved views feature (unrelated)
- Merging Refresh + manifest
- Debug page auto-sync (header fix is sufficient)
- Adding a test suite (repo has Storybook vitest only)
