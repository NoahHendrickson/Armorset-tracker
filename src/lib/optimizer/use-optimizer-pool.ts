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

const EMPTY_POOL_RESULT: Pick<
  UseOptimizerPoolResult,
  | "inventoryWithExoticBudget"
  | "eligiblePieces"
  | "optimizerPool"
  | "ownedExotics"
  | "classPieceCount"
  | "canRunOptimizer"
  | "missingSlotCoverage"
  | "noTier5"
> = {
  inventoryWithExoticBudget: [],
  eligiblePieces: [],
  optimizerPool: [],
  ownedExotics: [],
  classPieceCount: 0,
  canRunOptimizer: false,
  missingSlotCoverage: false,
  noTier5: false,
};

export type UseOptimizerPoolArgs = {
  inventory: DerivedArmorPieceJson[];
  classType: GridFilterClass;
  exoticLock: ExoticLock;
  setExoticLock: React.Dispatch<React.SetStateAction<ExoticLock>>;
  exoticStatBudget?: ExoticStatBudgetLookup | null;
  /** When false, skips vault scans while the optimizer tab is hidden. */
  enabled?: boolean;
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
  enabled = true,
}: UseOptimizerPoolArgs): UseOptimizerPoolResult {
  const inventoryWithExoticBudget = useMemo(() => {
    if (!enabled) return EMPTY_POOL_RESULT.inventoryWithExoticBudget;
    return exoticStatBudget
      ? inventory.map((piece) =>
          enrichPieceWithExoticBudget(piece, exoticStatBudget),
        )
      : inventory;
  }, [enabled, inventory, exoticStatBudget]);

  const eligiblePieces = useMemo(() => {
    if (!enabled) return EMPTY_POOL_RESULT.eligiblePieces;
    return optimizerEligiblePieces(inventoryWithExoticBudget, classType);
  }, [enabled, inventoryWithExoticBudget, classType]);

  const optimizerPool = useMemo(() => {
    if (!enabled) return EMPTY_POOL_RESULT.optimizerPool;
    return filterOptimizerPool(inventoryWithExoticBudget, classType, {
      exoticLock,
      exoticStatBudget: exoticStatBudget ?? undefined,
    });
  }, [enabled, inventoryWithExoticBudget, classType, exoticLock, exoticStatBudget]);

  const ownedExotics = useMemo(() => {
    if (!enabled) return EMPTY_POOL_RESULT.ownedExotics;
    return uniqueOwnedExoticsForClass(inventory, classType);
  }, [enabled, inventory, classType]);

  useEffect(() => {
    if (!enabled) return;
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
  }, [enabled, inventory, classType, setExoticLock]);

  const classPieceCount = useMemo(() => {
    if (!enabled) return 0;
    return inventory.filter((piece) => piece.classType === classType).length;
  }, [enabled, inventory, classType]);

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
