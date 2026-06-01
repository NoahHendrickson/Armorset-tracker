"use client";

import { useEffect, useRef } from "react";
import { hasStatTargets } from "@/lib/optimizer/constraints";
import type { OptimizerRequest } from "@/lib/optimizer/types";

const AUTO_RUN_DEBOUNCE_MS = 300;

export function useOptimizerAutoRun(
  request: OptimizerRequest,
  canRun: boolean,
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
    const shouldRun = canRun && hasStatTargets(request.constraints);

    if (!shouldRun) {
      cancelRef.current();
      return;
    }

    const timer = window.setTimeout(() => {
      runRef.current(request);
    }, AUTO_RUN_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [canRun, request]);
}
