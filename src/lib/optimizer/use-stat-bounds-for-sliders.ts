"use client";

import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import type { ArmorStatName, DerivedArmorPieceJson } from "@/lib/db/types";
import { computeStatBounds } from "@/lib/optimizer/bounds";
import type { ExoticLock } from "@/lib/optimizer/exotic-lock";
import type { AssumedStatMods } from "@/lib/optimizer/mod-offset";
import type { SetBonusSelection } from "@/lib/optimizer/set-bonus";
import type {
  OptimizerBoundsRequest,
  StatBounds,
  StatConstraintRow,
  WorkerResponse,
} from "@/lib/optimizer/types";

export type UseStatBoundsForSlidersArgs = {
  pool: DerivedArmorPieceJson[];
  /** Fragment-only flat per-stat offset. */
  statOffset: Partial<Record<ArmorStatName, number>>;
  assumedStatMods: AssumedStatMods;
  exoticLock: ExoticLock;
  constraints: StatConstraintRow[];
  setBonusSelections?: SetBonusSelection[];
  /**
   * When true, only the fast greedy preview runs (no worker). Use while constraints
   * are still changing so drag/input stays responsive.
   */
  previewOnly?: boolean;
  /** When false, skips worker/main-thread recompute (inactive optimizer tab). */
  enabled?: boolean;
};

function boundsPayload(args: UseStatBoundsForSlidersArgs): OptimizerBoundsRequest {
  return {
    pool: args.pool,
    statOffset: args.statOffset,
    assumedStatMods: args.assumedStatMods,
    exoticLock: args.exoticLock,
    constraints: args.constraints,
    setBonusSelections: args.setBonusSelections,
  };
}

/**
 * Achievable ranges for stat sliders. Shows a greedy preview immediately, then
 * refines in a persistent Web Worker so large-vault bound passes stay off-thread.
 */
export function useStatBoundsForSliders({
  pool,
  statOffset,
  assumedStatMods,
  exoticLock,
  constraints,
  setBonusSelections = [],
  previewOnly = false,
  enabled = true,
}: UseStatBoundsForSlidersArgs): StatBounds {
  const deferredPool = useDeferredValue(pool);

  const runIdRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const workerBrokenRef = useRef(false);

  const [bounds, setBounds] = useState<StatBounds>(() =>
    computeStatBounds(
      pool,
      statOffset,
      exoticLock,
      constraints,
      assumedStatMods,
      setBonusSelections,
      { previewOnly: true },
    ),
  );

  const applyBounds = useCallback((runId: number, next: StatBounds) => {
    if (runId !== runIdRef.current) return;
    setBounds(next);
  }, []);

  const runFullBoundsOnMainThread = useCallback(
    (runId: number, payload: OptimizerBoundsRequest) => {
      window.setTimeout(() => {
        if (runId !== runIdRef.current) return;
        applyBounds(
          runId,
          computeStatBounds(
            payload.pool,
            payload.statOffset,
            payload.exoticLock,
            payload.constraints,
            payload.assumedStatMods,
            payload.setBonusSelections,
          ),
        );
      }, 0);
    },
    [applyBounds],
  );

  const ensureWorker = useCallback((): Worker | null => {
    if (workerBrokenRef.current || typeof Worker === "undefined") {
      return null;
    }
    if (workerRef.current) {
      return workerRef.current;
    }
    try {
      const worker = new Worker(new URL("./bounds.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;
        if (message.type === "bounds") {
          applyBounds(Number(message.id), message.bounds);
        }
      };
      worker.onerror = () => {
        workerBrokenRef.current = true;
        worker.terminate();
        if (workerRef.current === worker) {
          workerRef.current = null;
        }
      };
      workerRef.current = worker;
      return worker;
    } catch {
      workerBrokenRef.current = true;
      return null;
    }
  }, [applyBounds]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    runIdRef.current += 1;
    const runId = runIdRef.current;

    const payload = boundsPayload({
      pool: deferredPool,
      statOffset,
      assumedStatMods,
      exoticLock,
      constraints,
      setBonusSelections,
    });

    applyBounds(
      runId,
      computeStatBounds(
        pool,
        statOffset,
        exoticLock,
        constraints,
        assumedStatMods,
        setBonusSelections,
        { previewOnly: true },
      ),
    );

    if (previewOnly) {
      return;
    }

    const worker = ensureWorker();
    if (!worker) {
      runFullBoundsOnMainThread(runId, payload);
      return;
    }

    worker.postMessage({
      type: "computeBounds",
      id: String(runId),
      payload,
    });
  }, [
    enabled,
    deferredPool,
    pool,
    statOffset,
    exoticLock,
    constraints,
    assumedStatMods,
    setBonusSelections,
    previewOnly,
    applyBounds,
    ensureWorker,
    runFullBoundsOnMainThread,
  ]);

  useEffect(() => {
    if (!enabled) {
      workerRef.current?.terminate();
      workerRef.current = null;
    }
  }, [enabled]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  return bounds;
}
