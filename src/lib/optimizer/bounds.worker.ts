/// <reference lib="webworker" />

import { computeStatBounds } from "@/lib/optimizer/bounds";
import { DEFAULT_EXOTIC_LOCK } from "@/lib/optimizer/exotic-lock";
import { DEFAULT_ASSUMED_STAT_MODS } from "@/lib/optimizer/mod-offset";
import type {
  OptimizerBoundsRequest,
  WorkerComputeBoundsMessage,
  WorkerBoundsMessage,
  WorkerErrorMessage,
} from "@/lib/optimizer/types";

let currentRunId: string | null = null;

self.onmessage = (event: MessageEvent<WorkerComputeBoundsMessage>) => {
  const message = event.data;
  if (message.type !== "computeBounds") {
    return;
  }

  currentRunId = message.id;
  const payload: OptimizerBoundsRequest = message.payload;

  try {
    const bounds = computeStatBounds(
      payload.pool,
      payload.statOffset,
      payload.exoticLock ?? DEFAULT_EXOTIC_LOCK,
      payload.constraints,
      payload.assumedStatMods ?? DEFAULT_ASSUMED_STAT_MODS,
      payload.setBonusSelections ?? [],
    );

    if (message.id !== currentRunId) {
      return;
    }

    const boundsMsg: WorkerBoundsMessage = {
      type: "bounds",
      id: message.id,
      bounds,
    };
    self.postMessage(boundsMsg);
  } catch (err) {
    const errorMsg: WorkerErrorMessage = {
      type: "error",
      id: message.id,
      message: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(errorMsg);
  }
};
