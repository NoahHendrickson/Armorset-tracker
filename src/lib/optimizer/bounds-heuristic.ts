import { SLOT_ORDER } from "@/lib/bungie/constants";
import { ARMOR_STAT_NAMES, type ArmorStatName, type DerivedArmorPieceJson } from "@/lib/db/types";
import {
  getPieceStatCeiling,
  getPieceStatValue,
} from "@/lib/inventory/compute-stat-totals";
import {
  otherActiveStatConstraints,
  partialCanReachMins,
  totalsFromPieces,
} from "@/lib/optimizer/constraints";
import { SEARCH_AUTO_RUN_COMBO_LIMIT } from "@/lib/optimizer/constants";
import {
  estimateFilteredComboCount,
  maxFeasibleStatTarget,
} from "@/lib/optimizer/combo-count";
import { prepareDedupedSlotPool } from "@/lib/optimizer/enumeration/prepare-slot-pool";
import { groupPoolBySlot } from "@/lib/optimizer/enumeration/pool-by-slot";
import {
  applyFragmentOffsetToBounds,
  applyModBudgetToBounds,
  independentStatBounds,
} from "@/lib/optimizer/bounds-independent";
import {
  countExoticsInPieces,
  exoticAllowedInPartialCombo,
  DEFAULT_EXOTIC_LOCK,
  type ExoticLock,
} from "@/lib/optimizer/exotic-lock";
import { addStatOffsets } from "@/lib/optimizer/fragment-offset";
import {
  DEFAULT_ASSUMED_STAT_MODS,
  type AssumedStatMods,
} from "@/lib/optimizer/mod-offset";
import { resolveLoadoutStatExtremum } from "@/lib/optimizer/resolve-loadout-totals";
import {
  partialCanSatisfySetBonuses,
  type SetBonusSelection,
} from "@/lib/optimizer/set-bonus";
import type { StatBounds, StatConstraintRow } from "@/lib/optimizer/types";

type PreparedSlotPool = {
  slotPieces: DerivedArmorPieceJson[][];
  perSlotMax: Record<ArmorStatName, number>;
  lockedIdentityKey: string | null;
  startTotals: Record<ArmorStatName, number>;
  assumedMods: AssumedStatMods;
};

function prepareSlotPool(
  pool: DerivedArmorPieceJson[],
  statOffset: Partial<Record<ArmorStatName, number>> | undefined,
  exoticLock: ExoticLock,
  assumedMods: AssumedStatMods = DEFAULT_ASSUMED_STAT_MODS,
): PreparedSlotPool | null {
  const prepared = prepareDedupedSlotPool({ pool, exoticLock });
  if (prepared == null) {
    return null;
  }

  const zeroTotals = totalsFromPieces([]);
  const startTotals =
    statOffset && Object.keys(statOffset).length > 0
      ? addStatOffsets(
          zeroTotals,
          statOffset as Record<ArmorStatName, number>,
        )
      : zeroTotals;

  return {
    slotPieces: prepared.slotPieces,
    perSlotMax: prepared.perSlotMax,
    lockedIdentityKey: prepared.lockedIdentityKey,
    startTotals,
    assumedMods,
  };
}

function totalsAfterPiece(
  partial: Record<ArmorStatName, number>,
  piece: DerivedArmorPieceJson,
  mode: "min" | "max",
): Record<ArmorStatName, number> {
  const next = { ...partial };
  for (const stat of ARMOR_STAT_NAMES) {
    next[stat] +=
      mode === "max"
        ? getPieceStatCeiling(piece, stat)
        : getPieceStatValue(piece, stat);
  }
  return next;
}

function totalsCeilingAfterPiece(
  partial: Record<ArmorStatName, number>,
  piece: DerivedArmorPieceJson,
): Record<ArmorStatName, number> {
  const next = { ...partial };
  for (const stat of ARMOR_STAT_NAMES) {
    next[stat] += getPieceStatCeiling(piece, stat);
  }
  return next;
}

