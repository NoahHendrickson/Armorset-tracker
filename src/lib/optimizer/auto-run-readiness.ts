import { isActiveStatConstraint } from "@/lib/optimizer/constraints";
import type { ExoticLock } from "@/lib/optimizer/exotic-lock";
import type { SetBonusSelection } from "@/lib/optimizer/set-bonus";
import type { StatConstraintRow } from "@/lib/optimizer/types";

export type OptimizerAutoRunReadiness =
  | { state: "empty"; message: string }
  | { state: "not-enough-intent"; message: string }
  | { state: "ready"; delayMs: number };

export const OPTIMIZER_AUTO_RUN_DELAY_MS = 600;

const HIGH_SINGLE_STAT_TARGET = 150;
const EMPTY_MESSAGE =
  "Set at least one stat minimum or armor set requirement to generate builds.";
const ADD_TARGET_MESSAGE = "Add another target to start auto-generating.";

export function optimizerAutoRunReadiness({
  constraints,
  selectedSetBonuses,
  exoticLock,
}: {
  constraints: StatConstraintRow[];
  selectedSetBonuses: SetBonusSelection[];
  exoticLock: ExoticLock;
}): OptimizerAutoRunReadiness {
  const activeStats = constraints.filter(isActiveStatConstraint);
  const hasSetBonus = selectedSetBonuses.length > 0;
  const hasLockedExotic = exoticLock.mode === "locked";

  if (activeStats.length === 0 && !hasSetBonus) {
    return { state: "empty", message: EMPTY_MESSAGE };
  }

  const hasHighSingleStat =
    activeStats.length === 1 && activeStats[0]!.min >= HIGH_SINGLE_STAT_TARGET;
  const hasEnoughIntent =
    activeStats.length >= 2 ||
    (activeStats.length >= 1 && hasSetBonus) ||
    (activeStats.length >= 1 && hasLockedExotic) ||
    (hasSetBonus && hasLockedExotic) ||
    hasHighSingleStat;

  if (!hasEnoughIntent) {
    return { state: "not-enough-intent", message: ADD_TARGET_MESSAGE };
  }

  return { state: "ready", delayMs: OPTIMIZER_AUTO_RUN_DELAY_MS };
}
