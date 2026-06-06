"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildSearchShards } from "@/lib/optimizer/build-search-shards";
import { mergeOptimizerSolutions } from "@/lib/optimizer/merge-solutions";
import { runOptimizerSearch } from "@/lib/optimizer/run-search";
import { DEFAULT_EXOTIC_LOCK } from "@/lib/optimizer/exotic-lock";
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

function requestCacheKey(payload: OptimizerRequest): string {
  const lock = payload.exoticLock ?? DEFAULT_EXOTIC_LOCK;
  const mins = payload.constraints.map((r) => `${r.stat}:${r.min}`).join(",");
  return JSON.stringify({
    poolIds: payload.pool.map((p) => p.itemInstanceId).sort(),
    mins,
    lock,
    mods: payload.assumedStatMods,
    sets: payload.setBonusSelections,
    offset: payload.statOffset,
    pinned: payload.pinnedInstanceIds,
    excluded: payload.excludedInstanceIds,
  });
}

/**
 * Runs the loadout search off the main thread in a Web Worker so the UI stays
 * responsive (progress, cancel, slider edits) during large-vault searches.
 *
 * Large vaults shard the longest armor slot across multiple workers (DIM-style).
 * Cancel terminates all in-flight workers.
 */
export function useOptimizerWorker() {
  const runIdRef = useRef(0);
  const workerRefs = useRef<Worker[]>([]);
  const prewarmedRef = useRef<Worker | null>(null);
  const workerBrokenRef = useRef(false);
  const lastCompletedKeyRef = useRef<string | null>(null);
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

  const terminateWorkers = useCallback(() => {
    for (const worker of workerRefs.current) {
      worker.terminate();
    }
    workerRefs.current = [];
  }, []);

  const terminatePrewarmed = useCallback(() => {
    if (prewarmedRef.current) {
      prewarmedRef.current.terminate();
      prewarmedRef.current = null;
    }
  }, []);

  /**
   * Eagerly spins up an idle search worker (without running anything) so the
   * first real search has no module cold-start. Idempotent, and a no-op while a
   * run is already active or when workers are unavailable. The next single
   * search adopts this worker (see `adoptOrCreateWorker`).
   */
  const prewarm = useCallback(() => {
    if (prewarmedRef.current || workerRefs.current.length > 0) return;
    const worker = createWorker();
    if (worker) {
      prewarmedRef.current = worker;
    }
  }, [createWorker]);

  /** Hands off a pre-warmed worker if one is idle, otherwise creates a fresh one. */
  const adoptOrCreateWorker = useCallback((): Worker | null => {
    const prewarmed = prewarmedRef.current;
    if (prewarmed) {
      prewarmedRef.current = null;
      return prewarmed;
    }
    return createWorker();
  }, [createWorker]);

  useEffect(() => {
    return () => {
      terminateWorkers();
      terminatePrewarmed();
    };
  }, [terminateWorkers, terminatePrewarmed]);

  const cancel = useCallback(() => {
    runIdRef.current += 1;
    terminateWorkers();
    setState((prev) => ({ ...prev, running: false }));
  }, [terminateWorkers]);

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
          lastCompletedKeyRef.current = requestCacheKey(payload);
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

  const runSingleWorker = useCallback(
    (payload: OptimizerRequest, runId: number) => {
      const worker = adoptOrCreateWorker();
      if (!worker) {
        runOnMainThread(payload, runId);
        return;
      }
      workerRefs.current = [worker];

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
            lastCompletedKeyRef.current = requestCacheKey(payload);
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
        workerBrokenRef.current = true;
        terminateWorkers();
        runOnMainThread(payload, runId);
      };

      worker.postMessage({ type: "run", id: String(runId), payload });
    },
    [adoptOrCreateWorker, runOnMainThread, terminateWorkers],
  );

  const runShardedWorkers = useCallback(
    (payload: OptimizerRequest, runId: number, shards: ReturnType<typeof buildSearchShards>) => {
      const topN = payload.topN ?? 20;
      const shardSolutions: OptimizerSolution[][] = new Array(shards.length);
      const shardProgress = new Array<number>(shards.length).fill(0);
      let boundsReceived: StatBounds | null = null;
      let finished = 0;
      let errored = false;

      const maybeFinish = () => {
        if (errored || finished < shards.length) return;
        if (runId !== runIdRef.current) return;
        const solutions = mergeOptimizerSolutions(
          shardSolutions,
          payload.constraints,
          topN,
        );
        lastCompletedKeyRef.current = requestCacheKey(payload);
        setState({
          running: false,
          progress: 100,
          bounds: boundsReceived,
          solutions,
          error: null,
          hasCompletedRun: true,
        });
        terminateWorkers();
      };

      const workers: Worker[] = [];
      for (let i = 0; i < shards.length; i++) {
        const worker = createWorker();
        if (!worker) {
          terminateWorkers();
          runOnMainThread(payload, runId);
          return;
        }
        workers.push(worker);

        const shardId = `${runId}:${i}`;
        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          const message = event.data;
          if (message.id !== shardId || runId !== runIdRef.current) return;
          switch (message.type) {
            case "bounds":
              if (boundsReceived == null) {
                boundsReceived = message.bounds;
                setState((prev) => ({ ...prev, bounds: message.bounds }));
              }
              return;
            case "progress":
              shardProgress[i] = message.percent;
              setState((prev) => ({
                ...prev,
                progress:
                  shardProgress.reduce((a, b) => a + b, 0) / shards.length,
              }));
              return;
            case "result":
              shardSolutions[i] = message.solutions;
              finished += 1;
              maybeFinish();
              return;
            case "error":
              errored = true;
              setState({
                running: false,
                progress: 0,
                bounds: null,
                solutions: [],
                error: message.message,
                hasCompletedRun: true,
              });
              terminateWorkers();
              return;
          }
        };
        worker.onerror = () => {
          if (runId !== runIdRef.current) return;
          workerBrokenRef.current = true;
          terminateWorkers();
          runOnMainThread(payload, runId);
        };

        worker.postMessage({
          type: "run",
          id: shardId,
          payload: { ...payload, shard: shards[i], topN: topN * 2 },
        });
      }
      workerRefs.current = workers;
    },
    [createWorker, runOnMainThread, terminateWorkers],
  );

  const run = useCallback(
    (payload: OptimizerRequest) => {
      const cacheKey = requestCacheKey(payload);
      if (lastCompletedKeyRef.current === cacheKey) {
        return;
      }

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

      terminateWorkers();

      const exoticLock = payload.exoticLock ?? DEFAULT_EXOTIC_LOCK;
      const shards = buildSearchShards(payload.pool, exoticLock);
      if (shards.length > 1) {
        runShardedWorkers(payload, runId, shards);
      } else {
        runSingleWorker(payload, runId);
      }
    },
    [runShardedWorkers, runSingleWorker, terminateWorkers],
  );

  return { state, run, cancel, prewarm };
}
