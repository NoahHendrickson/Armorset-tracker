"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { runOptimizerSearch } from "@/lib/optimizer/run-search";
import type {
  OptimizerRequest,
  OptimizerSolution,
  StatBounds,
  WorkerResponse,
} from "@/lib/optimizer/types";

export interface OptimizerWorkerState {
  running: boolean;
  progress: number;
  bounds: StatBounds | null;
  solutions: OptimizerSolution[];
  error: string | null;
  /** True after at least one completed run (including zero-result runs). */
  hasCompletedRun: boolean;
}

const INITIAL_STATE: OptimizerWorkerState = {
  running: false,
  progress: 0,
  bounds: null,
  solutions: [],
  error: null,
  hasCompletedRun: false,
};

/**
 * Runs the loadout search off the main thread in a Web Worker so the UI stays
 * responsive (progress, cancel, slider edits) during large-vault searches.
 *
 * A synchronous worker search can't be interrupted by a message mid-loop, so
 * cancel and each new run *terminate* the in-flight worker and start fresh —
 * this is what makes Cancel actually free the CPU. Falls back to a yielding
 * main-thread search when workers are unavailable (SSR, or a bundler that
 * can't construct the worker).
 */
export function useOptimizerWorker() {
  const runIdRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const workerBrokenRef = useRef(false);
  const [state, setState] = useState<OptimizerWorkerState>(INITIAL_STATE);

  const createWorker = useCallback((): Worker | null => {
    if (workerBrokenRef.current) return null;
    if (typeof Worker === "undefined") return null;
    try {
      return new Worker(new URL("./process.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      workerBrokenRef.current = true;
      return null;
    }
  }, []);

  const terminateWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const cancel = useCallback(() => {
    runIdRef.current += 1;
    terminateWorker();
    setState((prev) => ({ ...prev, running: false }));
  }, [terminateWorker]);

  const runOnMainThread = useCallback(
    (payload: OptimizerRequest, runId: number) => {
      void runOptimizerSearch(
        payload,
        (percent) => {
          if (runId !== runIdRef.current) return;
          setState((prev) => ({ ...prev, progress: percent }));
        },
        () => runId !== runIdRef.current,
      )
        .then(({ bounds, solutions }) => {
          if (runId !== runIdRef.current) return;
          setState({
            running: false,
            progress: 100,
            bounds,
            solutions,
            error: null,
            hasCompletedRun: true,
          });
        })
        .catch((err: unknown) => {
          if (runId !== runIdRef.current) return;
          setState({
            running: false,
            progress: 0,
            bounds: null,
            solutions: [],
            error: err instanceof Error ? err.message : String(err),
            hasCompletedRun: true,
          });
        });
    },
    [],
  );

  const run = useCallback(
    (payload: OptimizerRequest) => {
      runIdRef.current += 1;
      const runId = runIdRef.current;

      setState({
        running: true,
        progress: 0,
        bounds: null,
        solutions: [],
        error: null,
        hasCompletedRun: false,
      });

      // Stop any in-flight search immediately, then start a fresh worker.
      terminateWorker();
      const worker = createWorker();
      if (!worker) {
        runOnMainThread(payload, runId);
        return;
      }
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;
        if (message.id !== String(runId) || runId !== runIdRef.current) return;
        switch (message.type) {
          case "bounds":
            setState((prev) => ({ ...prev, bounds: message.bounds }));
            return;
          case "progress":
            setState((prev) => ({ ...prev, progress: message.percent }));
            return;
          case "result":
            setState((prev) => ({
              ...prev,
              running: false,
              progress: 100,
              solutions: message.solutions,
              error: null,
              hasCompletedRun: true,
            }));
            return;
          case "error":
            setState((prev) => ({
              ...prev,
              running: false,
              progress: 0,
              solutions: [],
              error: message.message,
              hasCompletedRun: true,
            }));
            return;
        }
      };
      worker.onerror = () => {
        if (runId !== runIdRef.current) return;
        // Worker failed to load/run — drop it and fall back to the main thread.
        workerBrokenRef.current = true;
        terminateWorker();
        runOnMainThread(payload, runId);
      };

      worker.postMessage({ type: "run", id: String(runId), payload });
    },
    [createWorker, runOnMainThread, terminateWorker],
  );

  return { state, run, cancel };
}
