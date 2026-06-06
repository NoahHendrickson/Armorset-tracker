# Handoff: strip slotted stat mods from exotics (optimize from base)

**Status:** Done — implemented in commit `e8d8a9b`; exotic base stats unified in `resolveExoticBaseStatsForOptimizer` (follow-up `cursor/code-quality-followup-92b5`).
**Last updated:** 2026-06-06
**Repo:** `armorset-checklist`
**Related:**
- [optimizer-d2armorpicker-parity-handoff.md](./optimizer-d2armorpicker-parity-handoff.md) — broader D2AP parity (legendary **tuning row**; RC1/RC2). Separate effort; see §"Scope".
- [optimizer-exotic-bounds-bug-handoff.md](./optimizer-exotic-bounds-bug-handoff.md) — exotic budget/bounds history.

---

## 1. Bug summary (give this to the new agent)

For **exotic** armor, the optimizer **double-counts stat mods**. We store each exotic's stats from Bungie **ItemStats (component 304)**, which is the **in-game total with every slotted mod baked in** (general +5/+10, artifice +3, masterwork). The optimizer then layers its **own** assumed mod budget (`allocateAssumedMods`) on top — so a mod that's physically slotted on the piece is counted **twice**.

Correct behavior (matches D2ArmorPicker / DIM): feed the optimizer each piece's **base** stats (drop roll **+ masterwork**), with the **choosable** stat mods (general minor/major + artifice) **stripped**, then let the optimizer allocate its own mod budget.

