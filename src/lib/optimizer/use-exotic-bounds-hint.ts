"use client";

import { useEffect, useState } from "react";
import { ARMOR_STAT_NAMES, type ArmorStatName, type DerivedArmorPieceJson } from "@/lib/db/types";
import { computeStatBounds } from "@/lib/optimizer/bounds";
import type { ExoticStatBudgetLookup } from "@/lib/inventory/exotic-stat-fallback";
import type { ExoticLock } from "@/lib/optimizer/exotic-lock";
import type { AssumedStatMods } from "@/lib/optimizer/mod-offset";
import { filterOptimizerPool } from "@/lib/optimizer/pool";
import type { StatBounds, StatConstraintRow } from "@/lib/optimizer/types";
import type { GridFilterClass } from "@/lib/workspace/grid-filters-schema";

export type UseExoticBoundsHintArgs = {
  exoticLockMode: ExoticLock["mode"];
  ownedExoticCount: number;
  inventoryWithExoticBudget: DerivedArmorPieceJson[];
  classType: GridFilterClass;
  statOffset: Partial<Record<ArmorStatName, number>>;
  exoticStatBudget?: ExoticStatBudgetLookup | null;
  bounds: StatBounds;
  constraints: StatConstraintRow[];
  assumedStatMods: AssumedStatMods;
};

/**
 * When "No exotic" is selected, compares achievable ranges with vs without
 * exotics and surfaces a hint if locking any exotic would widen stat bands.
 */
export function useExoticBoundsHint({
  exoticLockMode,
  ownedExoticCount,
  inventoryWithExoticBudget,
  classType,
  statOffset,
  exoticStatBudget,
  bounds,
  constraints,
  assumedStatMods,
}: UseExoticBoundsHintArgs): boolean {
  const [exoticBoundsHint, setExoticBoundsHint] = useState(false);

  useEffect(() => {
    if (exoticLockMode !== "none" || ownedExoticCount === 0) {
      setExoticBoundsHint(false);
      return;
    }

    let cancelled = false;
    const compute = () => {
      if (cancelled) return;
      const poolAny = filterOptimizerPool(inventoryWithExoticBudget, classType, {
        exoticLock: { mode: "any" },
        exoticStatBudget: exoticStatBudget ?? undefined,
      });
      const withExotics = computeStatBounds(
        poolAny,
        statOffset,
        { mode: "any" },
        constraints,
        assumedStatMods,
      );
      setExoticBoundsHint(
        ARMOR_STAT_NAMES.some((stat) => withExotics[stat].max > bounds[stat].max),
      );
    };

    const idleId =
      typeof requestIdleCallback === "function"
        ? requestIdleCallback(compute, { timeout: 3000 })
        : null;
    const timeoutId = idleId == null ? window.setTimeout(compute, 50) : null;

    return () => {
      cancelled = true;
      if (idleId != null && typeof cancelIdleCallback === "function") {
        cancelIdleCallback(idleId);
      }
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    exoticLockMode,
    ownedExoticCount,
    inventoryWithExoticBudget,
    classType,
    statOffset,
    exoticStatBudget,
    bounds,
    constraints,
    assumedStatMods,
  ]);

  return exoticBoundsHint;
}
