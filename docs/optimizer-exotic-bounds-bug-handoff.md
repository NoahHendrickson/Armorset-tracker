# Handoff: Exotic locked loadouts show no gray achievable band

**Status:** Open — user still reports missing light gray band for specific exotics after multiple fixes.  
**Last updated:** 2026-05-31  
**Repo:** `armorset-checklist`  
**Related:** [loadout-optimizer-handoff.md](./loadout-optimizer-handoff.md) (general optimizer feature)

---

## 1. Bug summary (give this to the new agent)

When the user locks certain **exotic armor** pieces in the Optimize tab (e.g. Speaker's Sight, Sanguine Alchemy, Rain of Fire, Felwinter's Helm), the **stat target sliders show no darker gray “achievable” band** (`achievableMin`–`achievableMax` stay `0–0` for all stats). Search often returns **no builds** even when the user believes the vault can hit targets (e.g. 139 Weapons).

The **light gray track** (`bg-muted`) is always visible; the **missing piece** is the **darker band** (`bg-muted-foreground/35`) rendered only when `achievableMax > achievableMin` (or when width &gt; 0 on the 0–200 scale).

---

## 2. Reproduction

1. Sign in, open `/dashboard`, **Optimize** tab.
2. Select class (e.g. Warlock for Speaker's Sight / Sanguine Alchemy).
3. Ensure Tier 5 legendaries exist in pool (pool count &gt; 0, no “missing slot” warning).
4. **Exotic armor** section → click thumbnail for **Speaker's Sight** (or other listed exotics) to **lock** that exotic.
5. Observe **Stat targets** sliders: no darker gray segment; footer may show `Achievable 0–0` / `max 0`.
6. Set **Weapons** min (e.g. 139) → optimizer runs → **no results**.

**Works (for comparison):** Some exotics / “Any exotic” / “All legendary” may show non-zero bands depending on inventory and whether pieces have `statTotals` in cache.

---

## 3. What the gray band is (code path)

| Layer | File | Behavior |
|-------|------|----------|
| UI | `src/components/optimizer/stat-range-slider.tsx` | Dark band: `left = pct(achievableMin)`, `width = pct(achievableMax) - pct(achievableMin)`. If both 0 → **invisible**. |
| View | `src/components/dashboard/loadout-optimizer-view.tsx` | `bounds = computeStatBounds(optimizerPool, statOffset, exoticLock)` → per stat `range.min` / `range.max` passed as `achievableMin` / `achievableMax`. |
| Math | `src/lib/optimizer/bounds.ts` | Returns **`emptyBounds()`** (`0–0` every stat) if **any** slot has zero pieces in `groupPoolBySlot`, or if `minTotalForStat` / `maxTotalForStat` returns `null` for any stat. |
| Pool | `src/lib/optimizer/pool.ts` | `optimizerPool = filterOptimizerPool(inventory, classType, { exoticLock })` — only pieces with `pieceHasStatTotals()` and (Tier 5 legendary **or** exotic). |
| Piece stats | `src/lib/inventory/compute-stat-totals.ts` | `pieceHasStatTotals` ← `resolvePieceStatTotals` (cached `statTotals` or `estimateStatTotalsFromLabels`). |
| Derive | `src/lib/inventory/derive.ts` | Builds `statTotals` from socket `armor_stats` plugs + tuning; exotic fallbacks below. |

**Important:** `poolCoversAllSlots(optimizerPool)` can be **true** while `computeStatBounds` still returns zeros — e.g. pool has a row per slot but **no numeric stats** on the locked exotic after grouping, or **legendary extremum** fails on a slot.

---

## 4. Known affected exotics (user report)

Examples that **still** fail after fixes in this thread:

- Speaker's Sight (class item)
- Sanguine Alchemy (chest)
- Rain of Fire (legs)
- Felwinter's Helm (helmet)
- “and more” — pattern likely **Armor 3.0 exotics** with stats on sockets/instance, not on item root `investmentStats`

---

## 5. Root-cause hypothesis (for investigation)

The achievable band is zero when **`computeStatBounds` bails out**. Most likely chain for these exotics:

### A. Locked exotic has no `statTotals` in cached inventory

1. User locks exotic in UI from `uniqueOwnedExoticsForClass` (does **not** require stats).
2. `optimizerEligiblePieces` **excludes** pieces without `pieceHasStatTotals`.
3. `mergeLockedExoticCopiesIntoPool` only adds copies that pass `pieceHasStatTotals`.
4. If **no** copy of that exotic has stats in `inventory_cache`, the locked slot may have **no stat-bearing exotic** in `optimizerPool`.
5. `bounds.ts` locked branch: `lockedPieces.length === 0` → `maxTotalForStat` returns `null` → **empty bounds**.

Even with manifest `exotic_armor.stat_totals`, **cached JSON rows** must be re-derived on **inventory refresh** after manifest sync.

### B. Manifest `exotic_armor.stat_totals` empty for item hash

Populated in `src/lib/manifest/derive.ts` via:

- `investmentStatsToStatTotals(item.investmentStats)` — often **empty** on Armor 3.0 exotics
- `exoticStatBudgetFromItemSockets(item, { statPlugs, tuningPlugStats, plugToTuning })` — only plugs with `singleInitialItemHash` in **item definition** sockets

May still be `{}` if:

- Exotic uses **randomized/reusable** plug sets only (no `singleInitialItemHash`)
- Stat plugs use plug hashes **not** in `armor_stat_plugs` / `lookups.statPlug`
- Item is a **reissued hash**; user owns a different hash than manifest row synced

### C. Bungie profile ItemStats (304) not in cached inventory

- `PROFILE_COMPONENTS` now includes **304** (`src/lib/bungie/constants.ts`).
- `instanceArmorStatTotals` in `src/lib/inventory/instance-armor-stats.ts` runs only at **derive** time.
- **Old** `inventory_cache` rows lack instance-based totals until user hits **Refresh inventory**.

Requires `armor_stat_icons.destiny_stat_hash` populated (manifest sync after migration **0021**).

### D. Slot has no Tier 5 legendaries (legendary extremum null)

For **locked exotic** bounds, other four slots use `slotStatExtremum` (legendaries preferred; exotics fallback if alone in slot). If a slot has **no** piece with stats → `null` → empty bounds.

Less common if user has a normal vault, but possible for **class item** slot if only exotic class item exists and legendaries lack `statTotals`.

### E. UI / lock identity mismatch

- Thumbnails dedupe by **slot + display name** (`exoticPieceIdentityKey`), not `itemHash`.
- Lock stores one `itemInstanceId` (representative).
- Pool keeps all identity-matching copies — OK if any copy has stats.
- If representative is selected but **only a different copy** has stats and merge fails → still A.

---

## 6. Fixes already attempted (this conversation)

Do **not** redo blindly; verify what landed and what still fails.

| Change | Files | Intent |
|--------|-------|--------|
| Exotic thumbnail picker + dedupe by name/slot | `exotic-armor-picker.tsx`, `exotic-lock.ts` | UI; one thumbnail per exotic identity |
| Lock applies to all copies same identity | `exotic-lock.ts`, `pool.ts`, `bounds.ts`, `search.ts` | Search/bounds use best roll among duplicates |
| Search uses `getPieceStatCeiling` | `search.ts` | Match achievable pruning to tuning branches |
| `exotic_armor.stat_totals` column | `0020_exotic_armor_stat_totals.sql`, `exotic-stat-budget.ts` | Manifest budgets for exotics |
| Socket-template budgets at manifest derive | `derive.ts` + `exoticStatBudgetFromItemSockets` | Armor 3.0 exotics without root investmentStats |
| Inventory: exotic sockets without `isEnabled` | `inventory/derive.ts` | Read disabled intrinsic plugs |
| Profile component **304** ItemStats | `constants.ts`, `instance-armor-stats.ts`, `derive.ts` | Instance stat block fallback |
| `armor_stat_icons.destiny_stat_hash` | `0021_armor_stat_icons_destiny_hash.sql` | Map 304 stat hashes → Weapons/Health/… |
| Lookups fallback if columns missing | `lookups.ts` `paginatedSelectExoticArmor`, `paginatedSelectArmorStatIcons` | App boots before migration |
| `slotStatExtremum` + pool pieces in bounds `groupPoolBySlot` | `bounds.ts` | Exotic-only slot + pieces without double-filter |
| Mod offset only on **active** stat targets | `mod-offset.ts`, `loadout-optimizer-view.tsx` | +50 only on targeted stat, not all six |
| `SLOT_ORDER` import fix | `loadout-optimizer-view.tsx` | Runtime error when setting stat target |

**Migrations applied to remote Supabase (user env):**

- `0020_exotic_armor_stat_totals.sql`
- `0021_armor_stat_icons_destiny_hash.sql`

**Not verified end-to-end by agent:** manifest re-sync + inventory refresh on user account after 0021; `scripts/sync-manifest.ts` fails locally (`server-only` import).

---

## 7. Debugging playbook (recommended order)

### Step 1 — Confirm cached piece shape

Pick one failing exotic (e.g. Speaker's Sight). In DB or debug API:

- `GET /api/debug/inventory` or inspect `inventory_cache.items` for that `itemInstanceId` / `itemHash`.
- Check: `isExotic`, `statTotals`, `primaryStat` / `secondaryStat` / `tertiaryStat`, `tuningName`.

**Pass:** `statTotals` has numeric keys (e.g. `Weapons: N`).  
**Fail:** `{}` / missing → bounds will be zero until derive fixed + refresh.

### Step 2 — Confirm manifest row

```sql
SELECT item_hash, name, slot, stat_totals
FROM exotic_armor
WHERE name ILIKE '%Speaker%Sight%' OR name ILIKE '%Sanguine%' OR name ILIKE '%Rain of Fire%' OR name ILIKE '%Felwinter%';
```

**Pass:** `stat_totals` JSON non-empty after manifest sync.  
**Fail:** `{}` or null → fix `exoticStatBudgetFromItemSockets` / plug walk / reusable plug sets.

### Step 3 — Confirm destiny stat hash map

```sql
SELECT stat, destiny_stat_hash FROM armor_stat_icons;
```

Need six rows with non-null `destiny_stat_hash` for 304 mapping.

### Step 4 — Unit-test bounds in isolation

Use `src/lib/optimizer/bounds.test.ts` patterns. Construct `mockPiece` with `isExotic: true` and realistic `statTotals` for all five slots + locked exotic. Call:

```ts
computeStatBounds(pool, undefined, { mode: "locked", itemInstanceId, slot });
```

If test passes but prod fails → **cached inventory** or **pool filter** issue, not math.

### Step 5 — Log in `computeStatBounds` (temporary)

In `bounds.ts` before `return emptyBounds()`:

- Log which slot is empty in `groupPoolBySlot(pool)`.
- Log `lockedPieces.length` for locked slot.
- Log first stat where `minTotalForStat` / `maxTotalForStat` is null.

### Step 6 — Compare with DIM / raw Bungie

For one `itemHash`, inspect manifest item definition sockets (Bungie definitions or `src/app/api/debug/raw-piece` if exists). Document whether stats live on:

- `investmentStats` on item
- `singleInitialItemHash` plugs
- Only live instance (304)
- Only reusable plug set (310) — **not** fully handled in manifest budget today

---

## 8. Suggested fix directions (not implemented)

1. **Force-include locked exotic in pool** even when `pieceHasStatTotals` is false, and synthesize totals from `exoticStatBudgetByItemHash` at pool/bounds time (not only at derive).
2. **Walk reusable plug sets** in `exoticStatBudgetFromItemSockets` (manifest plug set definitions) when `singleInitialItemHash` is absent.
3. **Broader plug map** at inventory derive: any socket plug whose manifest `investmentStats` map to `ARMOR_STAT_NAMES`, not only `lookups.statPlug`.
4. **Debug panel** on Optimize tab: show per-slot pool count, whether locked piece has stats, and computed `bounds.Weapons` for Warlock + locked exotic (developer-only).
5. **Re-derive single piece** endpoint for testing without full inventory sync.

---

## 9. Key files (quick index)

```
src/components/dashboard/loadout-optimizer-view.tsx   # bounds → StatRangeSlider
src/components/optimizer/stat-range-slider.tsx        # gray band rendering
src/components/optimizer/exotic-armor-picker.tsx      # lock UI

src/lib/optimizer/bounds.ts                           # achievable min/max
src/lib/optimizer/pool.ts                             # optimizerPool
src/lib/optimizer/exotic-lock.ts                      # lock + merge copies
src/lib/optimizer/search.ts                           # build search

src/lib/inventory/derive.ts                           # statTotals on pieces
src/lib/inventory/instance-armor-stats.ts             # Bungie 304
src/lib/inventory/compute-stat-totals.ts              # pieceHasStatTotals

src/lib/manifest/derive.ts                            # exotic_armor + stat icons
src/lib/manifest/exotic-stat-budget.ts                # manifest budgets
src/lib/manifest/lookups.ts                           # caches + column fallbacks

supabase/migrations/0020_exotic_armor_stat_totals.sql
supabase/migrations/0021_armor_stat_icons_destiny_hash.sql

src/lib/bungie/constants.ts                           # PROFILE_COMPONENTS incl. 304
```

**Tests:**

- `src/lib/optimizer/bounds.test.ts`
- `src/lib/optimizer/exotic-lock.test.ts`
- `src/lib/manifest/exotic-stat-budget.test.ts`

---

## 10. Commands

```bash
npm run db:push              # apply 0020 + 0021 if not already
npm run dev:http             # dashboard (or npm run dev for HTTPS OAuth)

# unit tests (no full test suite in repo)
npx vitest run src/lib/optimizer/bounds.test.ts
npx vitest run src/lib/optimizer/exotic-lock.test.ts
npx vitest run src/lib/manifest/exotic-stat-budget.test.ts

npm run storybook            # LoadoutOptimizerView stories
```

**User must run after manifest/schema changes:**

1. Manifest sync (dashboard auto-sync or authenticated admin sync — **not** broken `scripts/sync-manifest.ts` without fixing server-only).
2. **Refresh inventory** (header) to rewrite `inventory_cache` with 304 + new derive.

---

## 11. Success criteria

- [ ] Lock Speaker's Sight (Warlock) → Weapons slider shows **Achievable X–Y** with **X &lt; Y** and non-zero Y (darker gray band visible).
- [ ] Same for Sanguine Alchemy, Rain of Fire, Felwinter's Helm on correct class.
- [ ] With achievable max ≥ user target, optimizer returns ≥ 1 build (or clear UI why not).
- [ ] `npx vitest run src/lib/optimizer/bounds.test.ts` passes; add regression test using real `itemHash` from manifest once identified.

---

## 12. Agent notes

- **Do not hallucinate Storybook props** — use `armor-checklist-sb-mcp` if Storybook is running.
- General optimizer PRD context: [loadout-optimizer-handoff.md](./loadout-optimizer-handoff.md) (status there is stale vs Optimize tab implementation).
- User inventory is **server-side** only; repro requires signed-in session or mocked `DerivedArmorPieceJson` in stories/tests.
- Prior agent applied migrations to **user's** remote Supabase; local DB may differ.

---

## 13. Open questions for stakeholder

1. After manifest sync + inventory refresh, does `/api/debug/inventory` (or equivalent) show `statTotals` on Speaker's Sight?
2. Are failing pieces **masterworked / tuned** with empty socket plug in API but stats only in component 304?
3. Should achievable band use **instance rolls** (304) always for exotics, or **theoretical max** from manifest?
