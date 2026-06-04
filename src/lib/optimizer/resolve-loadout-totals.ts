import {
  ARMOR_STAT_NAMES,
  type ArmorStatName,
  type DerivedArmorPieceJson,
} from "@/lib/db/types";
import {
  legacyTuningVariantDisplays,
  pieceDisplayStatTotals,
  sumArmorTuningOffset,
  tuningDeltasForPieceBranch,
} from "@/lib/inventory/armor-tuning-stats";
import {
  isActiveStatConstraint,
  maxAllowedStatTotalForRow,
  satisfiesConstraints,
} from "@/lib/optimizer/constraints";
import type { StatConstraintRow } from "@/lib/optimizer/types";
import { addStatOffsets } from "@/lib/optimizer/fragment-offset";
import {
  ARTIFICE_ARMOR_STAT_MOD,
  DEFAULT_ASSUMED_STAT_MODS,
  MAJOR_ARMOR_STAT_MOD,
  MINOR_ARMOR_STAT_MOD,
  totalAssumedModBudget,
  type AssumedStatMods,
} from "@/lib/optimizer/mod-offset";
import type { OptimizerSlotKey } from "@/lib/optimizer/types";
import { SLOT_ORDER } from "@/lib/bungie/constants";

/** One debuff branch for an uncommitted piece — full per-stat map. */
export type TuningAssignment = Partial<Record<ArmorStatName, number>>;

export type ResolvedLoadout = {
  totals: Record<ArmorStatName, number>;
  /** Per slot: which tuning branch was used (undefined = committed statTotals). */
  tuningBySlot?: Partial<Record<OptimizerSlotKey, TuningAssignment>>;
  /** How many mod points (+10 / +5) placed on each stat. */
  modAllocation?: Partial<Record<ArmorStatName, number>>;
};

function zeroTotals(): Record<ArmorStatName, number> {
  return Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [stat, 0]),
  ) as Record<ArmorStatName, number>;
}

function sumStatMaps(
  maps: Partial<Record<ArmorStatName, number>>[],
): Record<ArmorStatName, number> {
  const totals = zeroTotals();
  for (const map of maps) {
    for (const stat of ARMOR_STAT_NAMES) {
      totals[stat] += map[stat] ?? 0;
    }
  }
  return totals;
}

/** Display-stat candidates per piece — debuff branch differs when uncommitted. */
function pieceTuningCandidates(
  piece: DerivedArmorPieceJson,
): Partial<Record<ArmorStatName, number>>[] {
  if (
    piece.tuningCommitted === false &&
    piece.tuningVariants != null &&
    piece.tuningVariants.length > 0
  ) {
    return legacyTuningVariantDisplays(piece);
  }
  return [pieceDisplayStatTotals(piece)];
}

function activeConstraintRows(
  constraints: StatConstraintRow[],
): StatConstraintRow[] {
  return constraints.filter(isActiveStatConstraint);
}

type ModAllocatorState = {
  totals: Record<ArmorStatName, number>;
  modAllocation: Partial<Record<ArmorStatName, number>>;
  majorRemaining: number;
  minorRemaining: number;
};

type StatDeficit = {
  stat: ArmorStatName;
  deficit: number;
};

function activeDeficits(
  totals: Record<ArmorStatName, number>,
  activeRows: StatConstraintRow[],
): StatDeficit[] {
  return activeRows
    .map((row) => ({
      stat: row.stat,
      deficit: row.min - (totals[row.stat] ?? 0),
    }))
    .filter((row) => row.deficit > 0)
    .sort((a, b) => b.deficit - a.deficit);
}

/**
 * Assign finite major (+10) and minor (+5) mod pools toward active minimums.
 * Only stats with active constraints may receive assumed mods.
 */
