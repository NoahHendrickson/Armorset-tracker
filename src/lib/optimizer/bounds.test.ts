import { describe, expect, it } from "vitest";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import { ARMOR_STAT_NAMES } from "@/lib/db/types";
import { computeStatBounds, estimateOptimizerComboCount } from "@/lib/optimizer/bounds";
import { maxFeasibleStatTarget } from "@/lib/optimizer/combo-count";
import { defaultStatConstraints } from "@/lib/optimizer/constraints";
import { filterOptimizerPool } from "@/lib/optimizer/pool";
import type { ExoticStatBudgetLookup } from "@/lib/inventory/exotic-stat-fallback";
import { NO_ASSUMED_STAT_MODS } from "@/lib/optimizer/mod-offset";

const NO_ASSUMED_MODS = NO_ASSUMED_STAT_MODS;

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

    const bounds = computeStatBounds(
      pool,
      undefined,
      { mode: "none" },
      undefined,
      NO_ASSUMED_MODS,
    );
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
    const bounds = computeStatBounds(
      pool,
      undefined,
      { mode: "none" },
      undefined,
      NO_ASSUMED_MODS,
    );
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
    const bounds = computeStatBounds(
      pool,
      { Grenade: 10 },
      { mode: "none" },
      undefined,
      NO_ASSUMED_MODS,
    );
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

    const bounds = computeStatBounds(
      pool,
      undefined,
      { mode: "any" },
      undefined,
      NO_ASSUMED_MODS,
    );
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

    const bounds = computeStatBounds(
      pool,
      undefined,
      {
        mode: "locked",
        itemInstanceId: "ex-ci",
        slot: "classItem",
      },
      undefined,
      NO_ASSUMED_MODS,
    );
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

    const bounds = computeStatBounds(
      pool,
      undefined,
      {
        mode: "locked",
        itemInstanceId: "ex-h",
        slot: "helmet",
      },
      undefined,
      NO_ASSUMED_MODS,
    );
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
        Weapons: 35,
        Health: 25,
        Class: 20,
        Grenade: -5,
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
    const bounds = computeStatBounds(
      pool,
      undefined,
      {
        mode: "locked",
        itemInstanceId: "speakers-sight",
        slot: "classItem",
      },
      undefined,
      NO_ASSUMED_MODS,
    );
    expect(bounds.Weapons.max).toBe(55 + 35 * 4);
    expect(bounds.Weapons.min).toBeGreaterThan(0);
  });

  it("estimates deduped five-slot combination count", () => {
    const slots = [
      "helmet",
      "arms",
      "chest",
      "legs",
      "classItem",
    ] as const;
    const pool: DerivedArmorPieceJson[] = [];
    for (const slot of slots) {
      pool.push(
        mockPiece(slot, `${slot}-1`, { Weapons: 40, Health: 25 }),
        mockPiece(slot, `${slot}-2`, { Weapons: 35, Health: 30 }),
      );
    }
    expect(estimateOptimizerComboCount(pool)).toBe(2 ** 5);
  });

  it("shrinks achievable max for other stats when a stat target is pinned high", () => {
    const slots = [
      "helmet",
      "arms",
      "chest",
      "legs",
      "classItem",
    ] as const;
    const pool: DerivedArmorPieceJson[] = [];
    for (const slot of slots) {
      pool.push(
        mockPiece(slot, `${slot}-w`, { Weapons: 40, Grenade: 5 }),
        mockPiece(slot, `${slot}-g`, { Weapons: 10, Grenade: 35 }),
      );
    }

    const independent = computeStatBounds(
      pool,
      undefined,
      { mode: "none" },
      undefined,
      NO_ASSUMED_MODS,
    );
    expect(independent.Grenade.max).toBe(35 * 5);

    const constraints = defaultStatConstraints().map((row) =>
      row.stat === "Weapons" ? { ...row, min: 200 } : row,
    );
    const constrained = computeStatBounds(
      pool,
      undefined,
      { mode: "none" },
      constraints,
      NO_ASSUMED_MODS,
    );
    expect(constrained.Grenade.max).toBe(5 * 5);
    expect(constrained.Grenade.max).toBeLessThan(independent.Grenade.max);
  });

  it("shrinks achievable max when multiple stats compete for the mod pool", () => {
    const slots = [
      "helmet",
      "arms",
      "chest",
      "legs",
      "classItem",
    ] as const;
    const pool: DerivedArmorPieceJson[] = [];
    for (const slot of slots) {
      pool.push(
        mockPiece(slot, `${slot}-w`, { Weapons: 40, Grenade: 5, Super: 10 }),
        mockPiece(slot, `${slot}-g`, { Weapons: 10, Grenade: 35, Super: 20 }),
      );
    }

    const independent = computeStatBounds(
      pool,
      undefined,
      { mode: "none" },
      undefined,
      { majorCount: 5, slotFill: true, artifice: true },
    );
    expect(independent.Grenade.max).toBe(35 * 5 + 50);

    const constraints = [
      { stat: "Weapons" as const, min: 196 },
      { stat: "Grenade" as const, min: 100 },
    ];
    const bounds = computeStatBounds(
      pool,
      undefined,
      { mode: "none" },
      constraints,
      { majorCount: 5, slotFill: true, artifice: true },
    );
    expect(bounds.Grenade.max).toBeLessThan(independent.Grenade.max);
    expect(bounds.Grenade.max).toBeLessThan(200);
    expect(bounds.Grenade.max).toBeLessThanOrEqual(
      maxFeasibleStatTarget(
        pool,
        { mode: "none" },
        constraints,
        "Grenade",
        {
          assumedMods: { majorCount: 5, slotFill: true, artifice: true },
          hi: independent.Grenade.max,
        },
      ),
    );
  });

  it("includes assumed mod budget in joint bounds for targeted stats", () => {
    const pool = ARMOR_STAT_NAMES.map((_, index) =>
      mockPiece(
        ["helmet", "arms", "chest", "legs", "classItem"][index]! as DerivedArmorPieceJson["slot"],
        `p${index}`,
        { Weapons: 30, Grenade: 10 },
      ),
    );
    const constraints = defaultStatConstraints().map((row) =>
      row.stat === "Weapons" ? { ...row, min: 200 } : row,
    );
    const bounds = computeStatBounds(
      pool,
      undefined,
      { mode: "none" },
      constraints,
      { majorCount: 5 },
    );
    expect(bounds.Weapons.min).toBeGreaterThanOrEqual(150);
    expect(bounds.Weapons.max).toBeGreaterThanOrEqual(150);
    expect(bounds.Weapons.max).toBeLessThanOrEqual(30 * 5 + 50);
  });

  it("tightens gray-band max using filtered combo count, not raw pool size", () => {
    const slots = [
      "helmet",
      "arms",
      "chest",
      "legs",
      "classItem",
    ] as const;
    const pool: DerivedArmorPieceJson[] = [];
    for (const slot of slots) {
      pool.push(
        mockPiece(slot, `${slot}-high`, { Weapons: 40, Grenade: 5 }),
      );
      for (let i = 0; i < 8; i++) {
        pool.push(
          mockPiece(slot, `${slot}-low${i}`, {
            Weapons: 10 + (i % 4),
            Grenade: 35 + (i % 3),
          }),
        );
      }
    }
    expect(estimateOptimizerComboCount(pool)).toBeGreaterThan(50_000);

    const constraints = ARMOR_STAT_NAMES.map((stat) => ({
      stat,
      min: 0,
    }));
    constraints.find((row) => row.stat === "Weapons")!.min = 200;

    const independent = computeStatBounds(
      pool,
      undefined,
      { mode: "none" },
      undefined,
      { majorCount: 5, slotFill: true, artifice: true },
    );
    expect(independent.Grenade.max).toBeGreaterThan(150);

    const constrained = computeStatBounds(
      pool,
      undefined,
      { mode: "none" },
      constraints,
      { majorCount: 5, slotFill: true, artifice: true },
    );
    expect(constrained.Grenade.max).toBeLessThan(independent.Grenade.max);
    expect(constrained.Grenade.max).toBeLessThan(200);
  });
});

