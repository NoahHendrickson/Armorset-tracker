# Handoff: D2ArmorPicker build parity (Speaker's Sight reference build)

**Status:** Open — root cause identified; fix not started.  
**Last updated:** 2026-06-03  
**Repo:** `armorset-checklist`  
**Related:**
- [optimizer-gray-band-bounds-handoff.md](./optimizer-gray-band-bounds-handoff.md) — slider gray bands (separate issue, same user)
- [optimizer-stat-calculation-fix-handoff.md](./optimizer-stat-calculation-fix-handoff.md) — `resolveLoadoutTotals` / shared mod pool
- [optimizer-exotic-bounds-bug-handoff.md](./optimizer-exotic-bounds-bug-handoff.md) — exotic lock edge cases

---

## 1. Bug summary (give this to the new agent)

The Optimize tab returns **“no loadouts match your filters”** for stat targets that **D2ArmorPicker (D2AP)** satisfies using the **same five armor instance IDs** from the user's vault.

**This is not a search/missing-armor bug.** All five pieces are present in `inventory_cache`, pass pool filtering, and are not collapsed by dedupe.

**This is a stat-accounting parity bug:** our per-piece `statTotals` (with tuning debuffs baked in) plus our mod/fragment model do not net to the same armor row D2AP uses before applying mods. When D2AP's accounting is fed into our verifier, the build **passes** with 3 major + 2 minor mods.

---

## 2. Reference build (user-provided, 2026-06-03)

### Instance IDs (five-piece loadout)

| Slot      | Instance ID           | Piece           | Set              |
|-----------|------------------------|-----------------|------------------|
| helmet    | `6917530125298828509`  | Speaker's Sight | **Exotic**       |
| arms      | `6917530167771126356`  | Ferropotent     | Ferropotent      |
| chest     | `6917530146665347396`  | Smoke Jumper    | Smoke Jumper     |
| legs      | `6917530160150786116`  | Ferropotent     | Ferropotent      |
| classItem | `6917530147186685296`  | Smoke Jumper    | Smoke Jumper     |

**Set hashes:** Ferropotent `3734029045`, Smoke Jumper `2751989785` (2pc each).

**Exotic:** Speaker's Sight (`itemHash` 50291571), artifice helmet.

### D2AP targets (all six pinned — from screenshot)

| Stat    | Min |
|---------|-----|
| Weapons | 200 |
| Health  | 13  |
| Class   | 42  |
| Grenade | 104 |
| Melee   | 19  |
| Super   | 101 |

### D2AP mod assumption

