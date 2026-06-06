"use client";

import { useEffect, useMemo } from "react";
import type { ArmorStatName, DerivedArmorPieceJson } from "@/lib/db/types";
import {
  optimizerAutoRunReadiness,
  type OptimizerAutoRunReadiness,
} from "@/lib/optimizer/auto-run-readiness";
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
  targetsPending: boolean;
  /** When false, skips auto-run and cancels in-flight search while tab is hidden. */
  sessionActive?: boolean;
};

export type UseOptimizerSearchSessionResult = {
  workerState: OptimizerWorkerState;
  run: (payload: OptimizerRequest) => void;
  cancel: () => void;
  optimizerRequest: OptimizerRequest;
  autoRunReadiness: OptimizerAutoRunReadiness;
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
  targetsPending,
  sessionActive = true,
}: UseOptimizerSearchSessionArgs): UseOptimizerSearchSessionResult {
  const { state: workerState, run, cancel, prewarm } = useOptimizerWorker();

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

  const autoRunReadiness = useMemo((): OptimizerAutoRunReadiness => {
    if (
      !sessionActive ||
      !canRunOptimizer ||
      setBonusConflict != null ||
      targetsPending
    ) {
      return {
        state: "not-enough-intent",
        message: "Add another target to start auto-generating.",
      };
    }
    return optimizerAutoRunReadiness({
      constraints: searchConstraints,
      selectedSetBonuses,
      exoticLock,
    });
  }, [
    sessionActive,
    canRunOptimizer,
    setBonusConflict,
    targetsPending,
    searchConstraints,
    selectedSetBonuses,
    exoticLock,
  ]);

  useOptimizerAutoRun(
    optimizerRequest,
    autoRunReadiness,
    run,
    cancel,
  );

  // Warm the search worker while the user is still under-constrained so the
  // first real auto-run starts without a worker cold-start.
  const underConstrained =
    !hasStatTargets(constraints) && selectedSetBonuses.length === 0;
  useEffect(() => {
    if (sessionActive && optimizerPool.length > 0 && underConstrained) {
      prewarm();
    }
  }, [sessionActive, optimizerPool.length, underConstrained, prewarm]);

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
    autoRunReadiness,
    groupedResults,
  };
}
