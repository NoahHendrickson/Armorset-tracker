# Handoff: Optimizer gray-band bounds (untargeted stats + D2ArmorPicker parity)

**Status:** In progress — partial fix written locally, accuracy gap remains.  
**Last updated:** 2026-06-01  
**Repo:** `armorset-checklist`  
**Related:**
- [optimizer-d2armorpicker-parity-handoff.md](./optimizer-d2armorpicker-parity-handoff.md) — Speaker's Sight reference build; stat/tuning accounting vs D2AP
- [loadout-optimizer-handoff.md](./loadout-optimizer-handoff.md) — general optimizer feature
- [optimizer-stat-calculation-fix-handoff.md](./optimizer-stat-calculation-fix-handoff.md) — `resolveLoadoutTotals` / mod allocation
- [optimizer-exotic-bounds-bug-handoff.md](./optimizer-exotic-bounds-bug-handoff.md) — exotic lock empty-band cases (partially overlapping)

---

## 1. Bug summary (give this to the new agent)

When the user sets **high stat targets** on some stats (e.g. Weapons 200, Grenade 100, Super 100) with **Ferropotent 2pc + Smoke Jumper 2pc** and **Boots of the Assembler** locked, the **Stat targets** sliders for **untargeted** stats (Health, Melee, Class) should still show a **darker gray achievable band** up to ~**25** — matching D2ArmorPicker’s `0 / 25` display.

**Observed in app:** Untargeted stats show **no darker gray band** (only the light `bg-muted` track). Targeted stats show green selection + gray band correctly.

**Reference UI:** D2ArmorPicker screenshot (user-provided, 2026-06-01):

| Stat    | User target | D2ArmorPicker achievable max |
|---------|-------------|------------------------------|
| Weapons | 200         | 200                          |
| Grenade | 100         | 119                          |
| Super   | 100         | 102                          |
| Health  | 0 (unset)   | **25**                       |
| Melee   | 0 (unset)   | **25**                       |
| Class   | 0 (unset)   | **25**                       |

**Two separate issues:**

1. **Zero-width bands (P0, partial fix in tree)** — achievable max collapses to 0 so `stat-range-slider.tsx` renders invisible dark band.
2. **Wrong max on full vault (P1, open)** — even after fix, `boundsLockedWithSetBonuses` on user vault does not match D2ArmorPicker (~25 on untargeted stats).

---

## 2. Reproduction

### UI

1. Sign in, `/dashboard` → **Optimize** tab.
2. Class: **Warlock**.
3. **Armor set:** Ferropotent 2pc + Smoke Jumper 2pc.
4. **Exotic armor:** Lock **Boots of the Assembler** (legs).
5. **Assumed stat mods:** 3 major (+10 each).
6. **Stat targets:** Weapons **200**, Grenade **100**, Super **100**; leave Health / Melee / Class unset.
7. **Expected:** Health, Melee, Class sliders show gray band from 0 → ~25.
8. **Actual (before fix):** No dark gray segment on those three stats.
9. Generate builds → should find loadouts (user saw ~8 builds); example verified totals:

   `Weapons 200 · Health -15 · Class 0 · Grenade 119 · Melee -5 · Super 100`

### Headless (cached inventory)

Requires `.env.local` with Supabase + run with server-only stub:

```bash
NODE_OPTIONS='--require ./scripts/stub-server-only.cjs' \
npx tsx --tsconfig tsconfig.json scripts/verify-dim-loadout.ts \
  6917530147055270152 \
  6917530167771126356 \
  6917530146665347396 \
  6917530158828866218 \
  6917530159155527574
```

Look at `warlockVault.boundsLockedWithSetBonuses` in JSON output (~20–30s on ~412-piece Warlock vault).

---

## 3. User’s reference build (real cache data)

**Instance IDs (five-piece loadout):**

