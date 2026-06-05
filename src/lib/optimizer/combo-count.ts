import { SLOT_ORDER } from "@/lib/bungie/constants";
import {
  ARMOR_STAT_NAMES,
  type ArmorStatName,
  type DerivedArmorPieceJson,
} from "@/lib/db/types";
import { dedupeSlotPieces } from "@/lib/optimizer/dedupe";
import { enumerateLoadouts } from "@/lib/optimizer/enumeration/enumerate-loadouts";
import {
  groupPoolBySlot,
} from "@/lib/optimizer/enumeration/pool-by-slot";
import { prepareDedupedSlotPool } from "@/lib/optimizer/enumeration/prepare-slot-pool";
import {
  hasStatTargets,
  otherActiveStatConstraints,
  totalsFromPieces,
} from "@/lib/optimizer/constraints";
import {
  applyExoticLockToSlotGroups,
  DEFAULT_EXOTIC_LOCK,
  type ExoticLock,
} from "@/lib/optimizer/exotic-lock";
import { addStatOffsets } from "@/lib/optimizer/fragment-offset";
import {
  FEASIBILITY_PROBE_VISIT_CAP,
  SYNC_UI_ENUMERATION_COMBO_LIMIT,
} from "@/lib/optimizer/constants";
import {
  DEFAULT_ASSUMED_STAT_MODS,
  type AssumedStatMods,
} from "@/lib/optimizer/mod-offset";
import { resolveLoadoutStatExtremum, resolveLoadoutTotals } from "@/lib/optimizer/resolve-loadout-totals";
import {
  satisfiesSetBonuses,
  type SetBonusSelection,
} from "@/lib/optimizer/set-bonus";
import type { StatConstraintRow } from "@/lib/optimizer/types";
import {
  OPTIMIZER_STAT_MAX,
  OPTIMIZER_STAT_MIN,
  clampOptimizerStat,
} from "@/lib/optimizer/stat-range";

function dedupedRepresentativeCount(pieces: DerivedArmorPieceJson[]): number {
  if (pieces.length === 0) return 0;
  return dedupeSlotPieces(pieces).representatives.length;
}

function productSlotCounts(
  slotPieces: Map<
    DerivedArmorPieceJson["slot"],
    DerivedArmorPieceJson[]
  >,
): number {
  let product = 1;
  for (const slot of SLOT_ORDER) {
    const count = dedupedRepresentativeCount(slotPieces.get(slot) ?? []);
    if (count === 0) return 0;
    product *= count;
  }
  return product;
}

/**
 * Deduped five-slot combination count (same shaping as search / joint bounds).
 * Respects exotic lock rules: none = no exotics, locked = one pinned exotic,
 * any = at most one exotic anywhere in the loadout (not one per slot).
 */
export function estimateOptimizerComboCount(
  pool: DerivedArmorPieceJson[],
  exoticLock: ExoticLock = DEFAULT_EXOTIC_LOCK,
): number {
  const bySlot = groupPoolBySlot(pool);

  if (exoticLock.mode === "none" || exoticLock.mode === "locked") {
    applyExoticLockToSlotGroups(bySlot, exoticLock, pool);
    return productSlotCounts(bySlot);
  }

  const legendariesBySlot = new Map<
    DerivedArmorPieceJson["slot"],
    DerivedArmorPieceJson[]
  >();
  for (const slot of SLOT_ORDER) {
    legendariesBySlot.set(
      slot,
      (bySlot.get(slot) ?? []).filter((piece) => !piece.isExotic),
    );
  }

  let total = productSlotCounts(legendariesBySlot);

  for (const exoticSlot of SLOT_ORDER) {
    const exotics = (bySlot.get(exoticSlot) ?? []).filter((piece) => piece.isExotic);
    const exoticCount = dedupedRepresentativeCount(exotics);
    if (exoticCount === 0) continue;

    let otherProduct = 1;
    for (const slot of SLOT_ORDER) {
      if (slot === exoticSlot) continue;
      const count = dedupedRepresentativeCount(
        legendariesBySlot.get(slot) ?? [],
      );
      if (count === 0) return total;
      otherProduct *= count;
    }
    total += exoticCount * otherProduct;
  }

  return total;
}

export type FilteredComboCountOptions = {
  constraints?: StatConstraintRow[];
  setBonusSelections?: SetBonusSelection[];
  statOffset?: Partial<Record<(typeof ARMOR_STAT_NAMES)[number], number>>;
  assumedMods?: AssumedStatMods;
  /** Stop counting once this many feasible loadouts are found. */
  cap?: number;
  /** Stop after this many DFS branch visits (large-vault feasibility probes). */
  visitCap?: number;
};

