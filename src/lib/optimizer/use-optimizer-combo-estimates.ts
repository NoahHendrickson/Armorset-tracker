"use client";

import { useMemo } from "react";
import type { ArmorStatName, DerivedArmorPieceJson } from "@/lib/db/types";
import { SEARCH_AUTO_RUN_COMBO_LIMIT } from "@/lib/optimizer/constants";
import {
  estimateFilteredComboCount,
  estimateOptimizerComboCount,
} from "@/lib/optimizer/combo-count";
import { hasStatTargets } from "@/lib/optimizer/constraints";
import type { ExoticLock } from "@/lib/optimizer/exotic-lock";
import type { AssumedStatMods } from "@/lib/optimizer/mod-offset";
import type { SetBonusSelection } from "@/lib/optimizer/set-bonus";
import type { StatConstraintRow } from "@/lib/optimizer/types";

export function formatSearchComboCount(count: number, capped: boolean): string {
  if (capped) {
    return `${SEARCH_AUTO_RUN_COMBO_LIMIT.toLocaleString()}+`;
  }
  return count.toLocaleString();
}

export type UseOptimizerComboEstimatesArgs = {
  optimizerPool: DerivedArmorPieceJson[];
  exoticLock: ExoticLock;
  searchConstraints: StatConstraintRow[];
  selectedSetBonuses: SetBonusSelection[];
  fragmentStatOffset: Partial<Record<ArmorStatName, number>>;
  assumedStatMods: AssumedStatMods;
};

export type UseOptimizerComboEstimatesResult = {
  rawComboCount: number;
  searchComboCount: number;
  searchComboCapped: boolean;
  hasSearchFilters: boolean;
  searchTooLarge: boolean;
  exoticAnyFeasible: boolean;
};

export function useOptimizerComboEstimates({
  optimizerPool,
  exoticLock,
  searchConstraints,
  selectedSetBonuses,
  fragmentStatOffset,
  assumedStatMods,
}: UseOptimizerComboEstimatesArgs): UseOptimizerComboEstimatesResult {
  const rawComboCount = useMemo(
    () =>
      optimizerPool.length > 0
        ? estimateOptimizerComboCount(optimizerPool, exoticLock)
        : 0,
    [optimizerPool, exoticLock],
  );

  const filteredComboEstimate = useMemo(() => {
    if (optimizerPool.length === 0) {
      return { count: 0, capped: false };
    }
    return estimateFilteredComboCount(optimizerPool, exoticLock, {
      constraints: searchConstraints,
      setBonusSelections: selectedSetBonuses,
      statOffset: fragmentStatOffset,
      assumedMods: assumedStatMods,
      cap: SEARCH_AUTO_RUN_COMBO_LIMIT + 1,
    });
  }, [
    optimizerPool,
    exoticLock,
    searchConstraints,
    selectedSetBonuses,
    fragmentStatOffset,
    assumedStatMods,
  ]);

  const hasSearchFilters =
    hasStatTargets(searchConstraints) || selectedSetBonuses.length > 0;

  const exoticAnyFeasible = useMemo(() => {
    if (
      exoticLock.mode !== "none" ||
      optimizerPool.length === 0 ||
      !hasSearchFilters
    ) {
      return false;
    }
    const { count } = estimateFilteredComboCount(
      optimizerPool,
      { mode: "any" },
      {
        constraints: searchConstraints,
        setBonusSelections: selectedSetBonuses,
        statOffset: fragmentStatOffset,
        assumedMods: assumedStatMods,
        cap: 1,
      },
    );
    return count > 0;
  }, [
    exoticLock.mode,
    optimizerPool,
    hasSearchFilters,
    searchConstraints,
    selectedSetBonuses,
    fragmentStatOffset,
    assumedStatMods,
  ]);

  const searchComboCount = hasSearchFilters
    ? filteredComboEstimate.count
    : rawComboCount;
  const searchComboCapped = hasSearchFilters && filteredComboEstimate.capped;
  const searchTooLarge =
    searchComboCapped || searchComboCount > SEARCH_AUTO_RUN_COMBO_LIMIT;

  return {
    rawComboCount,
    searchComboCount,
    searchComboCapped,
    hasSearchFilters,
    searchTooLarge,
    exoticAnyFeasible,
  };
}
