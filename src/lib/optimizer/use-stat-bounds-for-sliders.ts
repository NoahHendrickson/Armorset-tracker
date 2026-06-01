"use client";

import { useMemo } from "react";
import type { ArmorStatName, DerivedArmorPieceJson } from "@/lib/db/types";
import { computeStatBounds } from "@/lib/optimizer/bounds";
import type { ExoticLock } from "@/lib/optimizer/exotic-lock";
import type { AssumedStatMods } from "@/lib/optimizer/mod-offset";
import type { SetBonusSelection } from "@/lib/optimizer/set-bonus";
import type { StatBounds, StatConstraintRow } from "@/lib/optimizer/types";

export type UseStatBoundsForSlidersArgs = {
  pool: DerivedArmorPieceJson[];
  /** Fragment-only flat per-stat offset. */
  statOffset: Partial<Record<ArmorStatName, number>>;
  assumedStatMods: AssumedStatMods;
  exoticLock: ExoticLock;
  constraints: StatConstraintRow[];
  setBonusSelections?: SetBonusSelection[];
};

/**
 * Achievable ranges for stat sliders. Uses fast greedy cross-stat tightening
 * when targets are set; exact joint bounds only on tiny pools.
 */
export function useStatBoundsForSliders({
  pool,
  statOffset,
  assumedStatMods,
  exoticLock,
  constraints,
  setBonusSelections = [],
}: UseStatBoundsForSlidersArgs): StatBounds {
  return useMemo(
    () =>
      computeStatBounds(
        pool,
        statOffset,
        exoticLock,
        constraints,
        assumedStatMods,
        setBonusSelections,
      ),
    [pool, statOffset, assumedStatMods, exoticLock, constraints, setBonusSelections],
  );
}