function greedyLoadoutStatExtremum(
  prepared: PreparedSlotPool,
  constraints: StatConstraintRow[],
  exceptStat: ArmorStatName,
  exoticLock: ExoticLock,
  mode: "min" | "max",
  focusStat: ArmorStatName,
  setBonusSelections: SetBonusSelection[] = [],
): number | null {
  const otherConstraints = otherActiveStatConstraints(constraints, exceptStat);
  const slotCandidates = new Map(
    SLOT_ORDER.map((slot, index) => [slot, prepared.slotPieces[index] ?? []]),
  );
  const chosen: DerivedArmorPieceJson[] = [];
  let partial = { ...prepared.startTotals };
  let partialCeiling = { ...prepared.startTotals };

  for (let slotIndex = 0; slotIndex < SLOT_ORDER.length; slotIndex++) {
    const remainingSlots = SLOT_ORDER.slice(slotIndex + 1);
    let bestPiece: DerivedArmorPieceJson | null = null;
    let bestFocus = mode === "max" ? -Infinity : Infinity;

    for (const piece of prepared.slotPieces[slotIndex] ?? []) {
      if (
        !exoticAllowedInPartialCombo(
          piece,
          chosen,
          exoticLock,
          prepared.lockedIdentityKey,
        )
      ) {
        continue;
      }
      const nextCeiling = totalsCeilingAfterPiece(partialCeiling, piece);
      if (
        !partialCanReachMins(
          nextCeiling,
          remainingSlots.length,
          prepared.perSlotMax,
          otherConstraints,
          prepared.assumedMods,
        )
      ) {
        continue;
      }
      if (
        !partialCanSatisfySetBonuses(
          [...chosen, piece],
          remainingSlots,
          slotCandidates,
          setBonusSelections,
        )
      ) {
        continue;
      }

      const focusValue =
        mode === "max"
          ? getPieceStatCeiling(piece, focusStat)
          : getPieceStatValue(piece, focusStat);
      if (mode === "max" ? focusValue > bestFocus : focusValue < bestFocus) {
        bestFocus = focusValue;
        bestPiece = piece;
      }
    }

    if (bestPiece == null) {
      return null;
    }

    chosen.push(bestPiece);
    partial = totalsAfterPiece(partial, bestPiece, mode);
    partialCeiling = totalsCeilingAfterPiece(partialCeiling, bestPiece);
  }

  if (exoticLock.mode === "any" && countExoticsInPieces(chosen) > 1) {
    return null;
  }

  const fragmentOffset = Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [stat, prepared.startTotals[stat] ?? 0]),
  ) as Partial<Record<ArmorStatName, number>>;

  return resolveLoadoutStatExtremum(
    chosen,
    otherConstraints,
    fragmentOffset,
    prepared.assumedMods,
    focusStat,
    mode,
  );
}

/**
 * Fast cross-stat achievable bands (greedy, not exact). Used for slider gray
 * bars on large vaults where joint enumeration is impractical.
 */
export function computeHeuristicConstrainedStatBounds(
  pool: DerivedArmorPieceJson[],
  constraints: StatConstraintRow[],
  statOffset?: Partial<Record<ArmorStatName, number>>,
  exoticLock: ExoticLock = DEFAULT_EXOTIC_LOCK,
  assumedMods: AssumedStatMods = DEFAULT_ASSUMED_STAT_MODS,
  setBonusSelections: SetBonusSelection[] = [],
): StatBounds | null {
  const prepared = prepareSlotPool(pool, statOffset, exoticLock, assumedMods);
  if (prepared == null) {
    return null;
  }

  const bySlot = groupPoolBySlot(pool);
  const independent = independentStatBounds(bySlot, exoticLock);
  if (independent == null) {
    return null;
  }
  const cloned = Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [
      stat,
      { min: independent[stat].min, max: independent[stat].max },
    ]),
  ) as StatBounds;
  let bounds = applyFragmentOffsetToBounds(cloned, statOffset);
  bounds = applyModBudgetToBounds(bounds, assumedMods);
  const independentBounds = Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [
      stat,
      { min: bounds[stat].min, max: bounds[stat].max },
    ]),
  ) as StatBounds;

  for (const stat of ARMOR_STAT_NAMES) {
    const othersActive = otherActiveStatConstraints(constraints, stat);
    const maxVal = greedyLoadoutStatExtremum(
      prepared,
      constraints,
      stat,
      exoticLock,
      "max",
      stat,
      setBonusSelections,
    );
    const minVal = greedyLoadoutStatExtremum(
      prepared,
      constraints,
      stat,
      exoticLock,
      "min",
      stat,
      setBonusSelections,
    );

    let tightenedMax = bounds[stat].max;
    if (maxVal != null) {
      tightenedMax = Math.min(tightenedMax, maxVal);
    }
    if (othersActive.length > 0) {
      const { count: filteredComboCount, capped: filteredComboCapped } =
        estimateFilteredComboCount(pool, exoticLock, {
          constraints,
          setBonusSelections,
          statOffset,
          assumedMods,
          cap: SEARCH_AUTO_RUN_COMBO_LIMIT + 1,
        });
      if (
        !filteredComboCapped &&
        filteredComboCount <= SEARCH_AUTO_RUN_COMBO_LIMIT
      ) {
        tightenedMax = Math.min(
          tightenedMax,
          maxFeasibleStatTarget(pool, exoticLock, constraints, stat, {
            setBonusSelections,
            statOffset,
            assumedMods,
            hi: tightenedMax,
          }),
        );
      }
    }
    bounds[stat].max = tightenedMax;

    if (minVal != null) {
      bounds[stat].min = Math.max(bounds[stat].min, minVal);
    }
    if (bounds[stat].min > bounds[stat].max) {
      const ceiling = maxVal ?? bounds[stat].max;
      const floor = minVal ?? bounds[stat].min;
      bounds[stat] = {
        min: Math.min(floor, ceiling),
        max: Math.max(floor, ceiling),
      };
    }
    if (
      bounds[stat].min === bounds[stat].max &&
      bounds[stat].max > 0 &&
      (maxVal != null || minVal != null)
    ) {
      bounds[stat].min = Math.min(
        independentBounds[stat].min,
        bounds[stat].min,
      );
    }
  }

  return bounds;
}
