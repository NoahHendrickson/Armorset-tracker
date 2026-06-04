import {
  ARMOR_STAT_NAMES,
  type ArmorStatName,
  type DerivedArmorPieceJson,
} from "@/lib/db/types";
import { getPieceStatValue } from "@/lib/inventory/compute-stat-totals";
import {
  ARTIFICE_ARMOR_STAT_MOD,
  MAJOR_ARMOR_STAT_MOD,
  totalAssumedModBudget,
  type AssumedStatMods,
} from "@/lib/optimizer/mod-offset";
import type { StatConstraintRow } from "@/lib/optimizer/types";
import { OPTIMIZER_STAT_MAX, OPTIMIZER_STAT_MIN } from "@/lib/optimizer/stat-range";

export function defaultStatConstraints(): StatConstraintRow[] {
  return ARMOR_STAT_NAMES.map((stat) => ({
    stat,
    min: OPTIMIZER_STAT_MIN,
  }));
}

export function hasStatTargets(constraints: StatConstraintRow[]): boolean {
  return constraints.some(isActiveStatConstraint);
}

export function statConstraintsEqual(
  a: StatConstraintRow[],
  b: StatConstraintRow[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((row, i) => {
    const other = b[i]!;
    return row.stat === other.stat && row.min === other.min;
  });
}

export function isActiveStatConstraint(row: StatConstraintRow): boolean {
  return row.min > OPTIMIZER_STAT_MIN;
}

/** Per-stat build total cap on the 0–200 track (+ one major mod overshoot). */
export function maxAllowedStatTotal(): number {
  return OPTIMIZER_STAT_MAX + MAJOR_ARMOR_STAT_MOD;
}

/** Upper bound for an active target — tight at 200, looser on lower mins. */
export function maxAllowedStatTotalForRow(row: StatConstraintRow): number {
  if (!isActiveStatConstraint(row)) {
    return Number.POSITIVE_INFINITY;
  }
  if (row.min >= OPTIMIZER_STAT_MAX) {
    return OPTIMIZER_STAT_MAX + MAJOR_ARMOR_STAT_MOD;
  }
  // Still reject corrupted/impossible totals (see satisfiesConstraints test).
  return OPTIMIZER_STAT_MAX + MAJOR_ARMOR_STAT_MOD * 5;
}

/** Active minimum targets on stats other than `exceptStat` (for slider achievable bands). */
export function satisfiesOtherStatConstraints(
  totals: Record<ArmorStatName, number>,
  constraints: StatConstraintRow[],
  exceptStat: ArmorStatName,
): boolean {
  for (const stat of ARMOR_STAT_NAMES) {
    if (displayedStatTotal(totals[stat] ?? 0) < OPTIMIZER_STAT_MIN) {
      return false;
    }
  }
  for (const row of constraints) {
    if (row.stat === exceptStat) continue;
    if (!isActiveStatConstraint(row)) continue;
    const value = totals[row.stat] ?? 0;
    if (value < row.min) return false;
    if (value > maxAllowedStatTotalForRow(row)) return false;
  }
  return true;
}

export function otherActiveStatConstraints(
  constraints: StatConstraintRow[],
  exceptStat: ArmorStatName,
): StatConstraintRow[] {
  return constraints.filter(
    (row) => row.stat !== exceptStat && isActiveStatConstraint(row),
  );
}

/** In-game armor stats floor at 0 (tuning debuffs on unused stats may sum below zero). */
export function displayedStatTotal(value: number): number {
  return Math.max(OPTIMIZER_STAT_MIN, value);
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
    if (displayedStatTotal(totals[stat] ?? 0) < OPTIMIZER_STAT_MIN) {
      return false;
    }
  }
  for (const row of constraints) {
    if (!isActiveStatConstraint(row)) continue;
    const value = totals[row.stat] ?? 0;
    if (value < row.min) return false;
    // Targets top out at 200, but a single +10 assumed mod can land slightly above.
    if (value > maxAllowedStatTotalForRow(row)) return false;
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
    if (!isActiveStatConstraint(row)) continue;
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
  assumedMods?: AssumedStatMods,
): boolean {
  const activeRows = constraints.filter(isActiveStatConstraint);
  if (activeRows.length === 0) {
    return true;
  }

  let modBudget = 0;
  if (assumedMods) {
    modBudget = totalAssumedModBudget(assumedMods).total;
    if (assumedMods.artifice !== false) {
      modBudget += ARTIFICE_ARMOR_STAT_MOD;
    }
  }

  let modDeficitSum = 0;
  for (const row of activeRows) {
    const armorCeiling =
      (partialTotals[row.stat] ?? 0) +
      remainingSlots * (perSlotMax[row.stat] ?? 0);
    const deficit = Math.max(0, row.min - armorCeiling);
    modDeficitSum += deficit;
    if (armorCeiling + modBudget < row.min) {
      return false;
    }
  }

  // DIM-style: shared mod pool cannot cover the sum of per-stat shortfalls.
  return modDeficitSum <= modBudget;
}
