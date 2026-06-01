import { describe, expect, it } from "vitest";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import { ARMOR_STAT_NAMES } from "@/lib/db/types";
import {
  satisfiesConstraints,
  totalsFromPieces,
} from "@/lib/optimizer/constraints";
import { searchLoadouts } from "@/lib/optimizer/search";
import { SLOT_ORDER } from "@/lib/bungie/constants";

function mockPiece(
  slot: DerivedArmorPieceJson["slot"],
  id: string,
  statTotals: Partial<Record<string, number>>,
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
  };
}

describe("searchLoadouts", () => {
  it("returns solutions for a minimal five-piece pool", () => {
    const pool = SLOT_ORDER.map((slot, index) =>
      mockPiece(slot, `id-${slot}`, {
        Weapons: 40,
        Health: 25,
        Class: 20,
        Grenade: 10,
      }),
    );
    const solutions = searchLoadouts({
      pool,
      constraints: ARMOR_STAT_NAMES.map((stat) => ({
        stat,
        min: 0,
      })),
    });
    expect(solutions.length).toBeGreaterThan(0);
  });

  it("rejects negative stat totals when min is pinned at zero", () => {
    const totals = totalsFromPieces([
      mockPiece("helmet", "h1", { Grenade: -10 }),
    ]);
    const constraints = ARMOR_STAT_NAMES.map((stat) => ({
      stat,
      min: 0,
    }));
    expect(satisfiesConstraints(totals, constraints)).toBe(false);
  });

  it("enforces set bonus piece counts", () => {
    const pool = SLOT_ORDER.map((slot, index) => ({
      ...mockPiece(slot, `id-${slot}`, { Weapons: 40 }),
      setHash: index < 2 ? 10 : 20,
    }));
    const solutions = searchLoadouts({
      pool,
      constraints: [{ stat: "Weapons", min: 0 }],
      setBonusSelections: [{ setHash: 10, requiredCount: 2, perkHash: 1 }],
    });
    expect(solutions.length).toBeGreaterThan(0);
    for (const solution of solutions) {
      const pieces = SLOT_ORDER.map(
        (slot) => pool.find((p) => p.itemInstanceId === solution.slots[slot])!,
      );
      const count10 = pieces.filter((p) => p.setHash === 10).length;
      expect(count10).toBeGreaterThanOrEqual(2);
    }
  });

  it("counts alternate tuning branches toward stat targets", () => {
    const pool = SLOT_ORDER.map((slot, index) => {
      if (index === 0) {
        return {
          ...mockPiece(slot, `id-${slot}`, { Weapons: 30 }),
          tuningVariants: [{ Weapons: 39 }],
        };
      }
      return mockPiece(slot, `id-${slot}`, { Weapons: 25 });
    });
    const solutions = searchLoadouts({
      pool,
      constraints: ARMOR_STAT_NAMES.map((stat) => ({
        stat,
        min: stat === "Weapons" ? 139 : 0,
      })),
      statOffset: { Weapons: 0 },
    });
    expect(solutions.length).toBeGreaterThan(0);
    expect(solutions[0]!.totals.Weapons).toBeGreaterThanOrEqual(139);
  });
});