function allocateAssumedMods(
  armorWithFragments: Record<ArmorStatName, number>,
  constraints: StatConstraintRow[],
  assumedMods: AssumedStatMods,
): ModAllocatorState | null {
  const budget = totalAssumedModBudget(assumedMods);
  const activeRows = activeConstraintRows(constraints);
  const totals = { ...armorWithFragments };
  const modAllocation: Partial<Record<ArmorStatName, number>> = {};
  let majorLeft = budget.majorCount;
  let minorLeft = budget.minorCount;

  if (assumedMods.artifice !== false) {
    for (const row of activeRows) {
      const deficit = row.min - (totals[row.stat] ?? 0);
      if (deficit <= 0 || deficit > ARTIFICE_ARMOR_STAT_MOD) {
        continue;
      }
      const cap = maxAllowedStatTotalForRow(row);
      const current = totals[row.stat] ?? 0;
      if (current + ARTIFICE_ARMOR_STAT_MOD > cap) {
        continue;
      }
      totals[row.stat] = current + ARTIFICE_ARMOR_STAT_MOD;
      modAllocation[row.stat] =
        (modAllocation[row.stat] ?? 0) + ARTIFICE_ARMOR_STAT_MOD;
    }
  }

  while (majorLeft > 0 || minorLeft > 0) {
    const needs = activeDeficits(totals, activeRows);
    if (needs.length === 0) {
      break;
    }

    let placed = false;
    for (const { stat, deficit } of needs) {
      const row = activeRows.find((r) => r.stat === stat);
      if (!row) continue;
      const cap = maxAllowedStatTotalForRow(row);
      const current = totals[stat] ?? 0;
      const canMajor =
        majorLeft > 0 && current + MAJOR_ARMOR_STAT_MOD <= cap;
      const canMinor =
        minorLeft > 0 && current + MINOR_ARMOR_STAT_MOD <= cap;

      const useMinor =
        canMinor &&
        (!canMajor ||
          deficit <= MINOR_ARMOR_STAT_MOD ||
          current + MAJOR_ARMOR_STAT_MOD > cap);
      const useMajor = canMajor && !useMinor;

      if (!useMajor && !useMinor) {
        continue;
      }

      const delta = useMajor ? MAJOR_ARMOR_STAT_MOD : MINOR_ARMOR_STAT_MOD;
      totals[stat] = current + delta;
      modAllocation[stat] = (modAllocation[stat] ?? 0) + delta;
      if (useMajor) {
        majorLeft -= 1;
      } else {
        minorLeft -= 1;
      }
      placed = true;
      break;
    }

    if (!placed) {
      return null;
    }
  }

  if (activeDeficits(totals, activeRows).length > 0) {
    return null;
  }

  return {
    totals,
    modAllocation,
    majorRemaining: majorLeft,
    minorRemaining: minorLeft,
  };
}

function resolveWithTuningChoices(
  pieces: DerivedArmorPieceJson[],
  variantIndices: number[],
  constraints: StatConstraintRow[],
  fragmentOffset: Partial<Record<ArmorStatName, number>>,
  assumedMods: AssumedStatMods,
): ResolvedLoadout | null {
  const branchMaps: Partial<Record<ArmorStatName, number>>[] = [];
  const tuningDeltasList: ReturnType<typeof tuningDeltasForPieceBranch>[] = [];
  const tuningBySlot: Partial<Record<OptimizerSlotKey, TuningAssignment>> = {};

  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i]!;
    const candidates = pieceTuningCandidates(piece);
    const branch = candidates[variantIndices[i]!] ?? candidates[0]!;
    const legacyBranch =
      piece.tuningCommitted === false &&
      piece.tuningVariants != null &&
      piece.tuningVariants.length > 0
        ? piece.tuningVariants[variantIndices[i]!] ?? piece.tuningVariants[0]
        : undefined;
    branchMaps.push(branch);
    tuningDeltasList.push(tuningDeltasForPieceBranch(piece, legacyBranch));
    if (legacyBranch) {
      tuningBySlot[SLOT_ORDER[i]! as OptimizerSlotKey] = legacyBranch;
    }
  }

  const displayTotals = sumStatMaps(branchMaps);
  const armorTuningRow = sumArmorTuningOffset(tuningDeltasList);
  const armorTotals = addStatOffsets(
    displayTotals,
    armorTuningRow as Record<ArmorStatName, number>,
  );
  const withFragments = addStatOffsets(
    armorTotals,
    fragmentOffset as Record<ArmorStatName, number>,
  );

  const allocated = allocateAssumedMods(
    withFragments,
    constraints,
    assumedMods,
  );
  if (allocated == null) {
    return null;
  }

  if (!satisfiesConstraints(allocated.totals, constraints)) {
    return null;
  }

  return {
    totals: allocated.totals,
    ...(Object.keys(tuningBySlot).length > 0 ? { tuningBySlot } : {}),
    ...(Object.keys(allocated.modAllocation).length > 0
      ? { modAllocation: allocated.modAllocation }
      : {}),
  };
}

