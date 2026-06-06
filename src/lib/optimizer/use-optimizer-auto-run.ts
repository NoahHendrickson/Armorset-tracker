"use client";

import { useEffect, useRef } from "react";
import type { OptimizerAutoRunReadiness } from "@/lib/optimizer/auto-run-readiness";
import type { OptimizerRequest } from "@/lib/optimizer/types";

/**
 * Schedules automatic optimizer runs when the readiness policy allows it.
 * Does not cancel in-flight work when auto-run is disabled (large vault) —
 * hard aborts are handled separately in the view layer.
 */
export function useOptimizerAutoRun(
  request: OptimizerRequest,
  readiness: OptimizerAutoRunReadiness,
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
    if (readiness.state !== "ready") {
      return;
    }

    const timer = window.setTimeout(() => {
      runRef.current(request);
    }, readiness.delayMs);

    return () => {
      window.clearTimeout(timer);
      cancelRef.current();
    };
  }, [readiness, request]);
}
