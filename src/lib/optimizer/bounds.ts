import { SLOT_ORDER } from "@/lib/bungie/constants";
import type { ArmorStatName, DerivedArmorPieceJson } from "@/lib/db/types";
import {
  hasStatTargets,
  isActiveStatConstraint,
} from "@/lib/optimizer/constraints";
import {
  JOINT_BOUNDS_COMBO_LIMIT,
  SYNC_UI_ENUMERATION_COMBO_LIMIT,
} from "@/lib/optimizer/constants";
import {
  estimateOptimizerComboCount,
} from "@/lib/optimizer/combo-count";
import { groupPoolBySlot } from "@/lib/optimizer/enumeration/pool-by-slot";
import {
  applyFragmentOffsetToBounds,
  applyModBudgetToBounds,
  emptyBounds,
  independentStatBounds,
} from "@/lib/optimizer/bounds-independent";
import { computeHeuristicConstrainedStatBounds } from "@/lib/optimizer/bounds-heuristic";
import { jointStatBounds } from "@/lib/optimizer/bounds-joint";
import {
  DEFAULT_EXOTIC_LOCK,
  type ExoticLock,
} from "@/lib/optimizer/exotic-lock";
import {
  DEFAULT_ASSUMED_STAT_MODS,
  type AssumedStatMods,
} from "@/lib/optimizer/mod-offset";
import type { SetBonusSelection } from "@/lib/optimizer/set-bonus";
import type { StatBounds, StatConstraintRow } from "@/lib/optimizer/types";

export type StatBoundsComputeOptions = {
  /** Greedy bands only — for instant slider previews before the worker refines. */
  previewOnly?: boolean;
};

export {
  JOINT_BOUNDS_COMBO_LIMIT,
  SEARCH_AUTO_RUN_COMBO_LIMIT,
  SYNC_UI_ENUMERATION_COMBO_LIMIT,
} from "@/lib/optimizer/constants";
export { computeConstrainedStatBounds } from "@/lib/optimizer/bounds-joint";
export { computeHeuristicConstrainedStatBounds } from "@/lib/optimizer/bounds-heuristic";

/**
 * Achievable min/max per stat from a filtered pool. Respects exotic lock rules
 * (at most one exotic; locked piece fixed to its slot). Powers gray range bars.
 */
export function computeStatBounds(
  pool: DerivedArmorPieceJson[],
  statOffset?: Partial<Record<ArmorStatName, number>>,
  exoticLock: ExoticLock = DEFAULT_EXOTIC_LOCK,
  constraints?: StatConstraintRow[],
  assumedMods: AssumedStatMods = DEFAULT_ASSUMED_STAT_MODS,
  setBonusSelections: SetBonusSelection[] = [],
  options: StatBoundsComputeOptions = {},
): StatBounds {
  const previewOnly = options.previewOnly === true;
  const bySlot = groupPoolBySlot(pool);

  for (const slot of SLOT_ORDER) {
    if ((bySlot.get(slot)?.length ?? 0) === 0) {
      return emptyBounds();
    }
  }

  let bounds: StatBounds | null = null;
  if (constraints && hasStatTargets(constraints)) {
    const comboCount = estimateOptimizerComboCount(pool, exoticLock);
    if (comboCount <= JOINT_BOUNDS_COMBO_LIMIT) {
      bounds = jointStatBounds(
        pool,
        constraints,
        statOffset,
        exoticLock,
        assumedMods,
      );
    }
    if (bounds == null) {
      bounds = computeHeuristicConstrainedStatBounds(
        pool,
        constraints,
        statOffset,
        exoticLock,
        assumedMods,
        setBonusSelections,
        {
          greedyOnly: comboCount > SYNC_UI_ENUMERATION_COMBO_LIMIT,
          previewOnly,
        },
      );
    }
  }
  if (bounds == null) {
    bounds = independentStatBounds(bySlot, exoticLock);
    bounds = bounds
      ? applyModBudgetToBounds(
          applyFragmentOffsetToBounds(bounds, statOffset),
          assumedMods,
        )
      : null;
  }

  if (bounds == null) {
    return emptyBounds();
  }
  return bounds;
}

/** Fast preflight — false when gray-band max cannot reach an active minimum. */
export function areConstraintsAchievable(
  pool: DerivedArmorPieceJson[],
  constraints: StatConstraintRow[],
  statOffset?: Partial<Record<ArmorStatName, number>>,
  exoticLock: ExoticLock = DEFAULT_EXOTIC_LOCK,
  assumedMods: AssumedStatMods = DEFAULT_ASSUMED_STAT_MODS,
  setBonusSelections: SetBonusSelection[] = [],
): boolean {
  if (!hasStatTargets(constraints)) {
    return true;
  }
  const bounds = computeHeuristicConstrainedStatBounds(
    pool,
    constraints,
    statOffset,
    exoticLock,
    assumedMods,
    setBonusSelections,
  );
  if (bounds == null) {
    return false;
  }
  for (const row of constraints) {
    if (!isActiveStatConstraint(row)) continue;
    if ((bounds[row.stat]?.max ?? 0) < row.min) {
      return false;
    }
  }
  return true;
}
