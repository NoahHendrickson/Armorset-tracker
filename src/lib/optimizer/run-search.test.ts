import { describe, expect, it } from "vitest";
import { ARMOR_STAT_NAMES } from "@/lib/db/types";
import { SLOT_ORDER } from "@/lib/bungie/constants";
import { mockFivePiecePool, mockPiece } from "@/lib/optimizer/__fixtures__/pieces";
import {
  computeOptimizerSearchBounds,
  runOptimizerSearch,
  runOptimizerSearchSync,
  runWorkerOptimizerSearchSync,
} from "@/lib/optimizer/run-search";
import { searchLoadouts } from "@/lib/optimizer/search";
import type { OptimizerRequest, OptimizerSolution } from "@/lib/optimizer/types";

function normalizeSolutions(solutions: OptimizerSolution[]) {
  return [...solutions]
    .map((solution) => ({
      signature: solution.signature,
      slots: solution.slots,
      totals: solution.totals,
    }))
    .sort((a, b) => a.signature.localeCompare(b.signature));
}

function buildRequest(
  overrides: Partial<OptimizerRequest> = {},
): OptimizerRequest {
  const pool = mockFivePiecePool({
    Weapons: 40,
    Health: 25,
    Class: 20,
    Grenade: 10,
  });
  return {
    pool,
    constraints: ARMOR_STAT_NAMES.map((stat) => ({
      stat,
      min: stat === "Weapons" ? 100 : 0,
    })),
    topN: 20,
    ...overrides,
  };
}

describe("runOptimizerSearch parity", () => {
  it("runOptimizerSearchSync returns the same solutions as searchLoadouts", () => {
    const request = buildRequest();
    const direct = searchLoadouts(request);
    const { solutions } = runOptimizerSearchSync(request);
    expect(normalizeSolutions(solutions)).toEqual(normalizeSolutions(direct));
  });

  it("runWorkerOptimizerSearchSync returns the same solutions as searchLoadouts", () => {
    const request = buildRequest();
    const direct = searchLoadouts(request);
    const { solutions } = runWorkerOptimizerSearchSync(request);
    expect(normalizeSolutions(solutions)).toEqual(normalizeSolutions(direct));
  });

  it("async runOptimizerSearch returns the same solutions as searchLoadouts", async () => {
    const request = buildRequest();
    const direct = searchLoadouts(request);
    const { solutions } = await runOptimizerSearch(request);
    expect(normalizeSolutions(solutions)).toEqual(normalizeSolutions(direct));
  });

  it("main-thread and worker paths agree on solutions with set bonus filters", () => {
    const pool = SLOT_ORDER.flatMap((slot) => [
      mockPiece(slot, `${slot}-10`, { Weapons: 40, Health: 30 }, { setHash: 10 }),
      mockPiece(slot, `${slot}-20`, { Weapons: 35, Health: 20 }, { setHash: 20 }),
    ]);
    const request: OptimizerRequest = {
      pool,
      constraints: ARMOR_STAT_NAMES.map((stat) => ({
        stat,
        min: stat === "Weapons" ? 80 : 0,
      })),
      setBonusSelections: [
        { setHash: 10, requiredCount: 2, perkHash: 1 },
        { setHash: 20, requiredCount: 2, perkHash: 2 },
      ],
      topN: 20,
    };

    const main = runOptimizerSearchSync(request).solutions;
    const worker = runWorkerOptimizerSearchSync(request).solutions;
    const direct = searchLoadouts(request);

    expect(normalizeSolutions(main)).toEqual(normalizeSolutions(direct));
    expect(normalizeSolutions(worker)).toEqual(normalizeSolutions(direct));
  });

  it("computeOptimizerSearchBounds matches between main and worker on small pools", () => {
    const request = buildRequest();
    const mainBounds = computeOptimizerSearchBounds(request);
    const workerBounds = computeOptimizerSearchBounds(request, {
      omitWhenSearchTooLarge: true,
    });
    expect(workerBounds).toEqual(mainBounds);
  });

  it("worker omits bounds on large vaults while main thread still computes them", () => {
    const pool = SLOT_ORDER.flatMap((slot) =>
      Array.from({ length: 10 }, (_, index) =>
        mockPiece(slot, `${slot}-${index}`, {
          Weapons: 40 + index,
          Health: 25,
        }),
      ),
    );
    const request = buildRequest({ pool });
    const mainBounds = computeOptimizerSearchBounds(request);
    const workerBounds = computeOptimizerSearchBounds(request, {
      omitWhenSearchTooLarge: true,
    });
    expect(mainBounds).not.toBeNull();
    expect(workerBounds).toBeNull();
    expect(runWorkerOptimizerSearchSync(request).solutions.length).toBeGreaterThan(
      0,
    );
  });
});
