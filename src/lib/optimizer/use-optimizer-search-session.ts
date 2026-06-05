"use client";

import { useEffect, useMemo } from "react";
import type { ArmorStatName, DerivedArmorPieceJson } from "@/lib/db/types";
import { hasStatTargets } from "@/lib/optimizer/constraints";
import type { ExoticLock } from "@/lib/optimizer/exotic-lock";
import type { AssumedStatMods } from "@/lib/optimizer/mod-offset";
import type { SetBonusSelection } from "@/lib/optimizer/set-bonus";
import { groupSolutionsBySignature } from "@/lib/optimizer/signature";
import type { OptimizerRequest, OptimizerSolution, StatConstraintRow } from "@/lib/optimizer/types";
import { useOptimizerAutoRun } from "@/lib/optimizer/use-optimizer-auto-run";
import {
  useOptimizerWorker,
  type OptimizerWorkerState,
} from "@/lib/optimizer/use-optimizer-worker";

export type UseOptimizerSearchSessionArgs = {
  optimizerPool: DerivedArmorPieceJson[];
  searchConstraints: StatConstraintRow[];
  constraints: StatConstraintRow[];
  fragmentStatOffset: Partial<Record<ArmorStatName, number>>;
  assumedStatMods: AssumedStatMods;
  exoticLock: ExoticLock;
  selectedSetBonuses: SetBonusSelection[];
  canRunOptimizer: boolean;
  setBonusConflict: string | null;
  searchTooLarge: boolean;
  canGenerateBuilds: boolean;
  targetsPending: boolean;
  /** When false, skips auto-run and cancels in-flight search while tab is hidden. */
  sessionActive?: boolean;
};

export type UseOptimizerSearchSessionResult = {
  workerState: OptimizerWorkerState;
  run: (payload: OptimizerRequest) => void;
  cancel: () => void;
  optimizerRequest: OptimizerRequest;
  groupedResults: Map<string, OptimizerSolution[]>;
};

export function useOptimizerSearchSession({
  optimizerPool,
  searchConstraints,
  constraints,
  fragmentStatOffset,
  assumedStatMods,
  exoticLock,
  selectedSetBonuses,
  canRunOptimizer,
  setBonusConflict,
  searchTooLarge,
  canGenerateBuilds,
  targetsPending,
  sessionActive = true,
}: UseOptimizerSearchSessionArgs): UseOptimizerSearchSessionResult {
  const { state: workerState, run, cancel } = useOptimizerWorker();

  const optimizerRequest = useMemo(
    () => ({
      pool: optimizerPool,
      constraints: searchConstraints,
      statOffset: fragmentStatOffset,
      assumedStatMods,
      exoticLock,
      setBonusSelections: selectedSetBonuses,
      topN: 20,
    }),
    [
      optimizerPool,
      searchConstraints,
      fragmentStatOffset,
      assumedStatMods,
      exoticLock,
      selectedSetBonuses,
    ],
  );

  useOptimizerAutoRun(
    optimizerRequest,
    sessionActive &&
      canRunOptimizer &&
      setBonusConflict == null &&
      !searchTooLarge &&
      canGenerateBuilds,
    run,
    cancel,
  );

  useEffect(() => {
    if (
      !sessionActive ||
      !canRunOptimizer ||
      setBonusConflict != null ||
      (!hasStatTargets(searchConstraints) && selectedSetBonuses.length === 0)
    ) {
      cancel();
    }
  }, [
    sessionActive,
    canRunOptimizer,
    setBonusConflict,
    searchConstraints,
    selectedSetBonuses.length,
    cancel,
  ]);

  useEffect(() => {
    if (targetsPending && hasStatTargets(constraints)) {
      cancel();
    }
  }, [targetsPending, constraints, cancel]);

  const groupedResults = useMemo(
    () => groupSolutionsBySignature(workerState.solutions),
    [workerState.solutions],
  );

  return {
    workerState,
    run,
    cancel,
    optimizerRequest,
    groupedResults,
  };
}