| Slot      | Instance ID           | Piece                 | Set              |
|-----------|------------------------|------------------------|------------------|
| helmet    | `6917530147055270152`  | Smoke Jumper Set       | Smoke Jumper     |
| arms      | `6917530167771126356`  | Ferropotent            | Ferropotent      |
| chest     | `6917530146665347396`  | Smoke Jumper Set       | Smoke Jumper     |
| legs      | `6917530158828866218`  | Boots of the Assembler | **Exotic**       |
| classItem | `6917530159155527574`  | Ferropotent            | Ferropotent      |

**Set hashes:** Ferropotent `3734029045`, Smoke Jumper `2751989785`.

**Sparse `statTotals` from cache (2026-06-01 verify run):**

```json
{
  "helmet":  { "Super": 20, "Health": -5, "Grenade": 25, "Weapons": 35 },
  "arms":    { "Melee": -5, "Super": 20, "Grenade": 25, "Weapons": 35 },
  "chest":   { "Super": 25, "Health": -5, "Grenade": 25, "Weapons": 30 },
  "legs":    { "Super": 12, "Grenade": 19, "Weapons": 30 },
  "classItem": { "Super": 20, "Health": -5, "Grenade": 25, "Weapons": 35 }
}
```

**Armor sum (no mods):** Weapons 165, Health -15, Class 0, Grenade 119, Melee -5, Super 97.

**Verified loadout** (Weapons 200 / Grenade 100 / Super 100, 3 majors, set bonuses):

```json
{
  "totals": { "Weapons": 200, "Health": -15, "Class": 0, "Grenade": 119, "Melee": -5, "Super": 100 },
  "modAllocation": { "Super": 3, "Weapons": 35 }
}
```

Search: **1** build with Boots locked; **0** with “no exotic”.

---

## 4. Code path (gray band)

| Layer | File | Role |
|-------|------|------|
| UI | `src/components/optimizer/stat-range-slider.tsx` | Dark band: `achievableMin`–`achievableMax`. Clamps display with `Math.max(0, achievableMin)`. Invisible when `achievableMax ≤ 0`. |
| Hook | `src/lib/optimizer/use-stat-bounds-for-sliders.ts` | Calls `computeStatBounds`. |
| Router | `src/lib/optimizer/bounds.ts` | If `hasStatTargets` → heuristic (always; `JOINT_BOUNDS_COMBO_LIMIT = 0`). Else independent per-slot extrema. |
| Heuristic | `src/lib/optimizer/bounds-heuristic.ts` | Greedy five-piece + `maxAchievableTargetedStat` / `maxAchievableUntargetedStat` (bounded variants on large pools). |
| Verified totals | `src/lib/optimizer/resolve-loadout-totals.ts` | `resolveLoadoutStatExtremum` — max/min one stat with **other** constraints only (correct semantics for untargeted stats). |
| Achievable max | `src/lib/optimizer/combo-count.ts` | `maxAchievable*Stat` — highest verified **total** on focus stat under current constraints (gray-band max). |
| Slider-min search | `src/lib/optimizer/combo-count.ts` | `maxFeasibleStatTarget` — binary search highest **min target** (diagnostics/tests only; **not** used for gray-band max). |
| View | `src/components/dashboard/loadout-optimizer-view.tsx` | Passes pool, constraints, set bonuses, assumed mods, exotic lock. |

**Constants:** `src/lib/optimizer/constants.ts` — `JOINT_BOUNDS_COMBO_LIMIT = 0` (joint enumeration disabled on hot path).

---

## 5. Root-cause analysis

### Issue A — Zero-width bands (partially fixed, uncommitted)

**Chain:**

1. `greedyLoadoutStatExtremum` returns a **negative** `maxVal` for untargeted stats under tight cross-stat targets (tuning debuffs stack).
2. Old code applied `maxVal` first, then called `maxFeasibleStatTarget(..., { hi: tightenedMax })` with negative `hi` → clamped to **0**.
3. If `feasible(0)` returned true, `maxFeasibleStatTarget` returned **0** immediately.
4. Final `achievableMax` ≤ 0 → slider band width 0.

