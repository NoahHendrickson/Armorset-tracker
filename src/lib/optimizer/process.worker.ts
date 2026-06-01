/// <reference lib="webworker" />

import { runWorkerOptimizerSearchSync } from "@/lib/optimizer/run-search";
import type { WorkerRequest, WorkerResponse } from "@/lib/optimizer/types";

let currentRunId: string | null = null;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type !== "run") {
    return;
  }

  currentRunId = message.id;

  try {
    const progressMsg = (percent: number): WorkerResponse => ({
      type: "progress",
      id: message.id,
      percent,
    });
    self.postMessage(progressMsg(0));

    const { bounds, solutions } = runWorkerOptimizerSearchSync(
      message.payload,
      (percent) => {
        if (message.id !== currentRunId) return;
        self.postMessage(progressMsg(percent));
      },
      () => message.id !== currentRunId,
    );

    if (message.id !== currentRunId) return;

    if (bounds != null) {
      const boundsMsg: WorkerResponse = {
        type: "bounds",
        id: message.id,
        bounds,
      };
      self.postMessage(boundsMsg);
    }

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
