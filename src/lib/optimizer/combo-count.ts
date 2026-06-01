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
  totalsFromPieces,
} from "@/lib/optimizer/constraints";
import {
  applyExoticLockToSlotGroups,
  DEFAULT_EXOTIC_LOCK,
  type ExoticLock,
} from "@/lib/optimizer/exotic-lock";
import { addStatOffsets } from "@/lib/optimizer/fragment-offset";
import {
  DEFAULT_ASSUMED_STAT_MODS,
  type AssumedStatMods,
} from "@/lib/optimizer/mod-offset";
import { resolveLoadoutTotals } from "@/lib/optimizer/resolve-loadout-totals";
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
 * Highest minimum target on `focusStat` that still yields at least one verified
 * loadout (same rules as search). Used to cap slider gray-band maxes.
 */
export function maxFeasibleStatTarget(
  pool: DerivedArmorPieceJson[],
  exoticLock: ExoticLock = DEFAULT_EXOTIC_LOCK,
  constraints: StatConstraintRow[],
  focusStat: ArmorStatName,
  options: StatTargetFeasibilityOptions = {},
): number {
  const hi = clampOptimizerStat(options.hi ?? OPTIMIZER_STAT_MAX);
  const feasible = (min: number): boolean =>
    estimateFilteredComboCount(pool, exoticLock, {
      ...options,
      constraints: constraintsWithStatMin(constraints, focusStat, min),
      cap: 1,
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
