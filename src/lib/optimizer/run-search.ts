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

export type ComputeOptimizerSearchBoundsOptions = {
  /** When true, returns null if the deduped combo count exceeds the auto-run limit. */
  omitWhenSearchTooLarge?: boolean;
};

export function computeOptimizerSearchBounds(
  payload: OptimizerRequest,
  options: ComputeOptimizerSearchBoundsOptions = {},
): StatBounds | null {
  const exoticLock = payload.exoticLock ?? DEFAULT_EXOTIC_LOCK;
  const comboCount = estimateOptimizerComboCount(payload.pool, exoticLock);

  if (
    options.omitWhenSearchTooLarge &&
    comboCount > SEARCH_AUTO_RUN_COMBO_LIMIT
  ) {
    return null;
  }

  if (comboCount <= SEARCH_AUTO_RUN_COMBO_LIMIT) {
    return computeStatBounds(
      payload.pool,
      payload.statOffset,
      exoticLock,
      payload.constraints,
      payload.assumedStatMods,
    );
  }

  return computeStatBounds(
    payload.pool,
    payload.statOffset,
    exoticLock,
    undefined,
    payload.assumedStatMods,
  );
}

/** Synchronous bounds + search — shared core for main thread and worker paths. */
export function runOptimizerSearchSync(
  payload: OptimizerRequest,
  onProgress?: (percent: number) => void,
  isCancelled?: () => boolean,
): OptimizerSearchResult {
  return {
    bounds: computeOptimizerSearchBounds(payload)!,
    solutions: searchLoadouts(payload, onProgress, isCancelled),
  };
}

/** Worker path — skips bounds when the vault is too large for auto-run. */
export function runWorkerOptimizerSearchSync(
  payload: OptimizerRequest,
  onProgress?: (percent: number) => void,
  isCancelled?: () => boolean,
): { bounds: StatBounds | null; solutions: OptimizerSolution[] } {
  return {
    bounds: computeOptimizerSearchBounds(payload, {
      omitWhenSearchTooLarge: true,
    }),
    solutions: searchLoadouts(payload, onProgress, isCancelled),
  };
}

/** Run bounds + search on the main thread (yields once so the UI can paint). */
export async function runOptimizerSearch(
  payload: OptimizerRequest,
  onProgress?: (percent: number) => void,
  isCancelled?: () => boolean,
): Promise<OptimizerSearchResult> {
  onProgress?.(0);

  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

  if (isCancelled?.()) {
    return {
      bounds: computeOptimizerSearchBounds(payload)!,
      solutions: [],
    };
  }

  return runOptimizerSearchSync(payload, onProgress, isCancelled);
}
