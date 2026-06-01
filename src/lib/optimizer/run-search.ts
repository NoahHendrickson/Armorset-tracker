import { computeStatBounds, SEARCH_AUTO_RUN_COMBO_LIMIT } from "@/lib/optimizer/bounds";
import { estimateOptimizerComboCount } from "@/lib/optimizer/combo-count";
import { DEFAULT_EXOTIC_LOCK } from "@/lib/optimizer/exotic-lock";
import { searchLoadouts } from "@/lib/optimizer/search";
import type {
  OptimizerRequest,
  OptimizerSolution,
  StatBounds,
} from "@/lib/optimizer/types";

export interface OptimizerSearchResult {
  bounds: StatBounds;
  solutions: OptimizerSolution[];
}

/** Run bounds + search on the main thread (yields once so the UI can paint). */
export async function runOptimizerSearch(
  payload: OptimizerRequest,
  onProgress?: (percent: number) => void,
  isCancelled?: () => boolean,
): Promise<OptimizerSearchResult> {
  onProgress?.(0);

  const exoticLock = payload.exoticLock ?? DEFAULT_EXOTIC_LOCK;
  const comboCount = estimateOptimizerComboCount(payload.pool, exoticLock);
  const bounds =
    comboCount <= SEARCH_AUTO_RUN_COMBO_LIMIT
      ? computeStatBounds(
          payload.pool,
          payload.statOffset,
          exoticLock,
          payload.constraints,
          payload.assumedStatMods,
        )
      : computeStatBounds(
          payload.pool,
          payload.statOffset,
          exoticLock,
          undefined,
          payload.assumedStatMods,
        );

  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  if (isCancelled?.()) {
    return { bounds, solutions: [] };
  }
  const solutions = searchLoadouts(payload, onProgress, isCancelled);
  return { bounds, solutions };
}