- **3 major** (+10 each) → +30 to Weapons  
- **2 minor** (+5 each) → +10 to Weapons  
- **1 artifice** (+3) → +3 to Class (Speaker's Sight artifice socket)  
- Strategy label in D2AP: **“Many mods, low cost (slow)”**

Our app models 3+2 via `AssumedStatMods`: `{ majorCount: 3, slotFill: true, artifice: true }` → +40 major/minor budget + optional +3 artifice. **That model is correct** when inputs match D2AP.

### D2AP per-piece display stats (screenshot)

| Piece            | W   | H  | G  | S  | C  | M  |
|------------------|-----|----|----|----|----|----|
| Speaker's Sight  | 25  | 8  | 4  | 31 | 4  | 4  |
| Ferropotent arms | 30  | 5  | 25 | 20 | 5  | 5  |
| Smoke Jumper chest | 30 | 5  | 25 | 20 | 5  | 5  |
| Ferropotent legs | 30  | 5  | 25 | 20 | 5  | 5  |
| Smoke Jumper bond | 30 | 5  | 25 | 5  | 20 | 5  |

**Raw piece sum:** W145 · H28 · G104 · S96 · C39 · M24

### D2AP “Tuning” row (separate from stat mods — screenshot)

| Stat    | Tuning |
|---------|--------|
| Weapons | +15    |
| Health  | −15    |
| Melee   | −5     |
| Super   | +5     |

This row is **not** subclass fragments. It is how D2AP aggregates armor **tuning mod** effects after showing positive per-piece stats.

### D2AP final totals (screenshot)

`Weapons 200 · Health 13 · Class 42 · Grenade 104 · Melee 19 · Super 101`

**How Super 101 works:** armor Super **96** + tuning **+5** = **101** (no major/minor mods on Super).  
**How Grenade 104 works:** pure armor sum (no mods).  
**How Weapons 200 works:** armor ~145 + mods +40 + tuning +15 = 200.  
**How Class 42 works:** armor 39 + artifice +3 = 42.

---

## 3. What we store vs what D2AP shows

### Our cached `statTotals` (same instance IDs, 2026-06-03 verify run)

| Piece   | Our cache `statTotals` |
|---------|-------------------------|
| Helmet  | W25, H8, **G12**, S31, M4 (no Class) |
| Arms    | W**35**, G25, S20, M**−5** (+Weapons tuning committed) |
| Chest   | W30, G25, S25, H**−5** (+Super tuning) |
| Legs    | W**35**, G25, S20, H**−5** (+Weapons tuning) |
| Bond    | W**35**, G25, C20, H**−5** (+Weapons tuning) |

**Our armor sum:** W160 · H**−7** · G112 · S96 · C20 · M**−1**

### Side-by-side armor sums

| Stat    | Our cache | D2AP display sum | D2AP “Total Armor” row (screenshot) |
|---------|-----------|------------------|-------------------------------------|
| Weapons | 160       | 145              | 143                                 |
| Health  | **−7**    | 28               | 6                                   |
| Class   | 20        | 39               | 22                                  |
| Grenade | 112       | 104              | 102                                 |
| Melee   | **−1**    | 24               | 2                                   |
| Super   | 96        | 96               | 89                                  |

Super matches. Health/Melee/Class are badly wrong on our side because **tuning debuffs are embedded in `statTotals`** (`Melee: −5`, `Health: −5`) while D2AP shows **positive per-piece stats** and applies net tuning in a **separate row**.

### Exotic stat note (do not chase the wrong bug)

- User's Speaker's Sight roll correctly has **Weapons 25** (matches D2AP).  
- An earlier investigation conflated this with a **different** instance (`6917530125283917710`, Weapons 31). Do not “fix” Weapons 25 on this roll.  
- **Grenade** may still be wrong: cache **12** vs D2AP **4** on the exotic.

---

## 4. Proof: our engine works when inputs match D2AP

Script: `scripts/diagnose-d2ap-parity.ts`

```bash
npx tsx --tsconfig tsconfig.json scripts/diagnose-d2ap-parity.ts
```

**Results (2026-06-03):**

| Scenario | `verifyLoadout` |
|----------|-----------------|
| Our cached stats, 3+2 mods, D2AP six targets | **FAIL** |
| Our cached stats + D2AP tuning row as `fragmentOffset` | **FAIL** (Health/Melee still too low) |
| D2AP display stats, 3+2 mods, no tuning row | **FAIL** |
| **D2AP display stats + tuning row + 3+2 mods** | **PASS** → 200/13/42/104/19/101 |

Passing mod allocation: `{ Class: 3 (artifice), Weapons: 40 }`.

**Conclusion:** Search/verify logic is fine. **Stat representation** is wrong.

---

## 5. Root-cause analysis

### RC1 — Tuning debuffs baked into `statTotals` (primary)

`derive.ts` stores **committed tuning** as final per-piece maps, e.g. Ferropotent arms `{ Weapons: 35, Melee: −5 }` for +Weapons/−Melee tuning.

D2AP UI shows `{ Weapons: 30, Melee: 5, … }` per piece, then a global **Tuning** row `{ Melee: −5, … }`.

Both can be equivalent for **one piece**, but summing five pieces with embedded negatives puts Health/Melee/Class in a hole that **+40 mod budget cannot fix** while also hitting Weapons 200.

**Files:** `src/lib/inventory/derive.ts`, `src/lib/inventory/compute-stat-totals.ts`

### RC2 — Missing armor “tuning row” in optimizer totals (primary)

D2AP applies net tuning **after** the armor subtotal, before/alongside stat mods:

- Weapons +15, Super +5, Health −15, Melee −5 (for this build)

We only have:

- Per-piece `statTotals` (RC1)  
- Subclass **fragment** offsets (`fragment-offset.ts`)  
- Assumed stat mods (`resolve-loadout-totals.ts`)

We do **not** model D2AP's separate tuning aggregation row.

**Files:** `src/lib/optimizer/resolve-loadout-totals.ts`, `src/lib/optimizer/verify-loadout.ts`

### RC3 — Exotic Grenade mismatch (secondary)

Cache Grenade **12** vs D2AP **4** on Speaker's Sight. Does not block Grenade 104 target but indicates derive/plug-walk vs display divergence on exotics.

**Do not** blindly prefer Bungie ItemStats (304) for all exotics — that was validated against a **different** Speaker's Sight instance and would break this roll's Weapons 25.

### RC4 — UI target mismatch (user confusion, not core bug)

User tested roughly `200 / 41 / 100 / 5 / 100` in our app. D2AP screenshot pins **six** stats including Health 13, Melee 19, Grenade 104, Super 101. Compare like-for-like when validating.

### RC5 — Search ranking (non-issue for “not found”)

With D2AP-like 3-stat targets + 5 majors, vault search **does** find builds in ~14s but may return **different legendaries** (same Speaker's Sight helmet). Not why this exact build fails — verify rejects it first.

### Explicitly NOT the cause

| Ruled out | Evidence |
|-----------|----------|
| Missing instance IDs | All 5 in cache; `missingIds: []` in verify script |
| Dedupe dropping pieces | 5 reps in 5-piece pool (`diagnose-d2ap-five-piece.ts`) |
| 3 major + 2 minor unsupported | Parity script passes with D2AP stats + tuning row |
| Wrong Weapons 25 on exotic | Matches D2AP screenshot |

---

## 6. Reproduction

### UI

1. Sign in → `/dashboard` → **Optimize** → Warlock.  
2. Lock **Speaker's Sight** (`6917530125298828509`).  
3. Select **Ferropotent 2pc + Smoke Jumper 2pc** set bonuses.  
4. Set stat mins to D2AP screenshot values (§2).  
5. Assumed mods: **3 major** (minors auto-fill on remaining 2 pieces).  
6. **Actual:** “no loadouts match your filters”.  
7. **Expected (D2AP parity):** at least one build; exact five IDs should verify.

### Headless — quick parity check (no Supabase)

```bash
npx tsx --tsconfig tsconfig.json scripts/diagnose-d2ap-parity.ts
```

### Headless — cache + vault (needs `.env.local`)

```bash
NODE_OPTIONS='--require ./scripts/stub-server-only.cjs' \
npx tsx --tsconfig tsconfig.json scripts/verify-dim-loadout.ts \
  6917530125298828509 \
  6917530167771126356 \
  6917530146665347396 \
  6917530160150786116 \
  6917530147186685296
```

Also:

```bash
NODE_OPTIONS='--require ./scripts/stub-server-only.cjs' \
npx tsx --tsconfig tsconfig.json scripts/diagnose-d2ap-five-piece.ts

NODE_OPTIONS='--require ./scripts/stub-server-only.cjs' \
npx tsx --tsconfig tsconfig.json scripts/diagnose-d2ap-vault.ts
```

(`diagnose-d2ap-vault.ts` vault search ~15–30s.)

### Unit tests (existing)

```bash
npx vitest run src/lib/optimizer/user-build-d2armorpicker-ids.test.ts
```

Note: test file still documents an older ItemStats hypothesis — update after fix.

---

## 7. Code map

| Layer | File | Role |
|-------|------|------|
| Derive | `src/lib/inventory/derive.ts` | Builds `statTotals` from plugs + tuning; embeds debuffs |
| Exotic stats | `src/lib/inventory/instance-armor-stats.ts` | ItemStats (304) override for exotics — use carefully |
| Piece totals | `src/lib/inventory/compute-stat-totals.ts` | `buildStatTotals`, `getPieceStatValue` |
| Mod budget | `src/lib/optimizer/mod-offset.ts` | 3 major + 2 minor = +40; artifice +3 separate |
| Verify | `src/lib/optimizer/resolve-loadout-totals.ts` | Tuning branches + `allocateAssumedMods` |
| Verify CLI | `src/lib/optimizer/verify-loadout.ts` | Human-readable reject reasons |
| Search | `src/lib/optimizer/search.ts` | Early exit via `estimateFilteredComboCount` |
| Fragments | `src/lib/optimizer/fragment-offset.ts` | Subclass fragments only — not armor tuning row |
| UI | `src/components/dashboard/loadout-optimizer-view.tsx` | Targets, set bonuses, assumed mods, exotic lock |
| Diagnostics | `scripts/diagnose-d2ap-parity.ts` | **Start here** — proves pass/fail matrix |
| Diagnostics | `scripts/diagnose-d2ap-five-piece.ts` | 5-piece only, mod/target matrix |
| Diagnostics | `scripts/diagnose-d2ap-vault.ts` | Full vault search vs known IDs |

---

## 8. Domain rules (do not re-litigate)

### 8.1 Mod budget (already correct)

- 5 armor pieces → up to 5 mod sockets.  
- `majorCount: 3, slotFill: true` → 3×+10 + 2×+5 = **+40** shared pool toward active stat mins.  
- Artifice +3 is **separate** (does not consume a major/minor slot).  
- Allocator: `allocateAssumedMods` in `resolve-loadout-totals.ts`.

### 8.2 D2AP “Tuning” row vs our model

- **D2AP:** positive per-piece display → **Total Armor** row → **Tuning** row → **Mods** row → **Total**.  
- **Us:** single `statTotals` per piece (includes committed +/− tuning) → fragments → mods.  
- Parity requires **same net armor row before mods**, not necessarily same UI breakdown.

### 8.3 Set bonuses

We enforce piece counts only (`set-bonus.ts`). D2AP stat totals in the screenshot do **not** include set perk stat bonuses — do not add set perk stats unless user confirms D2AP does for this case.

### 8.4 Stat scale

UI uses raw Armor 3.0 points on 0–200 sliders (`OPTIMIZER_STAT_MAX`). Weapons 200 is intentional.

---

## 9. Implementation plan

### Phase 0 — Baseline & tests (P0, ~2h)

**Goal:** Lock reproducible pass/fail before changing derive.

1. Read `scripts/diagnose-d2ap-parity.ts` output; confirm PASS/FAIL matrix matches §4.  
2. Add vitest test `user-build-speakers-sight-d2ap-parity.test.ts` (or extend `user-build-d2armorpicker-ids.test.ts`):
   - **FAIL** with our cached stat fixture + D2AP targets + 3+2 mods.  
   - **PASS** with D2AP display stats + `D2AP_TUNING_ROW` + 3+2 mods → exact totals 200/13/42/104/19/101.  
3. Document D2AP tuning row constants in test file (from screenshot).

**Verify:** `npx vitest run src/lib/optimizer/user-build-*d2ap*`

---

### Phase 1 — Understand D2AP tuning row source (P0, ~4h)

**Goal:** Explain `{ W+15, S+5, H−15, M−5 }` from first principles.

1. For each legendary in the reference build, read committed `tuningName` and manifest `tuningPlugStats`.  
2. Confirm whether D2AP “Total Armor” row = sum(display stats) + per-piece tuning effects, or display stats already net of debuffs.  
3. Trace one Ferropotent piece in `derive.ts`: compare plug walk vs what D2AP shows (W30 vs our W35).  
4. Decide canonical representation:
   - **Option A:** Store `baseStatTotals` + `tuningDeltas` separately on each piece; optimizer sums base then applies tuning row.  
   - **Option B:** Keep one `statTotals` but add optimizer step that reconstructs D2AP-style armor row (net same math).  
   - **Option C:** Store D2AP-equivalent display stats at derive time; apply tuning in `resolveLoadoutTotals`.

**Deliverable:** Short comment in derive or optimizer docstring stating chosen model.

**Verify:** Parity test from Phase 0 passes using **derived** stats (not hardcoded D2AP fixture).

---

### Phase 2 — Fix exotic Grenade on Speaker's Sight (P1, ~2h)

**Goal:** Helmet `statTotals.Grenade` = 4 for instance `6917530125298828509`.

1. Inspect raw profile sockets + ItemStats for this instance (debug route or verify script extension).  
2. Fix derive only if plug-walk genuinely wrong — **do not** swap in ItemStats from a different instance.  
3. Add regression test for this instance ID.

**Verify:** `verify-dim-loadout.ts` piece row shows `Grenade: 4` on helmet.

---

### Phase 3 — Optimizer totals parity (P0, ~1–2d)

**Goal:** `verifyLoadout` passes for cached inventory IDs + D2AP targets + 3+2 mods.

1. Implement chosen model from Phase 1 in `resolveLoadoutTotals` / `totalsFromPieces` path used by search.  
2. Ensure artifice can land on Class (+3) when Super needs tuning not mods (matches D2AP allocation).  
3. Re-run `diagnose-d2ap-vault.ts`: vault search should include exact five IDs in top N for D2AP targets.  
4. UI smoke: Optimize tab with six D2AP targets → builds returned.

**Verify:**

```bash
npx tsx scripts/diagnose-d2ap-parity.ts          # PASS cached path
NODE_OPTIONS='...' npx tsx scripts/diagnose-d2ap-vault.ts  # ≥1 solution uses all 5 IDs
```

---

### Phase 4 — UI / UX alignment (P2, optional)

1. Compare assumed-mod panel copy with D2AP “3 major 2 minor” labeling.  
2. Consider showing net armor row + mod breakdown in `OptimizerResultCard` (D2AP-style) for debugging.  
3. Align gray-band bounds with new totals ([gray-band handoff](./optimizer-gray-band-bounds-handoff.md)).

---

## 10. Acceptance criteria

- [ ] `verifyLoadout` **PASS** on instance IDs in §2 with D2AP six targets and `{ majorCount: 3, slotFill: true, artifice: true }`.  
- [ ] Resolved totals match D2AP screenshot: **200 / 13 / 42 / 104 / 19 / 101** (±0).  
- [ ] `searchLoadouts` on user's Warlock vault (Speaker's Sight locked, set bonuses selected) returns ≥1 solution including all five IDs.  
- [ ] Parity vitest tests green.  
- [ ] No regression: Boots of the Assembler reference build in [gray-band handoff §3](./optimizer-gray-band-bounds-handoff.md) still verifies.

---

## 11. Pitfalls for the next agent

1. **Do not “fix” Weapons 25** on instance `6917530125298828509` — D2AP confirms it.  
2. **Do not compare 3-stat targets** when user pinned **six** stats in D2AP.  
3. **`fragmentOffset` is not the long-term home** for armor tuning row — subclass fragments are a different system; parity test used it only as a hack.  
4. **Default 5 majors in UI** vs user's D2AP 3 majors — always set `majorCount: 3` when reproducing this bug.  
5. **`estimateFilteredComboCount` returning 0** on 116M combos is expected when verify finds zero feasible loadouts — fix stats first, not search pruning.  
6. Two reference builds exist in docs: **Speaker's Sight helmet** (this doc) vs **Boots of the Assembler legs** (gray-band handoff) — do not mix instance IDs.

---

## 12. Open questions

1. Does D2AP “Tuning” row include **only armor tuning mods**, or also **masterwork** (+2×6)? Screenshot “Total base stats: 64” vs current 76 suggests MW is in piece display.  
2. Should we store `baseStatTotals` on `DerivedArmorPieceJson` (schema/cache migration)?  
3. Does “Many mods, low cost” in D2AP change mod assignment beyond 3+2+artifice?

---

## 13. Quick prompt for a new agent

```
Read docs/optimizer-d2armorpicker-parity-handoff.md.

Bug: D2ArmorPicker finds a build with instance IDs
6917530125298828509, 6917530167771126356, 6917530146665347396,
6917530160150786116, 6917530147186685296 at Weapons 200 / Health 13 /
Class 42 / Grenade 104 / Melee 19 / Super 101 with 3 major + 2 minor
mods. Our optimizer rejects it — pieces are in cache; stat accounting
doesn't match D2AP (tuning debuffs baked into statTotals; missing tuning
row). Run scripts/diagnose-d2ap-parity.ts first. Implement Phase 1–3.
Do not change Weapons 25 on the exotic. Acceptance: verifyLoadout PASS
+ vault search returns this five-piece set.
```
