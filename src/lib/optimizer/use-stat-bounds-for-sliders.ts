"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
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
 * Achievable ranges for stat sliders. Computes in a dedicated Web Worker so
 * large-vault bound passes do not block the main thread.
 */
export function useStatBoundsForSliders({
  pool,
  statOffset,
  assumedStatMods,
  exoticLock,
  constraints,
  setBonusSelections = [],
}: UseStatBoundsForSlidersArgs): StatBounds {
  const deferredPool = useDeferredValue(pool);
  const deferredConstraints = useDeferredValue(constraints);
  const deferredStatOffset = useDeferredValue(statOffset);
  const deferredExoticLock = useDeferredValue(exoticLock);
  const deferredAssumedMods = useDeferredValue(assumedStatMods);
  const deferredSetBonuses = useDeferredValue(setBonusSelections);

  const runIdRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const workerBrokenRef = useRef(false);

  const [bounds, setBounds] = useState<StatBounds>(() =>
    computeStatBounds(
      pool,
      statOffset,
      exoticLock,
      undefined,
      assumedStatMods,
      setBonusSelections,
    ),
  );

  useEffect(() => {
    runIdRef.current += 1;
    const runId = runIdRef.current;
    let cancelled = false;

    const applyBounds = (next: StatBounds) => {
      if (cancelled || runId !== runIdRef.current) return;
      setBounds(next);
    };

    const runOnMainThread = () => {
      window.setTimeout(() => {
        if (cancelled || runId !== runIdRef.current) return;
        applyBounds(
          computeStatBounds(
            deferredPool,
            deferredStatOffset,
            deferredExoticLock,
            deferredConstraints,
            deferredAssumedMods,
            deferredSetBonuses,
          ),
        );
      }, 0);
    };

    workerRef.current?.terminate();
    workerRef.current = null;

    if (workerBrokenRef.current || typeof Worker === "undefined") {
      runOnMainThread();
      return () => {
        cancelled = true;
      };
    }

    let worker: Worker;
    try {
      worker = new Worker(new URL("./bounds.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      workerBrokenRef.current = true;
      runOnMainThread();
      return () => {
        cancelled = true;
      };
    }

    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.id !== String(runId) || runId !== runIdRef.current) return;
      if (message.type === "bounds") {
        applyBounds(message.bounds);
      }
    };
    worker.onerror = () => {
      workerBrokenRef.current = true;
      worker.terminate();
      workerRef.current = null;
      runOnMainThread();
    };

    worker.postMessage({
      type: "computeBounds",
      id: String(runId),
      payload: boundsPayload({
        pool: deferredPool,
        statOffset: deferredStatOffset,
        assumedStatMods: deferredAssumedMods,
        exoticLock: deferredExoticLock,
        constraints: deferredConstraints,
        setBonusSelections: deferredSetBonuses,
      }),
    });

    return () => {
      cancelled = true;
      worker.terminate();
      if (workerRef.current === worker) {
        workerRef.current = null;
      }
    };
  }, [
    deferredPool,
    deferredStatOffset,
    deferredExoticLock,
    deferredConstraints,
    deferredAssumedMods,
    deferredSetBonuses,
  ]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  return bounds;
}
