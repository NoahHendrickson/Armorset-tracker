# Handoff: Optimizer shows impossible build totals

**Status:** Open — investigation complete; implementation not started.  
**Last updated:** 2026-05-31  
**Repo:** `armorset-checklist`  
**Related:** [loadout-optimizer-handoff.md](./loadout-optimizer-handoff.md), [optimizer-exotic-bounds-bug-handoff.md](./optimizer-exotic-bounds-bug-handoff.md)

---

## 1. Bug summary (give this to the new agent)

The Optimize tab returns builds with **stat totals that cannot exist in-game** — e.g. **674 total** with Mobility/Weapons at **200**, when five Tier 5 pieces + five +10 mods should cap around **~425** armor+mod points (375 intrinsics + 50 mod budget, plus fragments).

Two independent bugs inflate numbers:

1. **Assumed mod budget is duplicated per target stat** — five major mods (+50 total) are applied **to every stat with min > 0**, not once across the build.
2. **Tuning is summed via per-stat ceilings** — `getPieceStatCeiling()` takes the max of each stat across debuff variants independently, which **drops mandatory −5 penalties** (only the debuff target varies; the +5 stat is fixed at drop).

Search stores these inflated totals in `solution.totals` and `OptimizerResultCard` displays them unchanged.

---

## 2. Reproduction

