import { describe, expect, it } from "vitest";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import { ARMOR_STAT_NAMES } from "@/lib/db/types";
import { SLOT_ORDER } from "@/lib/bungie/constants";
import {
  DEFAULT_ASSUMED_STAT_MODS,
  MAJOR_ARMOR_STAT_MOD,
  MINOR_ARMOR_STAT_MOD,
  totalAssumedModBudget,
} from "@/lib/optimizer/mod-offset";
import {
  maxVerifiedTotalSum,
  resolveLoadoutTotals,
} from "@/lib/optimizer/resolve-loadout-totals";

function mockPiece(
  slot: DerivedArmorPieceJson["slot"],
  id: string,
  statTotals: Partial<Record<string, number>>,
  extra: Partial<DerivedArmorPieceJson> = {},
): DerivedArmorPieceJson {
  return {
    itemInstanceId: id,
    itemHash: 1,
    slot,
    classType: 0,
    setHash: 1,
    setName: "Test",
    displayName: "Test",
    archetypeHash: 1,
    archetypeName: "Gunner",
    tuningHash: 1,
    tuningName: "+Weapons / -Grenade",
    primaryStat: "Weapons",
    secondaryStat: "Health",
    tertiaryStat: "Class",
    statTotals: statTotals as DerivedArmorPieceJson["statTotals"],
    location: { kind: "vault" },
    ...extra,
  };
}

function fivePiecePool(
  perSlot: Partial<Record<string, number>>,
  slotOverrides: Partial<
    Record<DerivedArmorPieceJson["slot"], Partial<DerivedArmorPieceJson>>
  > = {},
): DerivedArmorPieceJson[] {
  return SLOT_ORDER.map((slot) => {
    const override = slotOverrides[slot] ?? {};
    return mockPiece(slot, `id-${slot}`, perSlot, override);
  });
}

describe("totalAssumedModBudget", () => {
  it("returns 50 total mod points for 5 majors, not per target stat", () => {
    const budget = totalAssumedModBudget({ majorCount: 5 });
    expect(budget.majorTotal).toBe(50);
    expect(budget.total).toBe(50);
  });

  it("fills unfilled slots with minor mods", () => {
    const budget = totalAssumedModBudget({ majorCount: 3 });
    expect(budget.majorTotal).toBe(MAJOR_ARMOR_STAT_MOD * 3);
    expect(budget.minorTotal).toBe(MINOR_ARMOR_STAT_MOD * 2);
    expect(budget.total).toBe(40);
  });
});

describe("resolveLoadoutTotals", () => {
  it("adds up to +50 on a single target with five committed pieces", () => {
    const pieces = fivePiecePool({
      Weapons: 30,
      Health: 25,
      Class: 20,
    });
    const resolved = resolveLoadoutTotals(
      pieces,
      [{ stat: "Weapons", min: 150 }],
      {},
      { majorCount: 5 },
    );
    expect(resolved).not.toBeNull();
    expect(resolved!.totals.Weapons).toBe(150);
    const armorSum = 30 * 5 + 25 * 5 + 20 * 5;
    expect(
      ARMOR_STAT_NAMES.reduce((sum, stat) => sum + resolved!.totals[stat], 0),
    ).toBeLessThanOrEqual(armorSum + 50);
  });

  it("cannot zero out both debuff penalties from uncommitted variants", () => {
    const pieces = fivePiecePool(
      { Weapons: 30, Health: 25, Class: 20, Grenade: 10, Melee: 10 },
      {
        helmet: {
          tuningCommitted: false,
          tuningVariants: [
            { Weapons: 35, Health: 25, Class: 20, Grenade: 5, Melee: 10 },
            { Weapons: 35, Health: 25, Class: 20, Grenade: 10, Melee: 5 },
          ],
        },
      },
    );
    const resolved = resolveLoadoutTotals(
      pieces,
      ARMOR_STAT_NAMES.map((stat) => ({ stat, min: 0 })),
      {},
      DEFAULT_ASSUMED_STAT_MODS,
    );
    expect(resolved).not.toBeNull();
    const helmetBranch = resolved!.tuningBySlot?.helmet;
    expect(helmetBranch).toBeDefined();
    const grenade = helmetBranch!.Grenade ?? 10;
    const melee = helmetBranch!.Melee ?? 10;
    expect(grenade === 5 || melee === 5).toBe(true);
    expect(grenade === 10 && melee === 10).toBe(false);
  });

  it("assigns split major/minor mods across multiple targets without exceeding cap", () => {
    const pieces = fivePiecePool({
      Weapons: 38,
      Health: 25,
      Class: 20,
      Grenade: 20,
      Melee: 13,
      Super: 10,
    });
    const resolved = resolveLoadoutTotals(
      pieces,
      [
        { stat: "Weapons", min: 200 },
        { stat: "Health", min: 50 },
        { stat: "Grenade", min: 100 },
        { stat: "Melee", min: 63 },
      ],
      {},
      { majorCount: 3 },
    );
    expect(resolved).not.toBeNull();
    expect(resolved!.totals.Weapons).toBeGreaterThanOrEqual(200);
    expect(resolved!.totals.Weapons).toBeLessThanOrEqual(210);
    expect(resolved!.totals.Health).toBeGreaterThanOrEqual(50);
    expect(resolved!.totals.Grenade).toBeGreaterThanOrEqual(100);
    expect(resolved!.totals.Melee).toBeGreaterThanOrEqual(63);
  });

  it("rejects loadouts that need more mod points than the shared pool", () => {
    const pieces = fivePiecePool({ Weapons: 10 });
    const resolved = resolveLoadoutTotals(
      pieces,
      ARMOR_STAT_NAMES.map((stat) => ({
        stat,
        min: stat === "Weapons" ? 200 : 0,
      })),
      {},
      { majorCount: 5 },
    );
    expect(resolved).toBeNull();
  });

  it("caps total sum at armor + mod pool + fragments for many active targets", () => {
    const pieces = fivePiecePool({
      Weapons: 40,
      Health: 25,
      Class: 20,
      Grenade: 10,
    });
    const constraints = ARMOR_STAT_NAMES.map((stat) => ({
      stat,
      min: stat === "Weapons" ? 200 : stat === "Health" ? 50 : 50,
    }));
    const fragmentOffset = { Grenade: 10 };
    const assumedMods = { majorCount: 5 };

    const resolved = resolveLoadoutTotals(
      pieces,
      constraints,
      fragmentOffset,
      assumedMods,
    );

    const ceiling = maxVerifiedTotalSum(pieces, fragmentOffset, assumedMods);
    if (resolved != null) {
      const sum = ARMOR_STAT_NAMES.reduce(
        (acc, stat) => acc + resolved.totals[stat],
        0,
      );
      expect(sum).toBeLessThanOrEqual(ceiling);
    }
  });
});