**Partial fix in working tree (`bounds-heuristic.ts`):**

- Run `maxFeasibleStatTarget` with `hi: independentBounds[stat].max` (not pre-tightened greedy max).
- Only apply capped target when `> OPTIMIZER_STAT_MIN`.
- Do not let negative `maxVal` override a positive verified cap.

**Synthetic test added:** `bounds.test.ts` → `"shows a positive gray-band max on untargeted stats under high other targets"`.

### Issue B — Wrong achievable max vs D2ArmorPicker (open)

**Measured** `boundsLockedWithSetBonuses` on user vault (2026-06-01):

| Stat    | Our bounds (min–max) | D2ArmorPicker max |
|---------|----------------------|-------------------|
| Weapons | 24–200               | 200               |
| Grenade | 18–124               | 119               |
| Super   | 0–**102**            | **102** ✓         |
| Health  | -20–**95**           | **25**            |
| Melee   | -20–**5**            | **25**            |
| Class   | 0–**5**              | **25**            |

**Historical hypothesis (fixed in `bounds-heuristic.ts`):** `maxFeasibleStatTarget` was invoked for **untargeted** stats. It uses `constraintsWithStatMin`, which activates the focus stat during mod allocation — wrong semantics for gray-band max. Current code uses `maxAchievableUntargetedStat` / `maxAchievableTargetedStat` instead; `maxFeasibleStatTarget` remains for slider-min binary search (tests/diagnostics only).

- **Correct question for untargeted stat gray max:** “What is the highest value this stat can take in a verified loadout that meets **other** active targets, **without** allocating assumed mods to this stat?”
- **That API already exists:** `resolveLoadoutStatExtremum(..., otherConstraints, ..., focusStat, "max")` and joint enumeration in `bounds-joint.ts` (disabled on hot path).

**Secondary:** Greedy piece selection in `greedyLoadoutStatExtremum` may underestimate max (~5 vs ~25 for Class/Melee) when tuning branches interact — verified cap should win when combo count is small enough.

**Do not use** `boundsFivePiece` in verify script for acceptance — it runs bounds on exactly five pieces (one per slot), which echo a single loadout, not the vault slider scenario. Use `warlockVault.boundsLockedWithSetBonuses`.

---

## 6. Implementation plan

### Phase 0 — Land partial fix (P0)

**Goal:** Untargeted stats show *some* non-zero gray band in UI for user scenario.

**Files:** `src/lib/optimizer/bounds-heuristic.ts`, `src/lib/optimizer/bounds.test.ts`

**Tasks:**

1. Review uncommitted diff in `bounds-heuristic.ts` (see §5 Issue A).
2. Run `npx vitest run src/lib/optimizer/bounds.test.ts`.
3. Commit with message focused on “don’t zero untargeted slider bands when greedy max is negative”.

**Verify:** User UI or verify script — Health/Melee/Class `max > 0` in bounds (may still be wrong magnitude).

---

### Phase 1 — Fix untargeted stat max semantics (P1)

**Goal:** Untargeted stat `achievableMax` ≈ D2ArmorPicker (~25 for Health/Melee/Class on reference build).

**Files:**

- `src/lib/optimizer/bounds-heuristic.ts` (main change)
- `src/lib/optimizer/combo-count.ts` (optional: document or restrict `maxFeasibleStatTarget` usage)
- `src/lib/optimizer/constraints.ts` — `isActiveStatConstraint`, `otherActiveStatConstraints`

**Change (recommended):**

In `computeHeuristicConstrainedStatBounds`, inside the per-stat loop:

```typescript
const row = constraints.find((r) => r.stat === stat);
const isTargeted = row != null && isActiveStatConstraint(row);

if (othersActive.length > 0 && isTargeted && !filteredComboCapped && ...) {
  // maxFeasibleStatTarget only for user-targeted stats
}
```

