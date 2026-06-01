import { computeStatBounds } from "@/lib/optimizer/bounds";
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
  const bounds = computeStatBounds(
    payload.pool,
    payload.statOffset,
    payload.exoticLock,
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
