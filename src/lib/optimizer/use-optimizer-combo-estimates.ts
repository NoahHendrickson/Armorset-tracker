"use client";

import { useEffect, useMemo, useState } from "react";
import type { ArmorStatName, DerivedArmorPieceJson } from "@/lib/db/types";
import {
  SEARCH_AUTO_RUN_COMBO_LIMIT,
  SYNC_UI_ENUMERATION_COMBO_LIMIT,
} from "@/lib/optimizer/constants";
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
  /** When false, skips deferred combo enumeration while the tab is hidden. */
  enabled?: boolean;
};

export type UseOptimizerComboEstimatesResult = {
  rawComboCount: number;
  searchComboCount: number;
  searchComboCapped: boolean;
  hasSearchFilters: boolean;
  searchTooLarge: boolean;
  exoticAnyFeasible: boolean;
};

type FilteredEstimate = { count: number; capped: boolean };

const EMPTY_FILTERED: FilteredEstimate = { count: 0, capped: false };

export function useOptimizerComboEstimates({
  optimizerPool,
  exoticLock,
  searchConstraints,
  selectedSetBonuses,
  fragmentStatOffset,
  assumedStatMods,
  enabled = true,
}: UseOptimizerComboEstimatesArgs): UseOptimizerComboEstimatesResult {
  const rawComboCount = useMemo(
    () =>
      enabled && optimizerPool.length > 0
        ? estimateOptimizerComboCount(optimizerPool, exoticLock)
        : 0,
    [enabled, optimizerPool, exoticLock],
  );

  const hasSearchFilters =
    hasStatTargets(searchConstraints) || selectedSetBonuses.length > 0;

  const [filteredComboEstimate, setFilteredComboEstimate] =
    useState<FilteredEstimate>(EMPTY_FILTERED);

  useEffect(() => {
    if (!enabled || optimizerPool.length === 0 || !hasSearchFilters) {
      setFilteredComboEstimate(EMPTY_FILTERED);
      return;
    }

    if (
      rawComboCount > SYNC_UI_ENUMERATION_COMBO_LIMIT &&
      selectedSetBonuses.length === 0
    ) {
      setFilteredComboEstimate({ count: rawComboCount, capped: false });
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const next = estimateFilteredComboCount(optimizerPool, exoticLock, {
        constraints: searchConstraints,
        setBonusSelections: selectedSetBonuses,
        statOffset: fragmentStatOffset,
        assumedMods: assumedStatMods,
        cap: SYNC_UI_ENUMERATION_COMBO_LIMIT + 1,
      });
      if (!cancelled) {
        setFilteredComboEstimate(next);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    enabled,
    optimizerPool,
    exoticLock,
    searchConstraints,
    selectedSetBonuses,
    fragmentStatOffset,
    assumedStatMods,
    rawComboCount,
    hasSearchFilters,
  ]);

  const searchComboCount = hasSearchFilters
    ? filteredComboEstimate.count
    : rawComboCount;
  const searchComboCapped =
    hasSearchFilters &&
    (rawComboCount > SEARCH_AUTO_RUN_COMBO_LIMIT ||
      (filteredComboEstimate.capped &&
        filteredComboEstimate.count > SEARCH_AUTO_RUN_COMBO_LIMIT));
  const searchTooLarge = searchComboCapped;

  const [exoticAnyFeasible, setExoticAnyFeasible] = useState(false);

  useEffect(() => {
    if (
      !enabled ||
      exoticLock.mode !== "none" ||
      optimizerPool.length === 0 ||
      !hasSearchFilters ||
      searchTooLarge
    ) {
      setExoticAnyFeasible(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
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
      if (!cancelled) {
        setExoticAnyFeasible(count > 0);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    enabled,
    exoticLock.mode,
    optimizerPool,
    hasSearchFilters,
    searchTooLarge,
    searchConstraints,
    selectedSetBonuses,
    fragmentStatOffset,
    assumedStatMods,
  ]);

  return {
    rawComboCount,
    searchComboCount,
    searchComboCapped,
    hasSearchFilters,
    searchTooLarge,
    exoticAnyFeasible,
  };
}