export type FilteredComboCountResult = {
  count: number;
  /** True when enumeration stopped early because `cap` was reached. */
  capped: boolean;
};

/**
 * Feasible five-piece loadout count after dedupe, exotic lock, set bonus, and
 * stat-target pruning (verified at leaves when stat targets are active).
 * Without filters, matches `estimateOptimizerComboCount`.
 */
export function estimateFilteredComboCount(
  pool: DerivedArmorPieceJson[],
  exoticLock: ExoticLock = DEFAULT_EXOTIC_LOCK,
  options: FilteredComboCountOptions = {},
): FilteredComboCountResult {
  const constraints = options.constraints ?? [];
  const setBonusSelections = options.setBonusSelections ?? [];
  const assumedMods = options.assumedMods ?? DEFAULT_ASSUMED_STAT_MODS;
  const fragmentOffset = options.statOffset ?? {};
  const cap = options.cap;
  const visitCap = options.visitCap;

  if (!hasStatTargets(constraints) && setBonusSelections.length === 0) {
    return {
      count: estimateOptimizerComboCount(pool, exoticLock),
      capped: false,
    };
  }

  const prepared = prepareDedupedSlotPool({ pool, exoticLock });
  if (prepared == null) {
    return { count: 0, capped: false };
  }

  const verifyAtLeaves = hasStatTargets(constraints);
  const zeroTotals = totalsFromPieces([]);
  const startTotals =
    Object.keys(fragmentOffset).length > 0
      ? addStatOffsets(
          zeroTotals,
          fragmentOffset as Record<(typeof ARMOR_STAT_NAMES)[number], number>,
        )
      : zeroTotals;

  const { leafCount, capped } = enumerateLoadouts({
    prepared,
    exoticLock,
    startTotals,
    constraints,
    assumedMods,
    setBonusSelections,
    cap,
    visitCap,
    onLeaf: (chosen) => {
      if (!satisfiesSetBonuses(chosen, setBonusSelections)) {
        return "reject";
      }
      if (verifyAtLeaves) {
        const resolved = resolveLoadoutTotals(
          chosen,
          constraints,
          fragmentOffset,
          assumedMods,
        );
        if (resolved == null) {
          return "reject";
        }
      }
      return "accept";
    },
  });

  return { count: leafCount, capped };
}

export type StatTargetFeasibilityOptions = Omit<
  FilteredComboCountOptions,
  "constraints" | "cap"
> & {
  /** Upper bound for the binary search (defaults to 200). */
  hi?: number;
  /** Per-probe DFS visit budget (defaults to FEASIBILITY_PROBE_VISIT_CAP). */
  feasibilityVisitCap?: number;
};

function constraintsWithStatMin(
  constraints: StatConstraintRow[],
  focusStat: ArmorStatName,
  min: number,
): StatConstraintRow[] {
  const clamped = clampOptimizerStat(min);
  return constraints.map((row) =>
    row.stat === focusStat ? { ...row, min: clamped } : row,
  );
}

/**
 * Highest verified raw total on `focusStat` among loadouts that meet active
 * targets on other stats. Assumed mods allocate only to those active stats —
 * not to the focus stat (D2ArmorPicker gray-band parity).
 */
export function maxAchievableUntargetedStat(
  pool: DerivedArmorPieceJson[],
  exoticLock: ExoticLock = DEFAULT_EXOTIC_LOCK,
  constraints: StatConstraintRow[],
  focusStat: ArmorStatName,
  options: StatTargetFeasibilityOptions = {},
): number {
  const assumedMods = options.assumedMods ?? DEFAULT_ASSUMED_STAT_MODS;
  const setBonusSelections = options.setBonusSelections ?? [];
  const fragmentOffset = options.statOffset ?? {};
  const otherConstraints = otherActiveStatConstraints(constraints, focusStat);

  const prepared = prepareDedupedSlotPool({ pool, exoticLock });
  if (prepared == null) {
    return OPTIMIZER_STAT_MIN;
  }

  const zeroTotals = totalsFromPieces([]);
  const startTotals =
    Object.keys(fragmentOffset).length > 0
      ? addStatOffsets(
          zeroTotals,
          fragmentOffset as Record<ArmorStatName, number>,
        )
      : zeroTotals;

  let best: number | null = null;
  enumerateLoadouts({
    prepared,
    exoticLock,
    startTotals,
    constraints,
    assumedMods,
    setBonusSelections,
    onLeaf: (chosen) => {
      if (!satisfiesSetBonuses(chosen, setBonusSelections)) {
        return "reject";
      }
      const value = resolveLoadoutStatExtremum(
        chosen,
        otherConstraints,
        fragmentOffset,
        assumedMods,
        focusStat,
        "max",
      );
      if (value == null) {
        return "reject";
      }
      if (best == null || value > best) {
        best = value;
      }
      return "accept";
    },
  });

  return best ?? OPTIMIZER_STAT_MIN;
}

