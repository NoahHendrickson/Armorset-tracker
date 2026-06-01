import { describe, expect, it } from "vitest";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import {
  enrichPieceWithExoticBudget,
  resolveExoticManifestBudget,
  type ExoticStatBudgetLookup,
} from "@/lib/inventory/exotic-stat-fallback";

function exoticPiece(
  overrides: Partial<DerivedArmorPieceJson> = {},
): DerivedArmorPieceJson {
  return {
    itemInstanceId: "ex-1",
    itemHash: 100,
    slot: "classItem",
    classType: 2,
    setHash: null,
    setName: null,
    displayName: "Speaker's Sight",
    isExotic: true,
    archetypeHash: null,
    archetypeName: null,
    tuningHash: null,
    tuningName: null,
    primaryStat: null,
    secondaryStat: null,
    tertiaryStat: null,
    location: { kind: "vault" },
    ...overrides,
  };
}

const BUDGET: ExoticStatBudgetLookup = {
  byItemHash: {
    "200": { Weapons: 42, Health: 30, Class: 20 },
  },
  byIdentity: {
    "classItem\u0000speaker's sight": { Weapons: 42, Health: 30, Class: 20 },
  },
};

describe("exotic stat fallback", () => {
  it("resolves budget by item hash", () => {
    const budget = resolveExoticManifestBudget(
      exoticPiece({ itemHash: 200 }),
      BUDGET,
    );
    expect(budget?.Weapons).toBe(42);
  });

  it("falls back to slot + name identity for reissued hashes", () => {
    const budget = resolveExoticManifestBudget(
      exoticPiece({ itemHash: 999 }),
      BUDGET,
    );
    expect(budget?.Weapons).toBe(42);
  });

  it("enriches pieces missing cached statTotals", () => {
    const enriched = enrichPieceWithExoticBudget(exoticPiece(), BUDGET);
    expect(enriched.statTotals?.Weapons).toBe(42);
    expect(enriched.primaryStat).toBe("Weapons");
  });
});
