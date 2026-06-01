import { describe, expect, it } from "vitest";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import { computeStatBounds } from "@/lib/optimizer/bounds";
import { filterOptimizerPool } from "@/lib/optimizer/pool";
import type { ExoticStatBudgetLookup } from "@/lib/inventory/exotic-stat-fallback";

function mockPiece(
  slot: DerivedArmorPieceJson["slot"],
  id: string,
  statTotals: Partial<Record<string, number>>,
  options: { isExotic?: boolean } = {},
): DerivedArmorPieceJson {
  return {
    itemInstanceId: id,
    itemHash: 1,
    slot,
    classType: 0,
    setHash: 1,
    setName: "Test",
    displayName: "Test",
    isExotic: options.isExotic,
    archetypeHash: 1,
    archetypeName: "Gunner",
    tuningHash: 1,
    tuningName: "+Weapons",
    primaryStat: "Weapons",
    secondaryStat: "Health",
    tertiaryStat: "Class",
    statTotals: statTotals as DerivedArmorPieceJson["statTotals"],
    location: { kind: "vault" },
  };
}

describe("computeStatBounds", () => {
  it("sums per-slot extrema across five slots", () => {
    const pool: DerivedArmorPieceJson[] = [
      mockPiece("helmet", "h1", { Weapons: 40, Health: 25 }),
      mockPiece("helmet", "h2", { Weapons: 35, Health: 30 }),
      mockPiece("arms", "a1", { Weapons: 30, Health: 20 }),
      mockPiece("chest", "c1", { Weapons: 32, Health: 22 }),
      mockPiece("legs", "l1", { Weapons: 28, Health: 18 }),
      mockPiece("classItem", "ci1", { Weapons: 26, Health: 16 }),
    ];

    const bounds = computeStatBounds(pool);
    expect(bounds.Weapons).toEqual({
      min: 35 + 30 + 32 + 28 + 26,
      max: 40 + 30 + 32 + 28 + 26,
    });
    expect(bounds.Health).toEqual({
      min: 25 + 20 + 22 + 18 + 16,
      max: 30 + 20 + 22 + 18 + 16,
    });
  });

  it("returns zeros when any slot is empty", () => {
    const pool = [mockPiece("helmet", "h1", { Weapons: 40 })];
    const bounds = computeStatBounds(pool);
    expect(bounds.Weapons).toEqual({ min: 0, max: 0 });
  });

  it("applies a flat stat offset from fragments", () => {
    const pool: DerivedArmorPieceJson[] = [
      mockPiece("helmet", "h1", { Weapons: 40 }),
      mockPiece("arms", "a1", { Weapons: 40 }),
      mockPiece("chest", "c1", { Weapons: 40 }),
      mockPiece("legs", "l1", { Weapons: 40 }),
      mockPiece("classItem", "ci1", { Weapons: 40 }),
    ];
    const bounds = computeStatBounds(pool, { Grenade: 10 });
    expect(bounds.Grenade.min).toBe(10);
    expect(bounds.Grenade.max).toBe(10);
    expect(bounds.Weapons.min).toBe(200);
  });

  it("counts at most one exotic when mode is any", () => {
    const pool: DerivedArmorPieceJson[] = [
      mockPiece("helmet", "ex-h", { Weapons: 100 }, { isExotic: true }),
      mockPiece("helmet", "leg-h", { Weapons: 10 }),
      mockPiece("chest", "ex-c", { Weapons: 100 }, { isExotic: true }),
      mockPiece("chest", "leg-c", { Weapons: 10 }),
      mockPiece("arms", "a1", { Weapons: 10 }),
      mockPiece("legs", "l1", { Weapons: 10 }),
      mockPiece("classItem", "ci1", { Weapons: 10 }),
    ];

    const bounds = computeStatBounds(pool, undefined, { mode: "any" });
    expect(bounds.Weapons.max).toBe(140);
  });

  it("includes an exotic-only slot when computing bounds", () => {
    const pool: DerivedArmorPieceJson[] = [
      mockPiece("classItem", "ex-ci", { Weapons: 55 }, { isExotic: true }),
      mockPiece("helmet", "h1", { Weapons: 40 }),
      mockPiece("arms", "a1", { Weapons: 40 }),
      mockPiece("chest", "c1", { Weapons: 40 }),
      mockPiece("legs", "l1", { Weapons: 40 }),
    ];

    const bounds = computeStatBounds(pool, undefined, {
      mode: "locked",
      itemInstanceId: "ex-ci",
      slot: "classItem",
    });
    expect(bounds.Weapons.max).toBeGreaterThan(0);
    expect(bounds.Weapons.max).toBe(55 + 40 * 4);
  });

  it("uses only the locked exotic in its slot for max bounds", () => {
    const pool: DerivedArmorPieceJson[] = [
      mockPiece("helmet", "ex-h", { Weapons: 30 }, { isExotic: true }),
      mockPiece("helmet", "leg-h", { Weapons: 50 }),
      mockPiece("arms", "a1", { Weapons: 10 }),
      mockPiece("chest", "c1", { Weapons: 10 }),
      mockPiece("legs", "l1", { Weapons: 10 }),
      mockPiece("classItem", "ci1", { Weapons: 10 }),
    ];

    const bounds = computeStatBounds(pool, undefined, {
      mode: "locked",
      itemInstanceId: "ex-h",
      slot: "helmet",
    });
    expect(bounds.Weapons.max).toBe(70);
  });

  it("bounds work for locked exotic without cached statTotals when manifest budget exists", () => {
    const exotic: DerivedArmorPieceJson = {
      ...mockPiece("classItem", "speakers-sight", {}, { isExotic: true }),
      itemHash: 4242,
      displayName: "Speaker's Sight",
      classType: 2,
      statTotals: undefined,
      primaryStat: null,
      secondaryStat: null,
      tertiaryStat: null,
    };
    const leg = (slot: DerivedArmorPieceJson["slot"], id: string) => ({
      ...mockPiece(slot, id, {
        Weapons: 40,
        Health: 25,
        Class: 20,
        Grenade: -10,
      }),
      classType: 2,
      tier: 5,
    });
    const inventory: DerivedArmorPieceJson[] = [
      exotic,
      leg("helmet", "h1"),
      leg("arms", "a1"),
      leg("chest", "c1"),
      leg("legs", "l1"),
    ];
    const budget: ExoticStatBudgetLookup = {
      byItemHash: {
        "4242": { Weapons: 55, Health: 25, Class: 20 },
      },
      byIdentity: {
        "classItem\u0000speaker's sight": { Weapons: 55, Health: 25, Class: 20 },
      },
    };
    const pool = filterOptimizerPool(inventory, 2, {
      exoticLock: {
        mode: "locked",
        itemInstanceId: "speakers-sight",
        slot: "classItem",
      },
      exoticStatBudget: budget,
    });
    const bounds = computeStatBounds(pool, undefined, {
      mode: "locked",
      itemInstanceId: "speakers-sight",
      slot: "classItem",
    });
    expect(bounds.Weapons.max).toBe(55 + 40 * 4);
    expect(bounds.Weapons.min).toBeGreaterThan(0);
  });
});
