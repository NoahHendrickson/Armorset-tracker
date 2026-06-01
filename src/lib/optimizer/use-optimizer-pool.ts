"use client";

import { useEffect, useMemo } from "react";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import { enrichPieceWithExoticBudget } from "@/lib/inventory/exotic-stat-fallback";
import type { ExoticStatBudgetLookup } from "@/lib/inventory/exotic-stat-fallback";
import {
  normalizeExoticLock,
  uniqueOwnedExoticsForClass,
  type ExoticLock,
} from "@/lib/optimizer/exotic-lock";
import {
  filterOptimizerPool,
  optimizerEligiblePieces,
  poolCoversAllSlots,
} from "@/lib/optimizer/pool";
import type { GridFilterClass } from "@/lib/workspace/grid-filters-schema";

export type UseOptimizerPoolArgs = {
  inventory: DerivedArmorPieceJson[];
  classType: GridFilterClass;
  exoticLock: ExoticLock;
  setExoticLock: React.Dispatch<React.SetStateAction<ExoticLock>>;
  exoticStatBudget?: ExoticStatBudgetLookup | null;
};

export type UseOptimizerPoolResult = {
  inventoryWithExoticBudget: DerivedArmorPieceJson[];
  eligiblePieces: DerivedArmorPieceJson[];
  optimizerPool: DerivedArmorPieceJson[];
  ownedExotics: ReturnType<typeof uniqueOwnedExoticsForClass>;
  classPieceCount: number;
  canRunOptimizer: boolean;
  missingSlotCoverage: boolean;
  noTier5: boolean;
};

export function useOptimizerPool({
  inventory,
  classType,
  exoticLock,
  setExoticLock,
  exoticStatBudget,
}: UseOptimizerPoolArgs): UseOptimizerPoolResult {
  const inventoryWithExoticBudget = useMemo(
    () =>
      exoticStatBudget
        ? inventory.map((piece) =>
            enrichPieceWithExoticBudget(piece, exoticStatBudget),
          )
        : inventory,
    [inventory, exoticStatBudget],
  );

  const eligiblePieces = useMemo(
    () => optimizerEligiblePieces(inventoryWithExoticBudget, classType),
    [inventoryWithExoticBudget, classType],
  );

  const optimizerPool = useMemo(
    () =>
      filterOptimizerPool(inventoryWithExoticBudget, classType, {
        exoticLock,
        exoticStatBudget: exoticStatBudget ?? undefined,
      }),
    [inventoryWithExoticBudget, classType, exoticLock, exoticStatBudget],
  );

  const ownedExotics = useMemo(
    () => uniqueOwnedExoticsForClass(inventory, classType),
    [inventory, classType],
  );

  useEffect(() => {
    setExoticLock((prev) => {
      const next = normalizeExoticLock(prev, inventory, classType);
      if (
        prev.mode === next.mode &&
        (prev.mode !== "locked" ||
          (next.mode === "locked" &&
            prev.itemInstanceId === next.itemInstanceId))
      ) {
        return prev;
      }
      return next;
    });
  }, [inventory, classType, setExoticLock]);

  const classPieceCount = useMemo(
    () => inventory.filter((piece) => piece.classType === classType).length,
    [inventory, classType],
  );

  const canRunOptimizer =
    optimizerPool.length > 0 && poolCoversAllSlots(optimizerPool);
  const missingSlotCoverage =
    optimizerPool.length > 0 && !poolCoversAllSlots(optimizerPool);
  const noTier5 = classPieceCount > 0 && eligiblePieces.length === 0;

  return {
    inventoryWithExoticBudget,
    eligiblePieces,
    optimizerPool,
    ownedExotics,
    classPieceCount,
    canRunOptimizer,
    missingSlotCoverage,
    noTier5,
  };
}
