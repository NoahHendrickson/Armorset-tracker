# Loadout Optimizer & Vault Cleaning — Agent Handoff

**Status:** Tab shell shipped; core optimizer not started.  
**Last updated:** 2026-05-31  
**Repo:** `armorset-checklist` (Next.js 16, Supabase, Bungie inventory)

---

## 1. Product intent (from stakeholder)

Build a **vault-cleaning loadout optimizer** inspired by [DIM Loadout Optimizer](https://github.com/DestinyItemManager/DIM/wiki/Loadout-Optimizer), adapted for **Destiny 2 Armor 3.0** (six stats: Weapons, Health, Class, Grenade, Melee, Super).

### User story (example)

> “I want 200 Weapons, 100 Grenade, 100 Super, using these 2 armor sets on Warlock.”

The app should find **five-piece armor combinations** from vault + characters that hit those stat targets under filters (class, sets, etc.).

### Hard requirements (differentiators vs DIM)

1. **Multiple stat targets (“build goals”)** — user saves several distributions (e.g. PvE raid build, PvP build).
2. **Functional duplicates** — when the optimizer returns multiple combos with the **same stat totals**, the user can mark pieces as **interchangeable substitutes** (not “dupes to delete”).
3. **Cross-goal shard safety** — before treating pieces as vault clutter, ensure a piece is **not uniquely required** for another saved goal. Deleting must not break a different distribution.

### UX placement (decided)

- **Third dashboard tab** in the header chrome: **Table | Tracker | Optimize** (implemented).
- DIM reference UI: **“Stat Priorities & Ranges”** — per-stat checkbox, min/max inputs, draggable priority order, gray “achievable range” bar, tooltip (“loadouts exist with X–Y in this stat; double-click to set min to max”). Stakeholder provided a screenshot; stats already use Armor 3.0 names (Weapons, Class, etc.).

### Explicit non-goals for v1 (unless stakeholder reverses)

- PRD (`docs/prd-armor-set-checklist.md`) still lists “not a build optimizer” — this feature **supersedes** that for vault cleaning; do not remove tracker/table behavior.
- Weapons, mods, set bonus math — **defer**. Subclass fragments + exotic lock are implemented on the Optimize tab (manifest `subclass_fragment_plugs` + pool/search offset).

---

## 2. What already exists in the codebase

### Shipped in this conversation

| File | What it does |
|------|----------------|
| `src/components/dashboard/workspace-view-mode-tabs.tsx` | `WorkspaceViewMode = "grid" \| "table" \| "optimizer"`; third tab **Optimize** |
| `src/components/dashboard/dashboard-workspace.tsx` | Renders `LoadoutOptimizerView` when `mode === "optimizer"` |
| `src/components/dashboard/loadout-optimizer-view.tsx` | Shell: banners, sync gates, `TrackerFilterBar`, placeholder “Stat priorities” + “Results” panels, filtered pool count |
| `src/components/dashboard/workspace-view-mode-tabs.stories.tsx` | Story `OptimizerSelected` |

**Behavior today:** Optimize tab shares **`useGridFiltersPersistence`** with Table/Tracker (`users.grid_filters` via `PATCH /api/me/workspace`). Same class/set/archetype/tuning/tertiary/search filters narrow the candidate pool.

### Existing domain (reuse, do not reinvent)

| Area | Location | Notes |
|------|----------|--------|
| Inventory derive | `src/lib/inventory/derive.ts` | Reads archetype/tuning plugs + 3 `armor_stats` plugs; stores **stat names only** (`primaryStat`, `secondaryStat`, `tertiaryStat`) — **not numeric totals** |
| Stat plug magnitudes | `armor_stat_plugs` table + `lookups.statPlug` | Manifest maps plug hash → `{ stat, value }` (+30/+25/+20 etc.) |
| Tuning (tracker) | `src/lib/manifest/derive.ts` `extractPositiveStat` | **Positive tuning only** (`+Weapons`); negative side ignored for matching |
| Filters | `src/lib/filters/filter-preset.ts`, `filter-inventory.ts` | Set/archetype/tuning/tertiary hashes + search |
| Saved presets | `saved_filter_views` | Hash dimensions only — **not** stat targets |
| Trackers | `enumerate-trackers.ts`, `GridWorkspace` | `(set × archetype × tuning)` tiles — orthogonal to optimizer |
| Storybook | `*.stories.tsx` next to components | Run `npm run test-storybook` after UI changes; use `armor-checklist-sb-mcp` if Storybook is up — **never guess props** |

### Not found locally

- Full **DestinyItemManager/DIM** clone was not located under `~/Developer` (only `DIM-filterUI`). For algorithm reference, use GitHub DIM wiki + `src/app/loadout/optimizer/` in upstream DIM, or ask stakeholder for clone path.

---

## 3. Architecture (agreed design)

### 3.1 Data model

```ts
// Per-stat row (DIM-like); order in array = priority
type StatConstraintRow = {
  stat: ArmorStatName; // Weapons | Health | Class | Grenade | Melee | Super
  enabled: boolean;
  min: number;
  max: number; // often 200 or “no practical cap”
};

type BuildGoal = {
  id: string;
  userId: string;
  name: string;
  classType: 0 | 1 | 2; // Titan | Hunter | Warlock
  setHashes: number[];
  filterPreset?: FilterPreset; // optional archetype/tuning/tertiary narrowing
  statRows: StatConstraintRow[];
  pinnedInstanceIds?: string[];
  excludedInstanceIds?: string[];
};

type EquivalenceGroup = {
  id: string;
  userId: string;
  slot: ArmorSlot;
  itemInstanceIds: string[];
  note?: string;
};

type OptimizerSolution = {
  slots: Record<ArmorSlot, string>; // itemInstanceId per slot
  totals: Record<ArmorStatName, number>;
  signature: string; // hash for grouping identical stat outcomes
};
```

**Persistence:** New Supabase table(s) — e.g. `build_goals`, `equivalence_groups`. Follow migration rules: **new numbered migration only**, update `src/lib/db/types.ts`.

### 3.2 Per-piece stat vector (prerequisite)

Extend `DerivedArmorPieceJson`:

```ts
statTotals: Partial<Record<ArmorStatName, number>>;
// Optional: tuningVariants when tuningCommitted === false (5+ debuff branches)
```

Compute in `deriveArmorPiece`:

1. Sum three `armor_stats` plug values from `lookups.statPlug`.
2. Apply **both** `+X` and `-Y` from committed tuning plug name (parse manifest plug display name).
3. For uncommitted tuning (`tuningCommitted === false`), either branch search over reusable plugs or default to destined `tuningHash` with UI toggle (stakeholder decision §6).

**Loadout total (v1):** Sum of five pieces’ `statTotals` (armor-only). Document disclaimer in UI if mods/set bonuses omitted.

### 3.3 Search (client Web Worker)

Mirror DIM pattern:

1. Filter pool: class + `filterInventoryPieces` + goal-specific set hashes + pins/excludes.
2. **Bounds pass** (fast): per-stat min/max achievable from pool → powers DIM gray slider + tooltips (no full enumeration).
3. **Full search:** enumerate 5-tuples (helmet, arms, chest, legs, classItem), prune early when partial sums cannot meet mins.
4. Score: satisfy constraints; prioritize stats by row order; minimize waste above mins (DIM-style).
5. Output: top-N solutions + **witness set** per goal (every `itemInstanceId` appearing in ≥1 valid solution).

**Performance:** T5 vaults explode combinatorially; worker + pruning + optional “limit pool” required. DIM wiki: billions of combos possible; target worker parallelism only if needed later.

### 3.4 Vault advisor (cross-goal)

For goals `G1…Gn` and equivalence groups:

| Label | Rule |
|--------|------|
| **Critical for goal G** | Removing piece `p` (and its equivalence group) from the pool yields **zero** solutions for G |
| **Shard-safe** | Not critical for any goal |
| **Shared pressure** | Critical for multiple goals — show all before delete |

Collapse instance IDs through equivalence groups when computing witness sets.

### 3.5 UI map (Optimize tab)

```
┌─────────────────────────────────────────────────────────┐
│ AppHeader: Table | Tracker | Optimize                   │
├─────────────────────────────────────────────────────────┤
│ TrackerFilterBar (class, sets, archetypes, saved views) │
├──────────────────────┬──────────────────────────────────┤
│ Stat priorities panel│ Results (solutions by signature) │
│ (DIM-like controls)  │ + equivalence tagging            │
├──────────────────────┴──────────────────────────────────┤
│ Vault advisor (optional Phase 4): criticality matrix    │
└─────────────────────────────────────────────────────────┘
```

Replace placeholder copy in `loadout-optimizer-view.tsx` with real components under e.g. `src/components/optimizer/`.

---

## 4. Implementation plan (phased)

### Phase 0 — Numeric inventory (blocking)

- [ ] Extend `deriveArmorPiece` to populate `statTotals` (+ tuning +/-).
- [ ] Bump inventory cache schema handling if needed (old rows without field).
- [ ] Unit/fixture tests: known piece → expected `statTotals` (compare in-game or debug route).
- [ ] Verify: `GET /api/debug/inventory` sample shows totals.

**Verify:** `npm run build` passes; manual check one Warlock piece totals.

### Phase 1 — Single-goal optimizer (library + worker)

- [ ] `src/lib/optimizer/` — pool filter, bounds pass, 5-tuple enumeration, constraints.
- [ ] Web Worker entry + message protocol (`run`, `cancel`, `progress`).
- [ ] Wire into `LoadoutOptimizerView` with ephemeral constraints (local state, no DB).
- [ ] Basic results list grouped by `signature`.

**Verify:** Storybook or vitest storybook project with mock inventory fixture from `.storybook/mocks/`.

### Phase 2 — Stat priorities UI (DIM-like)

- [ ] `StatPrioritiesPanel` — 6 rows, checkbox, min/max, reorder (dnd-kit or up/down).
- [ ] Feasible range bar from bounds pass; double-click min = max feasible.
- [ ] “Run optimize” button; loading state on worker.
- [ ] Storybook stories: empty pool, impossible min, feasible tooltip.

**Verify:** `npm run test-storybook` for new stories; axe via Storybook MCP if available.

### Phase 3 — Persisted build goals

- [ ] Migration `build_goals` (+ API `GET/POST/PATCH/DELETE /api/build-goals` or under `/api/me/...`).
- [ ] Goals list UI (sidebar or dropdown); load/save stat rows + set hashes.
- [ ] Separate from `saved_filter_views` — goals are **stat-first**, not hash-only presets.

**Verify:** Goal survives refresh; filters can still come from shared `grid_filters` or goal-local overrides (decide one source of truth).

### Phase 4 — Equivalence groups

- [ ] DB + UI to link interchangeable pieces within a solution signature.
- [ ] Optimizer/advisor treats group as one node.

### Phase 5 — Cross-goal vault advisor

- [ ] Witness sets per goal; criticality computation.
- [ ] UI: “safe to shard” vs “critical for: …” on inventory rows or dedicated panel.

---

## 5. Key files to touch (by phase)

| Phase | Files |
|-------|--------|
| 0 | `src/lib/inventory/derive.ts`, `src/lib/db/types.ts`, possibly cache migration note in API sync |
| 1 | `src/lib/optimizer/*.ts`, `src/lib/optimizer/process-worker.ts` (or `.worker.ts`) |
| 2 | `src/components/optimizer/stat-priorities-panel.tsx`, `loadout-optimizer-view.tsx` |
| 3 | `supabase/migrations/00XX_build_goals.sql`, `src/app/api/...`, `src/lib/db/types.ts` |
| 4–5 | equivalence tables + advisor components |

**Do not edit** existing migration files. Read `AGENTS.md` / `CLAUDE.md` for auth, Bungie, Storybook MCP rules.

---

## 6. Open decisions (ask stakeholder if unclear)

1. **Two sets constraint** — Union of pieces from either set, or mixed-set **set bonus** modeling?
2. **Stat targets** — Point totals (200) vs tiers (20 × 10)? UI screenshot implies **points** to 200.
3. **Uncommitted tuning** — Search all debuff variants vs assume player slots destined tuning?
4. **Mods / masterwork / set bonuses** — v1 armor-only OK?
5. **Exotics** — Shipped: none / any / lock owned instance (one exotic max).
6. **Tab label** — Currently **Optimize**; rename to **Optimizer**?
7. **Mode persistence** — Remember last tab in `localStorage` or URL `?view=optimizer`?
8. **Filter source on Optimize tab** — Continue sharing `grid_filters` only, or per-goal filter snapshot?

---

## 7. DIM reference cheat sheet

| DIM concept | This app |
|-------------|----------|
| Stat min/max sliders | `StatConstraintRow.min/max` |
| Stat disabled (unchecked) | `enabled: false` — excluded from scoring |
| Priority order (drag) | `statRows` array order |
| Achievable range gray bar | Bounds pass on filtered pool |
| Loadout search | 5-slot combo over `DerivedArmorPieceJson[]` |
| Pinned / excluded items | `pinnedInstanceIds` / `excludedInstanceIds` |
| Auto stat mods | Defer |
| Subclass fragments | Shipped (manifest catalog + stat offset) |
| Exotic lock | Shipped |
| Process worker | Client Web Worker in optimizer tab |

Wiki: https://github.com/DestinyItemManager/DIM/wiki/Loadout-Optimizer  
CPU note: https://github.com/DestinyItemManager/DIM/wiki/Why-Loadout-Optimizer-is-slow-or-uses-a-lot-of-CPU

---

## 8. Commands & verification

```bash
npm run dev:http          # http://localhost:3000/dashboard
npm run storybook         # :6066 — MCP at /mcp if testing stories
npm run test-storybook    # after UI stories
npm run lint
npm run build             # tsc + production build
```

No unit test suite for app logic — rely on storybook vitest + manual dashboard testing.

---

## 9. Suggested first task for next agent

**Start Phase 0:** Add `statTotals` to `DerivedArmorPieceJson` and `deriveArmorPiece`, including tuning negative parsing. Then implement bounds pass in `src/lib/optimizer/bounds.ts` and call it from `LoadoutOptimizerView` to validate pool math before full enumeration.

Do **not** re-litigate tab placement — it is done. Replace placeholder sections in `loadout-optimizer-view.tsx` incrementally.

---

## 10. Related docs

- `docs/prd-armor-set-checklist.md` — original checklist scope (optimizer was non-goal)
- `docs/bungie-api-research.md` — socket/plug derivation
- `CLAUDE.md` — architecture, filters, inventory pipeline
