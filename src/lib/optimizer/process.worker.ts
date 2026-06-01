/// <reference lib="webworker" />

import { computeStatBounds } from "@/lib/optimizer/bounds";
import { searchLoadouts } from "@/lib/optimizer/search";
import type { WorkerRequest, WorkerResponse } from "@/lib/optimizer/types";

let cancelled = false;
let currentRunId: string | null = null;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type === "cancel") {
    if (message.id === currentRunId) cancelled = true;
    return;
  }

  currentRunId = message.id;
  cancelled = false;

  try {
    const bounds = computeStatBounds(
      message.payload.pool,
      message.payload.statOffset,
      message.payload.exoticLock,
    );
    const boundsMsg: WorkerResponse = {
      type: "bounds",
      id: message.id,
      bounds,
    };
    self.postMessage(boundsMsg);

    const solutions = searchLoadouts(
      message.payload,
      (percent) => {
        if (cancelled) return;
        const progressMsg: WorkerResponse = {
          type: "progress",
          id: message.id,
          percent,
        };
        self.postMessage(progressMsg);
      },
      () => cancelled,
    );

    if (cancelled) return;

    const resultMsg: WorkerResponse = {
      type: "result",
      id: message.id,
      solutions,
    };
    self.postMessage(resultMsg);
  } catch (err) {
    const errorMsg: WorkerResponse = {
      type: "error",
      id: message.id,
      message: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(errorMsg);
  }
};
