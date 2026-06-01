import { SLOT_ORDER } from "@/lib/bungie/constants";
import { ARMOR_STAT_NAMES, type ArmorStatName, type DerivedArmorPieceJson } from "@/lib/db/types";
import { getPieceStatCeiling } from "@/lib/inventory/compute-stat-totals";
import { estimateOptimizerComboCount } from "@/lib/optimizer/bounds";
import {
  hasStatTargets,
  partialCanReachMins,
  totalsFromPieces,
} from "@/lib/optimizer/constraints";
import { dedupeSlotPieces } from "@/lib/optimizer/dedupe";
import {
  applyExoticLockToSlotGroups,
  countExoticsInPieces,
  DEFAULT_EXOTIC_LOCK,
  exoticAllowedInPartialCombo,
  resolveLockedExoticIdentityKey,
  type ExoticLock,
} from "@/lib/optimizer/exotic-lock";
import { addStatOffsets } from "@/lib/optimizer/fragment-offset";
import {
  DEFAULT_ASSUMED_STAT_MODS,
  type AssumedStatMods,
} from "@/lib/optimizer/mod-offset";
import { resolveLoadoutTotals } from "@/lib/optimizer/resolve-loadout-totals";
import {
  partialCanSatisfySetBonuses,
  satisfiesSetBonuses,
  type SetBonusSelection,
} from "@/lib/optimizer/set-bonus";
import type { StatConstraintRow } from "@/lib/optimizer/types";
import {
  OPTIMIZER_STAT_MAX,
  OPTIMIZER_STAT_MIN,
  clampOptimizerStat,
} from "@/lib/optimizer/stat-range";

function groupPoolBySlot(pool: DerivedArmorPieceJson[]) {
  const bySlot = new Map<
    DerivedArmorPieceJson["slot"],
    DerivedArmorPieceJson[]
  >();
  for (const slot of SLOT_ORDER) {
    bySlot.set(slot, []);
  }
  for (const piece of pool) {
    bySlot.get(piece.slot)?.push(piece);
  }
  return bySlot;
}

function perSlotMaxima(
  bySlot: Map<DerivedArmorPieceJson["slot"], DerivedArmorPieceJson[]>,
): Record<(typeof ARMOR_STAT_NAMES)[number], number> {
  const maxima = Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [stat, 0]),
  ) as Record<(typeof ARMOR_STAT_NAMES)[number], number>;
  for (const slot of SLOT_ORDER) {
    for (const piece of bySlot.get(slot) ?? []) {
      for (const stat of ARMOR_STAT_NAMES) {
        maxima[stat] = Math.max(maxima[stat], getPieceStatCeiling(piece, stat));
      }
    }
  }
  return maxima;
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

  if (
    !hasStatTargets(constraints) &&
    setBonusSelections.length === 0
  ) {
    return {
      count: estimateOptimizerComboCount(pool, exoticLock),
      capped: false,
    };
  }

  const bySlot = groupPoolBySlot(pool);
  const lockedIdentityKey = resolveLockedExoticIdentityKey(exoticLock, pool);
  applyExoticLockToSlotGroups(bySlot, exoticLock, pool);

  for (const slot of SLOT_ORDER) {
    if ((bySlot.get(slot)?.length ?? 0) === 0) {
      return { count: 0, capped: false };
    }
    const { representatives } = dedupeSlotPieces(bySlot.get(slot) ?? []);
    bySlot.set(slot, representatives);
  }

  const perSlotMax = perSlotMaxima(bySlot);
  const slotPieces = SLOT_ORDER.map((slot) => bySlot.get(slot) ?? []);
  const verifyAtLeaves = hasStatTargets(constraints);
  let count = 0;
  let capped = false;

  const zeroTotals = totalsFromPieces([]);
  const startTotals =
    Object.keys(fragmentOffset).length > 0
      ? addStatOffsets(
          zeroTotals,
          fragmentOffset as Record<(typeof ARMOR_STAT_NAMES)[number], number>,
        )
      : zeroTotals;

  const visit = (
    slotIndex: number,
    chosen: DerivedArmorPieceJson[],
    partialTotals: Record<(typeof ARMOR_STAT_NAMES)[number], number>,
  ): void => {
    if (capped) return;

    if (slotIndex >= SLOT_ORDER.length) {
      if (exoticLock.mode === "any" && countExoticsInPieces(chosen) > 1) {
        return;
      }
      if (!satisfiesSetBonuses(chosen, setBonusSelections)) {
        return;
      }
      if (verifyAtLeaves) {
        const resolved = resolveLoadoutTotals(
          chosen,
          constraints,
          fragmentOffset,
          assumedMods,
        );
        if (resolved == null) {
          return;
        }
      }
      count += 1;
      if (cap != null && count >= cap) {
        capped = true;
      }
      return;
    }

    const remaining = SLOT_ORDER.length - slotIndex;
    const remainingSlots = SLOT_ORDER.slice(slotIndex);
    for (const piece of slotPieces[slotIndex] ?? []) {
      if (
        !exoticAllowedInPartialCombo(
          piece,
          chosen,
          exoticLock,
          lockedIdentityKey,
        )
      ) {
        continue;
      }
      const nextTotals = { ...partialTotals };
      for (const stat of ARMOR_STAT_NAMES) {
        nextTotals[stat] += getPieceStatCeiling(piece, stat);
      }
      if (
        !partialCanReachMins(
          nextTotals,
          remaining - 1,
          perSlotMax,
          constraints,
          assumedMods,
        )
      ) {
        continue;
      }
      if (
        !partialCanSatisfySetBonuses(
          [...chosen, piece],
          remainingSlots.slice(1),
          bySlot,
          setBonusSelections,
        )
      ) {
        continue;
      }
      visit(slotIndex + 1, [...chosen, piece], nextTotals);
      if (capped) return;
    }
  };

  visit(0, [], startTotals);
  return { count, capped };
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
  const hi = clampOptimizerStat(
    options.hi ?? OPTIMIZER_STAT_MAX,
  );
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
