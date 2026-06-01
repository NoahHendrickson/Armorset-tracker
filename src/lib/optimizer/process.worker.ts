/// <reference lib="webworker" />

import { computeStatBounds, SEARCH_AUTO_RUN_COMBO_LIMIT } from "@/lib/optimizer/bounds";
import { estimateOptimizerComboCount } from "@/lib/optimizer/combo-count";
import { DEFAULT_EXOTIC_LOCK } from "@/lib/optimizer/exotic-lock";
import { searchLoadouts } from "@/lib/optimizer/search";
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

    const exoticLock = message.payload.exoticLock ?? DEFAULT_EXOTIC_LOCK;
    const comboCount = estimateOptimizerComboCount(
      message.payload.pool,
      exoticLock,
    );

    if (comboCount <= SEARCH_AUTO_RUN_COMBO_LIMIT) {
      const bounds = computeStatBounds(
        message.payload.pool,
        message.payload.statOffset,
        exoticLock,
        message.payload.constraints,
        message.payload.assumedStatMods,
      );
      const boundsMsg: WorkerResponse = {
        type: "bounds",
        id: message.id,
        bounds,
      };
      self.postMessage(boundsMsg);
    }

    const solutions = searchLoadouts(
      message.payload,
      (percent) => {
        if (message.id !== currentRunId) return;
        self.postMessage(progressMsg(percent));
      },
      () => message.id !== currentRunId,
    );

    if (message.id !== currentRunId) return;

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
