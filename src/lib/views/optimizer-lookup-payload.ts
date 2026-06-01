import type { ArmorStatName } from "@/lib/db/types";
import type { SetBonusSelection } from "@/lib/optimizer/set-bonus";
import type { ExoticStatBudgetLookup } from "@/lib/inventory/exotic-stat-fallback";
import { EMPTY_EXOTIC_STAT_BUDGET } from "@/lib/inventory/exotic-stat-fallback";
import {
  CANONICAL_OPTIMIZER_SUBCLASS_KEYS,
  classTypeFromSubclassKey,
  subclassLabel,
  subclassesForClassType,
} from "@/lib/optimizer/subclass-key";

export type FragmentPlugPayload = {
  plugHash: number;
  name: string;
  iconPath: string;
  subclassKey: string;
  deltas: Array<{ stat: ArmorStatName; value: number }>;
};

export type SubclassOption = {
  key: string;
  label: string;
  element: string;
  classType?: number;
};

export type SetPerkPayload = {
  setHash: number;
  setName: string;
  requiredSetCount: number;
  perkHash: number;
  name: string;
  description: string;
  iconPath: string;
};

/**
 * Client-safe manifest slice for the loadout optimizer.
 */
export interface OptimizerLookupPayload {
  fragmentPlugsByHash: Record<string, FragmentPlugPayload>;
  /** Sorted by name for stable UI lists. */
  fragmentPlugs: FragmentPlugPayload[];
  subclasses: SubclassOption[];
  fragmentsBySubclass: Record<string, FragmentPlugPayload[]>;
  setPerks: SetPerkPayload[];
  setPerksBySetHash: Record<string, SetPerkPayload[]>;
  /** Manifest exotic stat budgets for pieces missing cached `statTotals`. */
  exoticStatBudget: ExoticStatBudgetLookup;
}

export const EMPTY_OPTIMIZER_LOOKUP: OptimizerLookupPayload = {
  fragmentPlugsByHash: {},
  fragmentPlugs: [],
  subclasses: [],
  fragmentsBySubclass: {},
  setPerks: [],
  setPerksBySetHash: {},
  exoticStatBudget: EMPTY_EXOTIC_STAT_BUDGET,
};

export function toSetBonusSelection(perk: SetPerkPayload): SetBonusSelection {
  return {
    setHash: perk.setHash,
    requiredCount: perk.requiredSetCount,
    perkHash: perk.perkHash,
  };
}

export function subclassesForOptimizerClass(
  payload: OptimizerLookupPayload,
  classType: number,
): SubclassOption[] {
  const fromPayload = payload.subclasses.filter((sub) => {
    if (sub.classType === undefined) return true;
    return sub.classType === classType;
  });
  const seen = new Set(fromPayload.map((sub) => sub.key));
  const merged = [...fromPayload];
  for (const key of CANONICAL_OPTIMIZER_SUBCLASS_KEYS) {
    if (seen.has(key)) continue;
    const keyClass = classTypeFromSubclassKey(key);
    if (keyClass !== undefined && keyClass !== classType) continue;
    merged.push({
      key,
      label: subclassLabel(key),
      element: key.split(".")[0] ?? key,
      classType: keyClass,
    });
  }
  merged.sort((a, b) => a.label.localeCompare(b.label));
  return merged;
}
