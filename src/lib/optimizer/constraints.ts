import {
  ARMOR_STAT_NAMES,
  type ArmorStatName,
  type DerivedArmorPieceJson,
} from "@/lib/db/types";
import { getPieceStatValue } from "@/lib/inventory/compute-stat-totals";
import type { StatConstraintRow } from "@/lib/optimizer/types";
import { OPTIMIZER_STAT_MAX, OPTIMIZER_STAT_MIN } from "@/lib/optimizer/stat-range";

export function defaultStatConstraints(): StatConstraintRow[] {
  return ARMOR_STAT_NAMES.map((stat) => ({
    stat,
    min: OPTIMIZER_STAT_MIN,
  }));
}

export function hasStatTargets(constraints: StatConstraintRow[]): boolean {
  return constraints.some((row) => row.min > OPTIMIZER_STAT_MIN);
}

function isActiveConstraint(row: StatConstraintRow): boolean {
  return row.min > OPTIMIZER_STAT_MIN;
}

export function totalsFromPieces(
  pieces: DerivedArmorPieceJson[],
): Record<ArmorStatName, number> {
  const totals = Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [stat, 0]),
  ) as Record<ArmorStatName, number>;
  for (const piece of pieces) {
    for (const stat of ARMOR_STAT_NAMES) {
      totals[stat] += getPieceStatValue(piece, stat);
    }
  }
  return totals;
}

export function satisfiesConstraints(
  totals: Record<ArmorStatName, number>,
  constraints: StatConstraintRow[],
): boolean {
  for (const stat of ARMOR_STAT_NAMES) {
    const value = totals[stat] ?? 0;
    if (value < OPTIMIZER_STAT_MIN) return false;
  }
  for (const row of constraints) {
    if (!isActiveConstraint(row)) continue;
    const value = totals[row.stat] ?? 0;
    if (value < row.min || value > OPTIMIZER_STAT_MAX) return false;
  }
  return true;
}

/** Lower is better — prioritize earlier constraint rows, then minimize waste above mins. */
export function scoreSolution(
  totals: Record<ArmorStatName, number>,
  constraints: StatConstraintRow[],
): number {
  let score = 0;
  for (let i = 0; i < constraints.length; i++) {
    const row = constraints[i]!;
    if (!isActiveConstraint(row)) continue;
    const value = totals[row.stat] ?? 0;
    const waste = Math.max(0, value - row.min);
    score += waste * Math.pow(10, constraints.length - i);
  }
  return score;
}

export function partialCanReachMins(
  partialTotals: Record<ArmorStatName, number>,
  remainingSlots: number,
  perSlotMax: Record<ArmorStatName, number>,
  constraints: StatConstraintRow[],
): boolean {
  for (const row of constraints) {
    if (!isActiveConstraint(row)) continue;
    const maxPossible =
      (partialTotals[row.stat] ?? 0) +
      remainingSlots * (perSlotMax[row.stat] ?? 0);
    if (maxPossible < row.min) return false;
  }
  return true;
}
