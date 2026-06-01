"use client";

import { useEffect, useRef } from "react";
import { hasStatTargets } from "@/lib/optimizer/constraints";
import type { OptimizerRequest } from "@/lib/optimizer/types";

/** Request debounce lives in `searchConstraints`; run as soon as that commits. */
const AUTO_RUN_DEBOUNCE_MS = 0;

/**
 * Schedules automatic optimizer runs when `canAutoRun` is true.
 * Does not cancel in-flight work when auto-run is disabled (large vault) —
 * hard aborts are handled separately in the view layer.
 */
export function useOptimizerAutoRun(
  request: OptimizerRequest,
  canAutoRun: boolean,
  run: (payload: OptimizerRequest) => void,
  cancel: () => void,
) {
  const runRef = useRef(run);
  const cancelRef = useRef(cancel);

  useEffect(() => {
    runRef.current = run;
    cancelRef.current = cancel;
  });

  useEffect(() => {
    const hasTargets = hasStatTargets(request.constraints);
    const hasSetBonuses = (request.setBonusSelections?.length ?? 0) > 0;
    if (!canAutoRun || (!hasTargets && !hasSetBonuses)) {
      return;
    }

    const timer = window.setTimeout(() => {
      runRef.current(request);
    }, AUTO_RUN_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      cancelRef.current();
    };
  }, [canAutoRun, request]);
}