For **untargeted** stats (`!isTargeted`):

- Rely on `greedyLoadoutStatExtremum` → `resolveLoadoutStatExtremum` with `otherActiveStatConstraints(constraints, stat)`.
- Optionally tighten with exact `jointStatBounds` when `estimateFilteredComboCount(...) <= JOINT_BOUNDS_COMBO_LIMIT` (consider raising limit from 0 for bounded filtered pools only — e.g. ≤ 10_000 after set-bonus filter).

**Do not** call `maxFeasibleStatTarget` for untargeted stats — it activates the stat and corrupts mod allocation semantics.

**Tests to add:** `src/lib/optimizer/user-build-boots-assembler.test.ts` (new) with:

- Pool fixture from §3 (copy stat totals from verify output).
- Constraints: Weapons 200, Grenade 100, Super 100; 3 majors; set bonuses; Boots locked.
- Assert:
  - `bounds.Health.max` in `[20, 30]` (tolerance ±5)
  - `bounds.Melee.max` in `[20, 30]`
  - `bounds.Class.max` in `[20, 30]`
  - `bounds.Super.max` in `[100, 102]`
  - `bounds.Grenade.max` in `[115, 125]`
- Assert `searchLoadouts` returns ≥ 1 solution with expected totals.

**Verify:**

```bash
NODE_OPTIONS='--require ./scripts/stub-server-only.cjs' \
npx tsx --tsconfig tsconfig.json scripts/verify-dim-loadout.ts [ids...]
# warlockVault.boundsLockedWithSetBonuses matches D2ArmorPicker table in §5
```

---

### Phase 2 — Regression harness (P2)

**Goal:** Prevent recurrence; make user builds easy to verify.

**Files:**

- `scripts/verify-dim-loadout.ts` (already extended — document in script header)
- Export `D2ARMORPICKER_BUILD_IDS` from verify script or shared fixture module
- Optional: `GET /api/debug/verify-loadout?ids=...&WeaponsMin=200&GrenadeMin=100&SuperMin=100&majorCount=3`

**Tasks:**

1. Remove or rename misleading `boundsFivePiece` → `boundsSingleLoadoutOnly` with comment.
2. Add `expectedBounds` object in verify script for D2ArmorPicker build; print `pass/fail` comparison.
3. Wire `npm run verify:dim-loadout` script in `package.json` if useful.

---

### Phase 3 — Optional polish

- **Slider UX:** Show `min / max` like D2ArmorPicker (`0 / 25`) in compact mode footer.
- **Negative raw totals:** Document that in-game display floors at 0; bands use raw totals but slider clamps left edge to 0 (`stat-range-slider.tsx` already does).
- **Performance:** Full-vault bounds with set bonuses took ~19s locally; consider caching bounds per `(pool hash, constraints, set bonuses)` or skipping `maxFeasibleStatTarget` when filtered combo count > threshold.
- **Joint bounds:** Re-enable `jointStatBounds` for filtered combo count ≤ N (small N) as async refinement — see `bounds-joint.ts`, currently exported for tests only.

---

## 7. Uncommitted work in tree (as of 2026-06-01)

| File | Change |
|------|--------|
| `src/lib/optimizer/bounds-heuristic.ts` | Phase 0 partial fix (verified cap order, don’t apply zero cap, don’t let negative greedy erase cap) |
| `src/lib/optimizer/bounds.test.ts` | Synthetic regression test for positive untargeted max |
| `scripts/verify-dim-loadout.ts` | CLI ids, D2ArmorPicker constraints, `boundsLockedWithSetBonuses`, `NODE_OPTIONS` note |

**Not yet done:** Phase 1 (`isTargeted` guard), user-build fixture test, UI verification.

---

## 8. Commands cheat sheet