describe("estimateOptimizerComboCount", () => {
  function slotPieces(
    slot: DerivedArmorPieceJson["slot"],
    legendaryCount: number,
    exoticCount = 0,
  ): DerivedArmorPieceJson[] {
    const pieces: DerivedArmorPieceJson[] = [];
    for (let i = 0; i < legendaryCount; i++) {
      pieces.push(
        mockPiece(slot, `${slot}-l${i}`, {
          Weapons: 40 + i,
          Health: 25,
        }),
      );
    }
    for (let i = 0; i < exoticCount; i++) {
      pieces.push(
        mockPiece(
          slot,
          `${slot}-x${i}`,
          { Weapons: 55 + i },
          { isExotic: true },
        ),
      );
    }
    return pieces;
  }

  it("counts at most one exotic when mode is any", () => {
    const pool = [
      ...slotPieces("helmet", 2, 1),
      ...slotPieces("arms", 2, 1),
      ...slotPieces("chest", 2, 1),
      ...slotPieces("legs", 2, 1),
      ...slotPieces("classItem", 2, 1),
    ];
    const naiveProduct = Math.pow(3, 5);
    const anyCount = estimateOptimizerComboCount(pool, { mode: "any" });
    expect(anyCount).toBeLessThan(naiveProduct);
    expect(anyCount).toBe(2 ** 5 + 5 * 1 * 2 ** 4);
  });

  it("shrinks dramatically when an exotic is locked to one slot", () => {
    const pool = [
      ...slotPieces("helmet", 20, 2),
      ...slotPieces("arms", 20, 2),
      ...slotPieces("chest", 20, 2),
      ...slotPieces("legs", 20, 2),
      ...slotPieces("classItem", 20, 2),
    ];
    const anyCount = estimateOptimizerComboCount(pool, { mode: "any" });
    const lockedCount = estimateOptimizerComboCount(pool, {
      mode: "locked",
      itemInstanceId: "helmet-x0",
      slot: "helmet",
    });
    expect(lockedCount).toBeLessThan(anyCount);
    expect(lockedCount).toBe(2 * 20 ** 4);
  });
});
