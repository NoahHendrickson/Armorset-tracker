import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";
import {
  maxAllowedStatTotalForRow,
} from "@/lib/optimizer/constraints";
import {
  ARTIFICE_ARMOR_STAT_MOD,
  MAJOR_ARMOR_STAT_MOD,
  MINOR_ARMOR_STAT_MOD,
  totalAssumedModBudget,
  type AssumedStatMods,
} from "@/lib/optimizer/mod-offset";
import { OPTIMIZER_STAT_MAX } from "@/lib/optimizer/stat-range";
import type { PlanStatGoals } from "@/lib/plan/plan-stat-goals";

export type PlanModAllocation = Partial<Record<ArmorStatName, number>>;

export type PlanModAllocationResult = {
  totals: Record<ArmorStatName, number>;
  modAllocation: PlanModAllocation;
};

function primaryCapForStat(stat: ArmorStatName): number {
  return maxAllowedStatTotalForRow({ stat, min: OPTIMIZER_STAT_MAX });
}

/**
 * Assign the shared major/minor pool: fill the primary stat toward 200 without
 * overshooting when a minor mod suffices, then stack remaining mods on secondary.
 */
export function allocatePlanMods(
  armorTotals: Record<ArmorStatName, number>,
  goals: PlanStatGoals,
  assumedMods: AssumedStatMods,
): PlanModAllocationResult {
  const budget = totalAssumedModBudget(assumedMods);
  const totals = { ...armorTotals };
  const modAllocation: PlanModAllocation = {};
  let majorLeft = budget.majorCount;
  let minorLeft = budget.minorCount;

  const primary = goals.primaryStat;
  const secondary = goals.secondaryStat;
  const primaryCap = primaryCapForStat(primary);

  if (assumedMods.artifice !== false) {
    const deficit = OPTIMIZER_STAT_MAX - (totals[primary] ?? 0);
    if (deficit > 0 && deficit <= ARTIFICE_ARMOR_STAT_MOD) {
      const current = totals[primary] ?? 0;
      if (current + ARTIFICE_ARMOR_STAT_MOD <= primaryCap) {
        totals[primary] = current + ARTIFICE_ARMOR_STAT_MOD;
        modAllocation[primary] =
          (modAllocation[primary] ?? 0) + ARTIFICE_ARMOR_STAT_MOD;
      }
    }
  }

  while (majorLeft > 0 || minorLeft > 0) {
    const current = totals[primary] ?? 0;
    const deficit = OPTIMIZER_STAT_MAX - current;
    if (deficit <= 0) {
      break;
    }

    const canMajor =
      majorLeft > 0 && current + MAJOR_ARMOR_STAT_MOD <= primaryCap;
    const canMinor =
      minorLeft > 0 && current + MINOR_ARMOR_STAT_MOD <= primaryCap;
    const majorWouldExceed200 =
      current + MAJOR_ARMOR_STAT_MOD > OPTIMIZER_STAT_MAX;

    const useMinor =
      canMinor &&
      (!canMajor ||
        deficit <= MINOR_ARMOR_STAT_MOD ||
        majorWouldExceed200);
    const useMajor = canMajor && !useMinor;

    if (!useMajor && !useMinor) {
      break;
    }

    const delta = useMajor ? MAJOR_ARMOR_STAT_MOD : MINOR_ARMOR_STAT_MOD;
    totals[primary] = current + delta;
    modAllocation[primary] = (modAllocation[primary] ?? 0) + delta;
    if (useMajor) {
      majorLeft -= 1;
    } else {
      minorLeft -= 1;
    }
  }

  while (majorLeft > 0 || minorLeft > 0) {
    const current = totals[secondary] ?? 0;
    const canMajor = majorLeft > 0;
    const canMinor = minorLeft > 0;
    if (!canMajor && !canMinor) {
      break;
    }
    const useMajor = canMajor && (!canMinor || majorLeft >= minorLeft);
    const delta = useMajor ? MAJOR_ARMOR_STAT_MOD : MINOR_ARMOR_STAT_MOD;
    totals[secondary] = current + delta;
    modAllocation[secondary] = (modAllocation[secondary] ?? 0) + delta;
    if (useMajor) {
      majorLeft -= 1;
    } else {
      minorLeft -= 1;
    }
  }

  return { totals, modAllocation };
}

/** Armor-only totals from a mixed plan (no mods). */
export function zeroArmorTotals(): Record<ArmorStatName, number> {
  return Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [stat, 0]),
  ) as Record<ArmorStatName, number>;
}