**Concrete example (user's vault):** Speaker's Sight instance `6917530125298828509` has **base Grenade 4**, with a slotted **artifice +3** and **minor +5** → in-game **Grenade 12**. We cache **12** and treat it as the piece's stat. D2AP shows this piece as **Grenade 4** and applies mods itself. We must do the same.

**This is exotic-only.** Legendaries already derive base stats from intrinsic `armor_stats` plugs and never include general mods (see §3).

---

## 2. Evidence

### 2.1 The optimizer adds an assumed mod budget on top of piece stats
`src/lib/optimizer/resolve-loadout-totals.ts` → `resolveWithTuningChoices` sums `pieceDisplayStatTotals` per piece, applies tuning + fragments, then calls `allocateAssumedMods(...)`, which adds:
- up to 5 general mods: `MAJOR_ARMOR_STAT_MOD` (+10) × `majorCount`, `MINOR_ARMOR_STAT_MOD` (+5) on remaining slots, and
- one `ARTIFICE_ARMOR_STAT_MOD` (+3) (`mod-offset.ts`, `DEFAULT_ASSUMED_STAT_MODS`).

So whatever a piece's `statTotals` already contains, the optimizer assumes the mod sockets are **empty and available**.

### 2.2 Exotic `statTotals` already contains the slotted mods
- `src/lib/inventory/instance-armor-stats.ts` → `instanceArmorStatTotals` reads component 304 verbatim (the modded in-game total).
- `resolveExoticStatTotals` returns the 304-derived value for exotics (legendaries return plug-derived; see §3).
- In `src/lib/inventory/derive.ts`, the exotic socket walk finds **no** `armor_stats` intrinsic plugs (`statPlugs` is empty for exotics → `socket stat plugs: []` in diagnostics), so the exotic falls back to 304.

### 2.3 D2AP reference (from `optimizer-d2armorpicker-parity-handoff.md` §2)
D2AP per-piece display for the same exotic roll: **W25 H8 G4 S31 C4 M4** (base; mods stripped). Our cache for that instance: **W25 H8 G12 S31 …** — the only delta vs D2AP is the slotted Grenade mods (`12 = 4 + 5 + 3`). Note **Weapons 25 is correct** (no weapon mod slotted → nothing to strip). Do **not** "fix" Weapons 25.

### 2.4 User owns 10 Speaker's Sights across two item hashes
Investigated this session. Both are exotic helmets named "Speaker's Sight"; the optimizer dedupes/locks by slot + display name, so all 10 are pool candidates.

| itemHash | count | notes |
|---|---|---|
| `50291571` | 5 | current Armor 3.0 roll shape (all six stats populated) |
| `3617849232` | 5 | older/"Artifice" generation (several rolls have 0s in Class/Melee/Health) |

Full game-visible (304) breakdown captured this session — order W,H,C,G,M,S:

`50291571`: `…963362` 18/8/24/31/8/4 · `…606837` 20/4/17/26/8/9 · `…917710` 31/8/4/16/4/20 · `…828509` 25/8/4/12/4/31 · `…760523` 24/12/4/8/12/28
`3617849232`: `…151741` 29/0/0/20/0/13 · `…258629` 30/0/0/18/0/11 · `…477912` 35/5/5/19/5/11 · `…931877` 35/5/5/19/5/12 · `…927859` 0/0/0/13/20/30

These totals **include slotted mods**; that's exactly what must be stripped to base. (Whether `3617849232` should even be in the pool is a *separate*, parked question — out of scope here.)

---

## 3. Why legendaries are already correct (do not change them)

`src/lib/manifest/derive.ts` → `categorizePlug` classifies a plug as `"stat"` only when its `plugCategoryIdentifier` contains `armor_stats` (the 180 intrinsic archetype plugs: 6 stats × 30 magnitudes). General/minor/major/artifice **mods** have different category identifiers and are **not** in the `statPlugs` lookup. The legendary socket walk (`deriveArmorPiece`) sums only those intrinsic plugs, and `resolveExoticStatTotals` returns plug-derived totals for non-exotics. Therefore legendary `statTotals` = base roll (tuning aside). General mods are never folded in → nothing to strip.

> Note: legendaries have a **separate** parity issue — committed **tuning** (+5/−5) is baked into `statTotals` and D2AP shows it as a separate "tuning row" (RC1/RC2 in the parity handoff). That is **not** this task.

---

## 4. Scope

- **In scope:** exotic armor only. Recover base = `304 − (slotted general/minor/major/artifice stat mods)`, keeping masterwork.
- **Out of scope:** legendary tuning-row parity (separate handoff); deciding whether the legacy `3617849232` Speaker's Sight belongs in the pool; the Armor 3.0 200-stat-cap enforcement bug.

---

## 5. Design decisions (confirmed with the product owner)

1. **Keep masterwork in base** (assume masterworked — matches D2AP/DIM). Implementation: simply do not include masterwork plugs in the stat-mod lookup, so they're never subtracted.
2. **Instance-accurate stripping** — subtract exactly the mods slotted on *that* copy (copies differ), using the instance's socket plug hashes, not a fixed assumption.
3. **Artifice:** the optimizer already assumes one +3 artifice (`DEFAULT_ASSUMED_STAT_MODS.artifice = true`). After stripping the physically-slotted artifice +3, the optimizer re-adds it via its budget — correct, no double count.

---

## 6. Current working-tree state (read before starting)

A prior session left **uncommitted** changes you'll build on:
- `capInflatedExoticGrenade` (a grenade-clamp heuristic) was **removed** — exotic stats now come straight from `resolveExoticStatTotals` (304) with no clamp. Confirm with `grep -rn capInflatedExoticGrenade src/` (should be empty).
- The exotic manifest **budget** is fill-only and must never lower a real roll (`enrichPieceWithExoticBudget` in `src/lib/inventory/exotic-stat-fallback.ts`).

Commit or stash as appropriate before beginning.

---

## 7. Implementation plan

### Phase A — Manifest: build a stat-mod-plug lookup
*Goal:* a derived table mapping each general/artifice **stat-mod** plug hash → its `{stat, value}` contributions. Mirror `tuning_plug_stats` exactly.

**A0 — Discovery (do this first; public manifest, no Bungie token needed).**
Write a throwaway script that downloads `DestinyInventoryItemDefinition` (`getDestinyManifest` + `fetchManifestSlice`) and prints, for every plug with a positive **armor-stat** `investmentStat` (+3/+5/+10) that is **not** already `archetype`/`tuning`/`armor_stats`, the distinct `plug.plugCategoryIdentifier` values. This reveals the exact identifiers for: general armor stat mods, artifice stat mods, **and masterwork** (which you must exclude). Record them in the doc/PR.

**A1 — `categorizePlug` (`src/lib/manifest/derive.ts`).** Add a `"statmod"` branch: a plug whose `plugCategoryIdentifier` matches the general-mod or artifice whitelist from A0 **and** has a non-conditional positive armor-stat `investmentStat`. Explicitly exclude masterwork identifiers and the existing `armor_stats`/`archetype`/`tuning` categories.

**A2 — Derive loop (`deriveManifestData`).** Add a `statModPlugs = new Map<number, Array<{stat,value}>>()` and, in the plug loop, when `category === "statmod"`, push `{stat, value}` for each non-conditional armor-stat `investmentStat` (reuse the same pattern as the `tuningPlugStats` block). Emit `statModPlugStats: Array<{plug_hash, stat, value}>` on `DerivedManifestData` (`src/lib/manifest/types.ts`), mirroring `tuningPlugStats`.

**A3 — Migration `supabase/migrations/0024_armor_stat_mod_plugs.sql`.** Copy `0017_tuning_plug_stats.sql` verbatim with the table renamed:
```sql
create table if not exists public.armor_stat_mod_plugs (
  plug_hash bigint not null,
  stat text not null,
  value integer not null,
  primary key (plug_hash, stat)
);
create index if not exists armor_stat_mod_plugs_stat_idx
  on public.armor_stat_mod_plugs (stat);
alter table public.armor_stat_mod_plugs enable row level security;
```

**A4 — Sync (`src/lib/manifest/sync.ts`).** Add `armor_stat_mod_plugs` to: the table union type, the FK-ordered `delete` block, the `chunkInsert` calls (`chunkInsert(sb, "armor_stat_mod_plugs", derived.statModPlugStats)`), the `countTable` list, and the `SyncResult` counts. Follow every place `tuning_plug_stats` appears.

**A5 — Lookups (`src/lib/manifest/lookups.ts`).** Add `statModPlugStats: Map<number, Array<{stat: ArmorStatName; value: number}>>` to `ManifestLookups`; load it from `sb.from("armor_stat_mod_plugs").select("plug_hash, stat, value")` and fold rows into the Map (copy the `tuningPlugStats` loader at ~L363/L537). Ensure `invalidateManifestLookups()` covers it (it clears the whole cache, so no extra work).

*Verify Phase A:* unit test that a known general mod (+10 / +5) and an artifice mod (+3) map to the correct `{stat,value}`, and that a masterwork plug and an intrinsic `armor_stats` plug are **absent** from the map.

### Phase B — Inventory derive: subtract slotted mods for exotics
**B1 — Helper (`src/lib/inventory/instance-armor-stats.ts`).**
```ts
export function stripSlottedStatMods(
  totals: Partial<Record<ArmorStatName, number>>,
  sockets: Array<{ plugHash?: number }>,
  statModPlugStats: Map<number, Array<{ stat: ArmorStatName; value: number }>>,
): Partial<Record<ArmorStatName, number>> {
  const out = { ...totals };
  for (const socket of sockets) {
    if (!socket.plugHash) continue;
    const deltas = statModPlugStats.get(socket.plugHash);
    if (!deltas) continue;
    for (const { stat, value } of deltas) {
      out[stat] = Math.max(0, (out[stat] ?? 0) - value);
    }
  }
  return out;
}
```

**B2 — Integrate (`src/lib/inventory/derive.ts`, in `deriveArmorPiece`).** Immediately **after** the existing `statTotals = resolveExoticStatTotals(...)` call, add:
```ts
if (isExotic) {
  statTotals = stripSlottedStatMods(statTotals, sockets, lookups.statModPlugStats);
}
```
`sockets` is already in scope (read near the top of the function). Legendaries are untouched.

**B3 — Budget-fill interaction.** The exotic budget-fill fallback (when `statPlugs.length === 0` and a manifest budget exists) and `mergeExoticInstanceStatTotals` run before this. Stripping operates on the final 304-derived totals; when totals came from the budget fallback (no 304 present) there are no slotted mods to subtract, so the strip is a no-op. Add a test for the normal 304 path and one for the no-304 fallback path.

*Verify Phase B:* unit test with a synthetic `ProfileResponse` (sockets = artifice-Grenade +3 plug and minor-Grenade +5 plug; 304 Grenade = 12) → derived base Grenade = 4; Weapons untouched; a stat with no slotted mod unchanged.

### Phase C — Real-instance verification + rollout (needs a reconnected Bungie session)
1. `npm run db:push` to apply `0024`, then trigger a manifest sync (dashboard auto-sync, `POST /api/admin/manifest/sync`, or `npx tsx scripts/sync-manifest.ts`).
2. Reconnect Bungie (the refresh token expired during investigation), then refresh inventory so the cache rewrites with base stats.
3. Confirm on instance `6917530125298828509`: base Grenade = **4**, Weapons = **25**. Spot-check 2–3 other copies from §2.4.
4. Re-run the D2AP parity check (`scripts/verify-dim-loadout.ts` with the five IDs in the parity handoff §6) and confirm the exotic piece row now shows Grenade 4.

---

## 8. Code map

| Layer | File | Role |
|---|---|---|
| Manifest categorize | `src/lib/manifest/derive.ts` → `categorizePlug`, `deriveManifestData` plug loop | add `"statmod"` category + `statModPlugStats` |
| Manifest types | `src/lib/manifest/types.ts` → `DerivedManifestData` | add `statModPlugStats` array |
| Migration | `supabase/migrations/0024_armor_stat_mod_plugs.sql` | new table (mirror `0017`) |
| Sync | `src/lib/manifest/sync.ts` | delete/insert/count for new table |
| Lookups | `src/lib/manifest/lookups.ts` → `ManifestLookups` | load `statModPlugStats` Map |
| Strip helper | `src/lib/inventory/instance-armor-stats.ts` | `stripSlottedStatMods` |
| Derive integrate | `src/lib/inventory/derive.ts` → `deriveArmorPiece` | call strip for exotics |
| Optimizer (unchanged) | `src/lib/optimizer/resolve-loadout-totals.ts`, `mod-offset.ts` | already adds assumed mods — verify only |

---

## 9. Domain rules (do not re-litigate)

- **304 = modded total.** ItemStats (304) is the in-game display total: base + masterwork + slotted mods.
- **Keep masterwork in base.** Strip only choosable general/minor/major + artifice stat mods.
- **Exotic mod slots:** an exotic has at most one general armor-mod slot + (if artifice) one artifice slot, so stripping removes ≤ +13 across one or two stats.
- **Mod budget is correct** (`mod-offset.ts`): 5 pieces → up to 5 general mods (+10/+5) + a separate artifice +3. Do not change it.
- **Legendaries:** base already; do not strip (no general mods in their `statTotals`).

---

## 10. Reproduction / diagnostics

```bash
# Per-instance ItemStats(304) vs derive output — the Phase C verification tool.
# NOTE: calls getProfile → REQUIRES a valid Bungie session (token).
NODE_OPTIONS='--require ./scripts/stub-server-only.cjs' \
  npx tsx --tsconfig tsconfig.json scripts/debug-exotic-itemstats.ts 6917530125298828509

# Full D2AP parity (needs .env.local + a valid Bungie session):
NODE_OPTIONS='--require ./scripts/stub-server-only.cjs' \
  npx tsx --tsconfig tsconfig.json scripts/verify-dim-loadout.ts \
  6917530125298828509 6917530167771126356 6917530146665347396 \
  6917530160150786116 6917530147186685296
```
**Cache-only check (no token):** to inspect what the app currently *stores* without hitting Bungie, write a throwaway script using `getServiceRoleClient()` that selects `inventory_cache.items` for the owner row (match the instance ID, e.g. `6917530125298828509`) and filters pieces by `itemHash` (`50291571` / `3617849232`) or `displayName ~ "speaker"`, printing each piece's `statTotals`.

**Caveat:** during investigation the user's Bungie **refresh token expired** (`ProvidedTokenNotValidRefreshToken`), so any script that calls `getProfile` will fail until they reconnect. Phases A–B are fully verifiable without it (public manifest + synthetic fixtures); Phase C needs the reconnect.

---

## 11. Test plan

- `src/lib/manifest/*` unit test: stat-mod plug map includes general (+10/+5) and artifice (+3); excludes masterwork + intrinsic.
- `src/lib/inventory/instance-armor-stats.test.ts`: `stripSlottedStatMods` subtracts slotted mods, floors at 0, leaves unmodded stats alone.
- `src/lib/inventory/derive.test.ts`: exotic with synthetic sockets/304 → base recovered; legendary unchanged; no-304 fallback path is a no-op.
- Run: `npx vitest run src/lib/manifest src/lib/inventory` and `npm run lint`.
- Pre-existing unrelated failures to ignore: 7 Storybook component tests (clipboard / `useRouter` / `getByText`) fail on the environment regardless of these changes; and `derive.ts` has a pre-existing `prefer-const` warning on `tuningDeltas` (present at `HEAD`).

---

## 12. Risks & pitfalls

1. **Misclassifying plugs** (main risk). Do A0 discovery; whitelist general + artifice; **exclude masterwork**; require a positive armor-stat `investmentStat`. Add tests.
2. **Over-subtraction.** Floor stripped stats at 0; never subtract masterwork.
3. **Do not swap in / strip Weapons 25** on the reference exotic — it's correct (no weapon mod slotted).
4. **Stale cache** until the user refreshes inventory — expected; document it.
5. **Don't chase the legendary tuning row here** — that's the other handoff.
6. **Don't re-add the removed `capInflatedExoticGrenade` heuristic** — exotic grenade values are real per-instance rolls.

---

## 13. Acceptance criteria

- [x] `armor_stat_mod_plugs` table populated after sync; lookup map non-empty.
- [x] Unit tests green for the stat-mod map and `stripSlottedStatMods`.
- [ ] Derived exotic `statTotals` for `6917530125298828509` = base Grenade **4**, Weapons **25** (post re-sync + refresh) — **needs live Bungie session (Phase C)**.
- [x] Legendary `statTotals` unchanged (regression check on any legendary instance).
- [x] `npm run lint` clean (except the documented pre-existing `tuningDeltas` warning).

---

## 14. Open questions

1. Exact `plugCategoryIdentifier` strings for Armor 3.0 general stat mods, artifice mods, and masterwork (resolve in A0).
2. Should the legacy `3617849232` Speaker's Sight be excluded from the optimizer pool? (Separate decision.)
3. After mod-stripping lands, how much of the 121-vs-101 D2AP gap remains? (Re-measure; remainder is likely the legendary tuning-row parity issue.)

---

## 15. Quick prompt for a new agent

```
Read docs/optimizer-exotic-mod-stripping-handoff.md.

Task: the optimizer double-counts stat mods on EXOTIC armor. We store exotic
stats from Bungie ItemStats (304) = in-game total WITH slotted general/minor/
major/artifice mods, then the optimizer adds its own assumed mod budget on top.
Fix: derive exotic BASE stats = 304 − slotted stat mods (KEEP masterwork), so
the optimizer works from base + its own mods. Legendaries already use base
intrinsic plugs — DO NOT change them.

Implement Phases A–B (manifest stat-mod-plug lookup mirroring tuning_plug_stats;
strip slotted mods in deriveArmorPiece for exotics only). Most of it is
verifiable without a Bungie token (public manifest + synthetic fixtures).
Phase C (real-instance check on 6917530125298828509 → Grenade 4) needs the user
to reconnect Bungie. Do NOT re-add capInflatedExoticGrenade. Do NOT touch
Weapons 25 on the exotic. Do NOT tackle the legendary tuning row (separate doc).
```