```bash
# Lint / build
npm run lint
npm run build

# Unit tests (bounds + existing user build)
npx vitest run src/lib/optimizer/bounds.test.ts
npx vitest run src/lib/optimizer/user-build-speakers-sight.test.ts

# Verify real loadout against cache (needs Supabase env)
NODE_OPTIONS='--require ./scripts/stub-server-only.cjs' \
npx tsx --tsconfig tsconfig.json scripts/verify-dim-loadout.ts \
  6917530147055270152 6917530167771126356 6917530146665347396 \
  6917530158828866218 6917530159155527574

# Dev server (UI check)
npm run dev   # https://localhost:3000 — Bungie OAuth
npm run dev:http   # http://localhost:3000 — no OAuth
```

**Debug API (signed in):**

```
/api/debug/verify-loadout?ids=6917530147055270152,6917530167771126356,6917530146665347396,6917530158828866218,6917530159155527574&WeaponsMin=200&GrenadeMin=100&SuperMin=100&majorCount=3
```

---

## 9. Acceptance criteria

- [ ] With reference build settings (§2), Health / Melee / Class sliders show **visible** dark gray band (Phase 0).
- [ ] `achievableMax` for Health, Melee, Class ≈ **25** (±5) on full Warlock vault with Boots locked + set bonuses (Phase 1).
- [ ] Super `achievableMax` ≈ **102**; Grenade ≈ **119** (±5).
- [ ] Search still returns ≥ 1 build; verified totals match §3 (`Weapons 200`, etc.).
- [ ] `npx vitest run src/lib/optimizer/bounds.test.ts` and new user-build test pass.
- [ ] No regression in `user-build-speakers-sight.test.ts`, `bounds.test.ts` existing cases, `search.test.ts`.
- [ ] `npm run build` passes.

---

## 10. Files reference map

| File | Role |
|------|------|
| `src/lib/optimizer/bounds-heuristic.ts` | **Primary fix target** — slider gray bands under cross-stat targets |
| `src/lib/optimizer/bounds.ts` | Routes to heuristic vs independent bounds |
| `src/lib/optimizer/bounds-joint.ts` | Exact joint bands (not on hot path) |
| `src/lib/optimizer/bounds-independent.ts` | Per-slot extrema + mod/fragment offsets |
| `src/lib/optimizer/combo-count.ts` | `maxFeasibleStatTarget`, `estimateFilteredComboCount` |
| `src/lib/optimizer/resolve-loadout-totals.ts` | Verified totals + `resolveLoadoutStatExtremum` |
| `src/lib/optimizer/constraints.ts` | `isActiveStatConstraint`, `otherActiveStatConstraints` |
| `src/components/optimizer/stat-range-slider.tsx` | Renders gray band |
| `src/components/dashboard/loadout-optimizer-view.tsx` | Wires bounds hook |
| `scripts/verify-dim-loadout.ts` | Headless verification against `inventory_cache` |
| `src/lib/optimizer/user-build-speakers-sight.test.ts` | Prior user build (Speaker's Sight — different loadout) |

---

## 11. Context for the new agent

- User compares against **D2ArmorPicker** gray bands (`0 / 25` = unset min / max achievable while other targets hold).
- Raw armor stats can be **negative** on untargeted stats (tuning debuffs); builds are still valid (`displayedStatTotal` floors at 0 for constraint checks).
- Assumed mods allocate **only to active constraint stats** (`resolve-loadout-totals.ts` → `allocateAssumedMods`).
- `maxFeasibleStatTarget` **activates** the focus stat during search — correct for “how high can I set this slider?” on **that** stat, wrong for computing display max of **other** untargeted stats.
- First attempt to compute vault bounds via inline tsx hung >5 min; verify script completes in ~20s when manifest + cache already warm.

**Suggested first action:** Read Phase 0 diff → commit → implement Phase 1 `isTargeted` guard → add `user-build-boots-assembler.test.ts` → run verify script → compare `boundsLockedWithSetBonuses` to §5 table.
