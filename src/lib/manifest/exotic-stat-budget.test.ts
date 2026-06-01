import { describe, expect, it } from "vitest";
import {
  exoticStatBudgetFromItemSockets,
  investmentStatsToStatTotals,
  mergeExoticStatTotals,
} from "@/lib/manifest/exotic-stat-budget";
import type { ManifestInventoryItemDefinition } from "@/lib/manifest/types";

describe("exotic stat budget", () => {
  it("maps destiny stat hashes to armor stat names", () => {
    const statNameByHash = new Map([
      [1, "Weapons" as const],
      [2, "Health" as const],
    ]);
    const totals = investmentStatsToStatTotals(
      [
        { statTypeHash: 1, value: 42 },
        { statTypeHash: 2, value: 10, isConditionallyActive: true },
      ],
      statNameByHash,
    );
    expect(totals).toEqual({ Weapons: 42 });
  });

  it("reads intrinsic plugs from item socket templates", () => {
    const statPlugs = new Map([
      [100, { stat: "Weapons" as const, value: 30 }],
      [101, { stat: "Health" as const, value: 25 }],
      [102, { stat: "Class" as const, value: 20 }],
    ]);
    const item = {
      hash: 1,
      sockets: {
        socketEntries: [
          { socketTypeHash: 1, singleInitialItemHash: 100 },
          { socketTypeHash: 2, singleInitialItemHash: 101 },
          { socketTypeHash: 3, singleInitialItemHash: 102 },
        ],
      },
    } as ManifestInventoryItemDefinition;

    const totals = exoticStatBudgetFromItemSockets(item, {
      statPlugs,
      tuningPlugStats: new Map(),
      plugToTuning: new Map(),
    });
    expect(totals.Weapons).toBe(30);
    expect(totals.Health).toBe(25);
    expect(totals.Class).toBe(20);
  });

  it("reads stat plugs from reusable plug sets when initial hash is absent", () => {
    const statPlugs = new Map([
      [100, { stat: "Weapons" as const, value: 30 }],
      [101, { stat: "Health" as const, value: 25 }],
      [102, { stat: "Class" as const, value: 20 }],
    ]);
    const item = {
      hash: 1,
      sockets: {
        socketEntries: [
          { socketTypeHash: 1, reusablePlugSetHash: 9000 },
          { socketTypeHash: 2, reusablePlugSetHash: 9001 },
          { socketTypeHash: 3, reusablePlugSetHash: 9002 },
        ],
      },
    } as ManifestInventoryItemDefinition;
    const plugSets = {
      "9000": { hash: 9000, reusablePlugItems: [{ plugItemHash: 100 }] },
      "9001": { hash: 9001, reusablePlugItems: [{ plugItemHash: 101 }] },
      "9002": { hash: 9002, reusablePlugItems: [{ plugItemHash: 102 }] },
    };

    const totals = exoticStatBudgetFromItemSockets(item, {
      statPlugs,
      tuningPlugStats: new Map(),
      plugToTuning: new Map(),
      plugSets,
    });
    expect(totals.Weapons).toBe(30);
    expect(totals.Health).toBe(25);
    expect(totals.Class).toBe(20);
  });

  it("prefers singleInitialItemHash over reusable plug sets", () => {
    const statPlugs = new Map([
      [100, { stat: "Weapons" as const, value: 5 }],
      [200, { stat: "Weapons" as const, value: 99 }],
    ]);
    const item = {
      hash: 1,
      sockets: {
        socketEntries: [
          {
            socketTypeHash: 1,
            singleInitialItemHash: 100,
            reusablePlugSetHash: 9000,
          },
        ],
      },
    } as ManifestInventoryItemDefinition;
    const plugSets = {
      "9000": { hash: 9000, reusablePlugItems: [{ plugItemHash: 200 }] },
    };

    const totals = exoticStatBudgetFromItemSockets(item, {
      statPlugs,
      tuningPlugStats: new Map(),
      plugToTuning: new Map(),
      plugSets,
    });
    expect(totals.Weapons).toBe(5);
  });

  it("mergeExoticStatTotals keeps the higher value per stat", () => {
    expect(
      mergeExoticStatTotals({ Weapons: 10 }, { Weapons: 40 }),
    ).toEqual({ Weapons: 40 });
  });
});