/**
 * Returns verified loadout totals after picking one tuning branch per piece
 * and allocating the shared assumed-mod pool. Null when no valid assignment
 * satisfies constraints.
 */
export function resolveLoadoutTotals(
  pieces: DerivedArmorPieceJson[],
  constraints: StatConstraintRow[],
  fragmentOffset: Partial<Record<ArmorStatName, number>> = {},
  assumedMods: AssumedStatMods = DEFAULT_ASSUMED_STAT_MODS,
): ResolvedLoadout | null {
  if (pieces.length !== SLOT_ORDER.length) {
    return null;
  }

  const candidateLists = pieces.map(pieceTuningCandidates);

  function visit(
    slotIndex: number,
    variantIndices: number[],
  ): ResolvedLoadout | null {
    if (slotIndex >= pieces.length) {
      return resolveWithTuningChoices(
        pieces,
        variantIndices,
        constraints,
        fragmentOffset,
        assumedMods,
      );
    }

    for (let v = 0; v < candidateLists[slotIndex]!.length; v++) {
      const resolved = visit(slotIndex + 1, [...variantIndices, v]);
      if (resolved != null) {
        return resolved;
      }
    }
    return null;
  }

  return visit(0, []);
}

/**
 * Best verified value for one stat across all tuning branches on a fixed
 * five-piece loadout. Used by slider bounds — honors constraints on other
 * stats only (not the focus stat's own target).
 */
export function resolveLoadoutStatExtremum(
  pieces: DerivedArmorPieceJson[],
  constraints: StatConstraintRow[],
  fragmentOffset: Partial<Record<ArmorStatName, number>> = {},
  assumedMods: AssumedStatMods = DEFAULT_ASSUMED_STAT_MODS,
  focusStat: ArmorStatName,
  mode: "min" | "max",
): number | null {
  if (pieces.length !== SLOT_ORDER.length) {
    return null;
  }

  const candidateLists = pieces.map(pieceTuningCandidates);
  let best: number | null = null;

  function visit(slotIndex: number, variantIndices: number[]): void {
    if (slotIndex >= pieces.length) {
      const resolved = resolveWithTuningChoices(
        pieces,
        variantIndices,
        constraints,
        fragmentOffset,
        assumedMods,
      );
      if (resolved == null) {
        return;
      }
      const value = resolved.totals[focusStat] ?? 0;
      if (best == null) {
        best = value;
      } else if (mode === "max") {
        best = Math.max(best, value);
      } else {
        best = Math.min(best, value);
      }
      return;
    }

    for (let v = 0; v < candidateLists[slotIndex]!.length; v++) {
      visit(slotIndex + 1, [...variantIndices, v]);
    }
  }

  visit(0, []);
  return best;
}

/** Sum of display armor stats (tuning row and mods excluded). */
export function armorStatSumFromPieces(
  pieces: DerivedArmorPieceJson[],
): number {
  let sum = 0;
  for (const piece of pieces) {
    const totals = pieceDisplayStatTotals(piece);
    for (const stat of ARMOR_STAT_NAMES) {
      sum += totals[stat] ?? 0;
    }
  }
  return sum;
}

/** Upper bound sanity check: armor + mod pool + net fragment offset. */
export function maxVerifiedTotalSum(
  pieces: DerivedArmorPieceJson[],
  fragmentOffset: Partial<Record<ArmorStatName, number>>,
  assumedMods: AssumedStatMods,
): number {
  const armorSum = armorStatSumFromPieces(pieces);
  const fragmentNet = ARMOR_STAT_NAMES.reduce(
    (acc, stat) => acc + (fragmentOffset[stat] ?? 0),
    0,
  );
  return armorSum + totalAssumedModBudget(assumedMods).total + fragmentNet;
}