1. Sign in → `/dashboard` → **Optimize** tab.
2. Select class (e.g. Warlock), lock an exotic (e.g. Speaker's Sight).
3. Set stat targets on **multiple stats** (e.g. 200 / 50 / 50 / 100 / 50 / 100).
4. **Assumed stat mods:** Major count = **5**, minor unchecked.
5. Require two armor sets (REQ), run optimizer.
6. Observe results with **total ~650–700** and individual stats at or above targets despite piece rows not supporting the math.

**Expected after fix:** No result whose verified totals exceed physical limits; total sum roughly ≤ ~425 + fragment bonus (order-of-magnitude sanity check).

---

## 3. Domain rules (do not re-litigate)

### 3.1 Stat scale

- UI uses **raw Armor 3.0 point totals** on a **0–200** slider (`OPTIMIZER_STAT_MAX` in `src/lib/optimizer/stat-range.ts`). This is intentional (DIM/D2ArmorPicker-style), not pre-3.0 tiers.
- Each piece contributes ~50–80 points from intrinsics + tuning; five pieces ≈ **250–400** before mods.

### 3.2 Tuning (critical)

Each armor piece has a **predetermined tuning direction at drop** (e.g. `+Weapons`). Whether the tuning mod is **committed** (slotted) or **uncommitted** (empty socket) does **not** change the boost direction.

- **Fixed at drop:** +5 on one stat (from `tuningName` / `tuningHash`, e.g. `+Weapons`).
- **Player choice (only when uncommitted):** which stat takes **−5** among ~5 reusable plugs that share the same +stat.
- **Committed:** exact +5/−5 pair in `statTotals`; no branching needed.
- **Uncommitted:** `tuningVariants[]` holds full stat maps per debuff option; **same +5 stat every time**, different −5 target.

**Wrong model (current ceiling):** max each stat across variants → can show 0 penalty on Grenade and 0 on Melee simultaneously.  
**Correct model:** pick **exactly one** variant per uncommitted piece (one −5 somewhere).

Reference: `src/lib/inventory/derive.ts` lines 196–263, comments on reusable plugs.

### 3.3 Assumed stat mods

- Up to **5 major** mods (+10 each) = **+50 total** across the whole loadout (one mod slot per armor piece).
- Optional **minor** mods: +5 per piece = +25 total if all five use minor (see `AssumedStatModsPanel` copy).
- Mod budget is a **shared pool**, not per target stat.
- UI copy: “+50 on target stats” means the pool applies toward stats with mins, **not** +50 on each stat (`assumed-stat-mods-panel.tsx`).

### 3.4 Subclass fragments

- Flat per-stat offset via `computeFragmentStatOffset()` — already correct; keep as additive input to verification.

---

## 4. Current calculation pipeline

```
loadout-optimizer-view.tsx
  fragmentStatOffset + modStatOffset → statOffset
  optimizerRequest { pool, constraints, statOffset, ... }
       ↓
search.ts (Web Worker: process.worker.ts)
  startTotals = statOffset
  for each of 5 pieces: startTotals[stat] += getPieceStatCeiling(piece, stat)
  if satisfiesConstraints(startTotals) → push { totals: startTotals }
       ↓
optimizer-result-card.tsx
  displays solution.totals (sum for “Total” footer)
```

| Step | File | Issue |
|------|------|--------|
| Mod offset | `mod-offset.ts` + `loadout-optimizer-view.tsx` | `computeAssumedModStatOffset(..., activeTargetStats)` sets full budget on **each** active target |
| Piece sum | `search.ts`, `bounds.ts` | Uses `getPieceStatCeiling` for totals, not verified assignment |
| Display | `optimizer-result-card.tsx` | No recompute from listed pieces |
| Constraints | `constraints.ts` | `satisfiesConstraints` only checks per-stat min/max; no total-sum or mod-pool check |

**Note:** `totalsFromPieces()` in `constraints.ts` correctly uses `getPieceStatValue()` (committed roll) but search **does not use it** for final solutions.

---

## 5. Target architecture

Introduce a single verification module used by **search** (accept/reject + final totals) and **bounds** (achievable bands):

```
src/lib/optimizer/resolve-loadout-totals.ts   (new)
```

### 5.1 Public API (suggested)

```ts
type AssumedStatMods = import("./mod-offset").AssumedStatMods;

/** One debuff branch for an uncommitted piece. */
type TuningAssignment = Partial<Record<ArmorStatName, number>>; // full stat map

export type ResolvedLoadout = {
  totals: Record<ArmorStatName, number>;
  /** Per slot: which tuning branch was used (undefined = committed statTotals). */
  tuningBySlot?: Partial<Record<OptimizerSlotKey, TuningAssignment>>;
  /** How many +10 / +5 mods placed on each stat (sum of major ≤ majorCount). */
  modAllocation?: Partial<Record<ArmorStatName, number>>;
};

/** Returns null if no valid tuning + mod assignment satisfies constraints. */
export function resolveLoadoutTotals(
  pieces: DerivedArmorPieceJson[],           // length 5, slot order
  constraints: StatConstraintRow[],
  fragmentOffset: Partial<Record<ArmorStatName, number>>,
  assumedMods: AssumedStatMods,
): ResolvedLoadout | null;
```

### 5.2 Resolution algorithm (sketch)

1. **Armor base:** For each piece, start from `getPieceStatValue()` if committed; if uncommitted, iterate `tuningVariants` (include `statTotals` as one candidate). Each candidate is a full `Partial<Record<ArmorStatName, number>>` — **do not** merge per-stat max across candidates.

2. **Combine five pieces:** Sum chosen branch per piece → `armorTotals`.

3. **Add fragments:** `addStatOffsets(armorTotals, fragmentOffset)`.

4. **Allocate mods (finite pool):**
   - `majorSlots = assumedMods.majorCount` (0–5), each grants +10 to one stat.
   - `minorPool = assumedMods.minor ? 5 * 5 : 0` (+5 per piece, same stacking rules as today’s `mod-offset.ts`).
   - Greedy or small LP: assign mods to satisfy active `constraints` (mins), prefer stats in constraint priority order, minimize waste. If any active min still unmet → `null`.
   - **Only stats with active mins** may receive assumed mods (matches UI intent).

5. **Validate:** `satisfiesConstraints(finalTotals, constraints)` and all stats ≥ 0.

6. **Search over tuning:** ≤5 pieces × ≤~5 variants → ≤3125 combos worst case; cheap at end of search only (not per branch during enumeration). Use greedy debuff pick first; fall back to full small cross-product if needed.

### 5.3 What stays optimistic (pruning only)

`getPieceStatCeiling` may remain in `partialCanReachMins` **only if** pruning is updated to not assume zero debuffs. Safer approach for Phase 1:

- **Pruning:** use per-slot max of `getPieceStatValue` + fixed +5 on predetermined tuning stat (ignore debuff for upper bound on boosted stat; for other stats use value without counting −5 as 0).
- **Acceptance:** always call `resolveLoadoutTotals`.

Document in code comments that ceiling-based pruning can be loose (explores extra branches) but must not be used for `solution.totals`.

---

## 6. Implementation plan (phased)

### Phase 0 — Fix mod offset API (blocking, small)

**Goal:** Stop adding +50 to every target stat before search runs.

**Files:**
- `src/lib/optimizer/mod-offset.ts`
- `src/lib/optimizer/mod-offset.test.ts`
- `src/components/dashboard/loadout-optimizer-view.tsx`

**Changes:**
1. Change `computeAssumedModStatOffset` so it returns the **total pool size** in a shape usable by verification, **not** duplicated per stat. Suggested:
   - Export `totalAssumedModBudget(assumedMods): { majorTotal: number; minorTotal: number }`.
   - Remove or deprecate applying `total` to every entry in `targetStats`.
   - View layer: stop merging mod offset into `statOffset` for search; pass `assumedStatMods` on `OptimizerRequest` instead (add field to `types.ts`).

2. Keep **fragments-only** in `statOffset` on the request (rename comment for clarity).

3. Update `AssumedStatModsPanel` helper text if needed (“+50 total toward target stats”).

**Tests:**
- 4 active targets + majorCount 5 → total mod points available = **50**, not 200.
- majorCount 3 + minor true → 30 + 25 = **55** total pool.

**Verify:** Unit tests pass; manually confirm `statOffset` no longer adds +50 to every stat in devtools/logging.

---

### Phase 1 — `resolveLoadoutTotals` + search verification (core fix)

**Goal:** Only emit solutions that pass verification; store verified totals.

**Files:**
- `src/lib/optimizer/resolve-loadout-totals.ts` (new)
- `src/lib/optimizer/resolve-loadout-totals.test.ts` (new)
- `src/lib/optimizer/types.ts` — add `assumedStatMods?: AssumedStatMods` to `OptimizerRequest`; optional `resolved?: ResolvedLoadout` on `OptimizerSolution`
- `src/lib/optimizer/search.ts`
- `src/lib/optimizer/search.test.ts`
- `src/components/dashboard/loadout-optimizer-view.tsx` — pass `assumedStatMods` on request
- `src/lib/optimizer/process.worker.ts` — no logic change if request shape updated

**Changes:**
1. Implement `resolveLoadoutTotals` per §5.2.
2. In `searchLoadouts`, when `slotIndex >= SLOT_ORDER.length` and set/exotic checks pass:
   - Call `resolveLoadoutTotals(chosen, constraints, fragmentOffset, assumedMods)`.
   - If `null`, return (do not push candidate).
   - Push `{ slots, totals: resolved.totals, signature, interchangeable, ... }`.
3. During enumeration, **stop** adding `getPieceStatCeiling` into `partialTotals` for acceptance; keep a separate partial sum for pruning if desired (Phase 2 can tighten pruning).
4. Update/remove test `"counts alternate tuning branches toward stat targets"` — replace with test that uncommitted debuff variants produce **verified** totals including exactly one −5 per uncommitted piece.

**Tests (required):**
| Case | Expect |
|------|--------|
| 5× committed pieces, one target, majorCount 5 | Totals = sum(values) + fragments + up to +50 on target |
| Uncommitted piece, 2 debuff variants | Cannot report totals with **both** debuffs at 0 if one variant has −5 |
| 6 active targets, majorCount 5 | Total sum **≤** armor sum + 50 + fragments (not +300 mods) |
| Impossible mins | `resolveLoadoutTotals` → `null`, search returns [] |

**Verify:** Reproduce §2 scenario → no 650+ totals; or zero results if truly impossible.

---

### Phase 2 — Align bounds / slider gray bands

**Goal:** Achievable min/max bars use same mod + tuning rules as search.

**Files:**
- `src/lib/optimizer/bounds.ts`
- `src/lib/optimizer/bounds.test.ts`
- `src/lib/optimizer/use-stat-bounds-for-sliders.ts` (if it passes statOffset)

**Changes:**
1. Thread `assumedStatMods` into bounds functions (same as search).
2. Replace independent-stat max that adds duplicated mod offset with calls to `resolveLoadoutTotals` or a cheaper **`maxAchievableForStat(constraints, exceptStat)`** helper sharing mod/tuning logic.
3. `jointStatBounds` / `computeHeuristicConstrainedStatBounds` should not sum ceilings into displayed bounds without verification.

**Verify:** Gray band max for a stat ≤ verified max from Phase 1 on same pool.

---

### Phase 3 — UI clarity (optional but recommended)

**Goal:** User can sanity-check how totals were computed.

**Files:**
- `src/components/optimizer/optimizer-result-card.tsx`
- Optional: `assumed-stat-mods-panel.tsx` footer

**Changes:**
1. If `solution.modAllocation` / tuning assignments exist, show footnote: e.g. “Includes 5× +10 Weapons, 2× +10 Discipline; assumes +Weapons/−Grenade on helmet (uncommitted).”
2. Consider showing **armor-only subtotal** vs **with mods/fragments** (small text).

**Verify:** Storybook story for `OptimizerResultCard` with resolved metadata; `npm run test-storybook`.

---

## 7. Files reference map

| File | Role |
|------|------|
| `src/lib/inventory/compute-stat-totals.ts` | `getPieceStatValue`, `getPieceStatCeiling` — keep ceiling for pruning only |
| `src/lib/inventory/derive.ts` | Source of `statTotals`, `tuningVariants`, `tuningCommitted` |
| `src/lib/views/tuning-positive-stat.ts` | `tuningPositiveArmorStat()` — predetermined +5 stat |
| `src/lib/optimizer/mod-offset.ts` | Mod budget constants + broken offset helper |
| `src/lib/optimizer/fragment-offset.ts` | Fragment deltas + `addStatOffsets` |
| `src/lib/optimizer/constraints.ts` | `satisfiesConstraints`, `totalsFromPieces` |
| `src/lib/optimizer/search.ts` | Enumeration + **must verify before push** |
| `src/lib/optimizer/bounds.ts` | Slider achievable bands — align in Phase 2 |
| `src/components/dashboard/loadout-optimizer-view.tsx` | Wires offsets, constraints, worker request |
| `src/components/optimizer/optimizer-result-card.tsx` | Displays `solution.totals` |

---

## 8. Acceptance criteria

- [ ] No optimizer result where sum of six stats exceeds **armor sum + total mod budget + fragment net** (document formula in test).
- [ ] Uncommitted pieces: displayed totals reflect **one** debuff variant per piece; never all −5 penalties zero unless pieces truly have no penalty in that branch.
- [ ] Setting major mod count to 5 with N active target stats does **not** add `50 × N` to the build total.
- [ ] Existing exotic lock / set bonus / dedupe behavior unchanged (regression: `search.test.ts`, `bounds.test.ts`, `exotic-lock.test.ts`).
- [ ] `npm run build` and vitest tests for touched files pass.
- [ ] Manual: §2 reproduction no longer shows ~674 totals.

---

## 9. Non-goals (this handoff)

- Set bonus stat effects (still deferred per product handoff).
- Masterwork / artifact / weapon stats.
- Persisted build goals DB.
- Changing 0–200 slider scale.
- Rewriting full joint bounds enumeration for billion-combo vaults (heuristic bounds OK if consistent with verify).

---

## 10. Commands

```bash
npm run lint
npx vitest run src/lib/optimizer/resolve-loadout-totals.test.ts
npx vitest run src/lib/optimizer/search.test.ts src/lib/optimizer/mod-offset.test.ts src/lib/optimizer/bounds.test.ts
npm run build
npm run dev:http   # manual §2 repro
npm run storybook  # Phase 3 stories
```

---

## 11. Suggested first task

**Start Phase 0 + Phase 1:** Fix `computeAssumedModStatOffset` / request shape, implement `resolveLoadoutTotals`, gate `searchLoadouts` on it. That alone fixes the worst user-visible bug (674 totals). Phase 2 can follow in the same PR or a quick follow-up.

Do **not** only clamp display — reject impossible combos at search time so grouped signatures and vault advisor witness sets stay honest.

---

## 12. Context from investigation thread

User confirmed tuning model: **drop determines +5 stat; only −5 target is chosen later.** Prior agent analysis incorrectly described variant choice as affecting boost direction — boost is fixed, debuff varies. Mod duplication bug explains ~250 extra points when six stats have mins > 0 and majorCount = 5 (300 phantom mod points vs 50 real).
