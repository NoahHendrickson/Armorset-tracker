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
        min: stat === "Weapons" ? 100 : 0,
      })),
    });
    expect(solutions.length).toBeGreaterThan(0);
  });

  it("floors negative stat totals to zero for constraint checks", () => {
    const totals = totalsFromPieces([
      mockPiece("helmet", "h1", { Grenade: -5 }),
    ]);
    const constraints = ARMOR_STAT_NAMES.map((stat) => ({
      stat,
      min: 0,
    }));
    expect(totals.Grenade).toBe(-5);
    expect(satisfiesConstraints(totals, constraints)).toBe(true);
  });

  it("still searches when set bonuses and stat targets are both active", () => {
    const pool = SLOT_ORDER.flatMap((slot) => [
      {
        ...mockPiece(slot, `${slot}-10`, { Weapons: 40, Health: 30 }),
        setHash: 10,
      },
      {
        ...mockPiece(slot, `${slot}-20`, { Weapons: 35, Health: 20 }),
        setHash: 20,
      },
    ]);
    const solutions = searchLoadouts({
      pool,
      constraints: [
        { stat: "Weapons", min: 180 },
        { stat: "Health", min: 100 },
      ],
      setBonusSelections: [
        { setHash: 10, requiredCount: 2, perkHash: 1 },
        { setHash: 20, requiredCount: 2, perkHash: 2 },
      ],
      assumedStatMods: { majorCount: 5 },
    });
    expect(solutions.length).toBeGreaterThan(0);
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

  it("uses verified tuning branches for uncommitted pieces", () => {
    const pool = SLOT_ORDER.map((slot, index) => {
      if (index === 0) {
        return {
          ...mockPiece(slot, `id-${slot}`, {
            Weapons: 30,
            Grenade: 10,
            Melee: 10,
          }),
          tuningCommitted: false,
          tuningVariants: [
            { Weapons: 35, Grenade: 5, Melee: 10 },
            { Weapons: 39, Grenade: 10, Melee: 10 },
          ],
        };
      }
      return mockPiece(slot, `id-${slot}`, { Weapons: 25 });
    });
    const solutions = searchLoadouts({
      pool,
      constraints: ARMOR_STAT_NAMES.map((stat) => ({
        stat,
        min: stat === "Weapons" ? 135 : 0,
      })),
      assumedStatMods: { majorCount: 0, slotFill: false },
    });
    expect(solutions.length).toBeGreaterThan(0);
    expect(solutions[0]!.totals.Weapons).toBeGreaterThanOrEqual(135);
    expect(solutions[0]!.totals.Weapons).toBeLessThanOrEqual(39 + 25 * 4);
    const helmetBranch = solutions[0]!.resolved?.tuningBySlot?.helmet;
    expect(helmetBranch).toBeDefined();
    expect(helmetBranch!.Weapons).toBeGreaterThanOrEqual(35);
  });

  it("finds builds when stat mins require assumed mods during branch pruning", () => {
    const pool = SLOT_ORDER.map((slot) =>
      mockPiece(slot, `id-${slot}`, {
        Weapons: 30,
        Health: 25,
        Class: 20,
        Grenade: 10,
        Melee: 10,
        Super: 10,
      }),
    );
    const solutions = searchLoadouts({
      pool,
      constraints: [{ stat: "Weapons", min: 158 }],
      assumedStatMods: { majorCount: 4 },
    });
    expect(solutions.length).toBeGreaterThan(0);
    expect(solutions[0]!.totals.Weapons).toBeGreaterThanOrEqual(158);
  });

  it("finds builds with dual set bonuses, locked exotic, and mod-assisted mins", () => {
    const pool = SLOT_ORDER.flatMap((slot) => {
      const pieces = [
        mockPiece(
          slot,
          `${slot}-10`,
          {
            Weapons: 30,
            Health: 25,
            Class: 20,
            Grenade: 10,
            Melee: 10,
            Super: 10,
          },
          { setHash: 10 },
        ),
        mockPiece(
          slot,
          `${slot}-20`,
          {
            Weapons: 28,
            Health: 25,
            Class: 20,
            Grenade: 10,
            Melee: 10,
            Super: 10,
          },
          { setHash: 20 },
        ),
      ];
      if (slot === "helmet") {
        pieces.push({
          ...mockPiece(
            slot,
            "helmet-x",
            {
              Weapons: 35,
              Health: 20,
              Class: 15,
              Grenade: 10,
              Melee: 10,
              Super: 10,
            },
            { setHash: 99 },
          ),
          isExotic: true,
        });
      }
      return pieces;
    });
    const solutions = searchLoadouts({
      pool,
      constraints: [
        { stat: "Weapons", min: 158 },
        { stat: "Health", min: 14 },
        { stat: "Class", min: 50 },
        { stat: "Grenade", min: 55 },
        { stat: "Melee", min: 12 },
        { stat: "Super", min: 65 },
      ],
      setBonusSelections: [
        { setHash: 10, requiredCount: 2, perkHash: 1 },
        { setHash: 20, requiredCount: 2, perkHash: 2 },
      ],
      assumedStatMods: { majorCount: 4 },
      exoticLock: {
        mode: "locked",
        itemInstanceId: "helmet-x",
        slot: "helmet",
      },
    });
    expect(solutions.length).toBeGreaterThan(0);
  });

  it("finds warlock-style multi-target builds with dual 2pc sets", () => {
    const pool = SLOT_ORDER.flatMap((slot) => {
      const pieces = [
        mockPiece(
          slot,
          `${slot}-ferro`,
          {
            Weapons: 40,
            Health: 22,
            Class: 14,
            Grenade: 20,
            Melee: 8,
            Super: 14,
          },
          { setHash: 10, setName: "Ferropotent", classType: 2 },
        ),
        mockPiece(
          slot,
          `${slot}-smoke`,
          {
            Weapons: 38,
            Health: 24,
            Class: 12,
            Grenade: 22,
            Melee: 9,
            Super: 13,
          },
          { setHash: 20, setName: "Smoke Jumper", classType: 2 },
        ),
      ];
      return pieces;
    });
    const solutions = searchLoadouts({
      pool,
      constraints: [
        { stat: "Weapons", min: 200 },
        { stat: "Health", min: 10 },
        { stat: "Class", min: 50 },
        { stat: "Grenade", min: 100 },
        { stat: "Melee", min: 10 },
        { stat: "Super", min: 70 },
      ],
      setBonusSelections: [
        { setHash: 10, requiredCount: 2, perkHash: 1 },
        { setHash: 20, requiredCount: 2, perkHash: 2 },
      ],
      assumedStatMods: { majorCount: 3 },
    });
    expect(solutions.length).toBeGreaterThan(0);
    expect(solutions[0]!.totals.Weapons).toBeGreaterThanOrEqual(200);
    expect(solutions[0]!.totals.Grenade).toBeGreaterThanOrEqual(100);
    expect(solutions[0]!.totals.Super).toBeGreaterThanOrEqual(70);
  });

  it("finds multi-target builds with split major/minor mod budget", () => {
    const pool = SLOT_ORDER.map((slot) =>
      mockPiece(slot, `id-${slot}`, {
        Weapons: 38,
        Health: 25,
        Class: 20,
        Grenade: 20,
        Melee: 13,
        Super: 10,
      }),
    );
    const solutions = searchLoadouts({
      pool,
      constraints: [
        { stat: "Weapons", min: 200 },
        { stat: "Health", min: 50 },
        { stat: "Grenade", min: 100 },
        { stat: "Melee", min: 63 },
      ],
      assumedStatMods: { majorCount: 3 },
    });
    expect(solutions.length).toBeGreaterThan(0);
  });

  it("accepts a +10 mod overshoot when meeting a 200 minimum", () => {
    const pool = SLOT_ORDER.map((slot) =>
      mockPiece(slot, `id-${slot}`, {
        Weapons: 39,
        Health: 25,
        Class: 20,
        Grenade: 18,
        Melee: 10,
        Super: 14,
      }),
    );
    const solutions = searchLoadouts({
      pool,
      constraints: [{ stat: "Weapons", min: 200 }],
      assumedStatMods: { majorCount: 3 },
    });
    expect(solutions.length).toBeGreaterThan(0);
    expect(solutions[0]!.totals.Weapons).toBeGreaterThanOrEqual(200);
    expect(solutions[0]!.totals.Weapons).toBeLessThanOrEqual(210);
  });

  it("returns immediately when targets exceed achievable bounds", () => {
    const pool = SLOT_ORDER.map((slot) =>
      mockPiece(slot, `id-${slot}`, { Weapons: 40, Health: 25 }),
    );
    const solutions = searchLoadouts({
      pool,
      constraints: ARMOR_STAT_NAMES.map((stat) => ({
        stat,
        min: stat === "Weapons" ? 250 : 0,
      })),
      assumedStatMods: { majorCount: 4 },
    });
    expect(solutions).toEqual([]);
  });

  it("does not inflate totals with duplicated mod budget across targets", () => {
    const pool = SLOT_ORDER.map((slot) =>
      mockPiece(slot, `id-${slot}`, {
        Weapons: 40,
        Health: 25,
        Class: 20,
        Grenade: 10,
      }),
    );
    const solutions = searchLoadouts({
      pool,
      constraints: [
        { stat: "Weapons", min: 200 },
        { stat: "Health", min: 50 },
        { stat: "Class", min: 50 },
        { stat: "Grenade", min: 50 },
        { stat: "Melee", min: 50 },
        { stat: "Super", min: 50 },
      ],
      assumedStatMods: { majorCount: 5 },
    });
    for (const solution of solutions) {
      const sum = ARMOR_STAT_NAMES.reduce(
        (acc, stat) => acc + solution.totals[stat],
        0,
      );
      expect(sum).toBeLessThanOrEqual(40 * 5 + 10 * 4 + 20 * 5 + 50);
    }
  });
});