/** Leaf visits when full enumeration is too large for slider gray bands. */
export const UNTARGETED_STAT_BOUNDED_LEAF_CAP = 8_000;

/**
 * Same as `maxAchievableUntargetedStat`, but caps DFS leaf visits for large
 * vaults. Falls back to greedy verified extremum when the cap is hit early.
 */
export function maxAchievableUntargetedStatBounded(
  pool: DerivedArmorPieceJson[],
  exoticLock: ExoticLock = DEFAULT_EXOTIC_LOCK,
  constraints: StatConstraintRow[],
  focusStat: ArmorStatName,
  options: StatTargetFeasibilityOptions = {},
  leafCap: number = UNTARGETED_STAT_BOUNDED_LEAF_CAP,
): number {
  const rawCombo = estimateOptimizerComboCount(pool, exoticLock);
  if (rawCombo <= SYNC_UI_ENUMERATION_COMBO_LIMIT) {
    return maxAchievableUntargetedStat(
      pool,
      exoticLock,
      constraints,
      focusStat,
      options,
    );
  }

  const assumedMods = options.assumedMods ?? DEFAULT_ASSUMED_STAT_MODS;
  const setBonusSelections = options.setBonusSelections ?? [];
  const fragmentOffset = options.statOffset ?? {};
  const otherConstraints = otherActiveStatConstraints(constraints, focusStat);

  const prepared = prepareDedupedSlotPool({ pool, exoticLock });
  if (prepared == null) {
    return OPTIMIZER_STAT_MIN;
  }

  const zeroTotals = totalsFromPieces([]);
  const startTotals =
    Object.keys(fragmentOffset).length > 0
      ? addStatOffsets(
          zeroTotals,
          fragmentOffset as Record<ArmorStatName, number>,
        )
      : zeroTotals;

  let best: number | null = null;
  let leaves = 0;
  enumerateLoadouts({
    prepared,
    exoticLock,
    startTotals,
    constraints,
    assumedMods,
    setBonusSelections,
    onLeaf: (chosen) => {
      if (!satisfiesSetBonuses(chosen, setBonusSelections)) {
        return "reject";
      }
      const value = resolveLoadoutStatExtremum(
        chosen,
        otherConstraints,
        fragmentOffset,
        assumedMods,
        focusStat,
        "max",
      );
      if (value == null) {
        return "reject";
      }
      if (best == null || value > best) {
        best = value;
      }
      leaves += 1;
      if (leaves >= leafCap) {
        return "accept-and-stop";
      }
      return "accept";
    },
  });

  return best ?? OPTIMIZER_STAT_MIN;
}

/**
 * Highest minimum target on `focusStat` that still yields at least one verified
 * loadout (same rules as search). Used to cap slider gray-band maxes for
 * user-targeted stats only — activates the focus stat during mod allocation.
 */
export function maxFeasibleStatTarget(
  pool: DerivedArmorPieceJson[],
  exoticLock: ExoticLock = DEFAULT_EXOTIC_LOCK,
  constraints: StatConstraintRow[],
  focusStat: ArmorStatName,
  options: StatTargetFeasibilityOptions = {},
): number {
  const hi = clampOptimizerStat(options.hi ?? OPTIMIZER_STAT_MAX);
  const feasibilityVisitCap =
    options.feasibilityVisitCap ?? FEASIBILITY_PROBE_VISIT_CAP;
  const feasible = (min: number): boolean =>
    estimateFilteredComboCount(pool, exoticLock, {
      ...options,
      constraints: constraintsWithStatMin(constraints, focusStat, min),
      cap: 1,
      visitCap: feasibilityVisitCap,
    }).count > 0;

  if (!feasible(OPTIMIZER_STAT_MIN)) {
    return OPTIMIZER_STAT_MIN;
  }
  if (feasible(hi)) {
    return hi;
  }

  let lo = OPTIMIZER_STAT_MIN;
  let top = hi;
  while (lo < top) {
    const mid = Math.ceil((lo + top) / 2);
    if (feasible(mid)) {
      lo = mid;
    } else {
      top = mid - 1;
    }
  }
  return lo;
}
