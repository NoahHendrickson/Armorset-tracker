import { describe, expect, it } from "vitest";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import {
  countPiecesBySetHash,
  partialCanSatisfySetBonuses,
  satisfiesSetBonuses,
  setBonusSelectionConflict,
} from "@/lib/optimizer/set-bonus";

function piece(
  slot: DerivedArmorPieceJson["slot"],
  id: string,
  setHash: number,
): DerivedArmorPieceJson {
  return {
    itemInstanceId: id,
    itemHash: setHash,
    slot,
    classType: 0,
    setHash,
    setName: "Set",
    displayName: "Set",
    archetypeHash: 1,
    archetypeName: "Gunner",
    tuningHash: 1,
    tuningName: "+Weapons / -Grenade",
    primaryStat: "Weapons",
    secondaryStat: "Health",
    tertiaryStat: "Class",
    statTotals: { Weapons: 40 },
    location: { kind: "vault" },
  };
}

describe("set bonus constraints", () => {
  it("counts legendary pieces per set hash", () => {
    const counts = countPiecesBySetHash([
      piece("helmet", "a", 10),
      piece("chest", "b", 10),
      { ...piece("legs", "c", 99), isExotic: true, setHash: 99 },
    ]);
    expect(counts.get(10)).toBe(2);
    expect(counts.get(99)).toBeUndefined();
  });

  it("requires enough pieces for selected perks", () => {
    const chosen = [piece("helmet", "a", 10), piece("chest", "b", 10)];
    expect(
      satisfiesSetBonuses(chosen, [
        { setHash: 10, requiredCount: 2, perkHash: 1 },
      ]),
    ).toBe(true);
    expect(
      satisfiesSetBonuses(chosen, [
        { setHash: 10, requiredCount: 4, perkHash: 2 },
      ]),
    ).toBe(false);
  });

  it("prunes partial combos that cannot satisfy remaining set counts", () => {
    const bySlot = new Map<DerivedArmorPieceJson["slot"], DerivedArmorPieceJson[]>([
      ["helmet", [piece("helmet", "h1", 10)]],
      ["arms", [piece("arms", "a1", 10)]],
      ["chest", [piece("chest", "c1", 10)]],
      ["legs", [piece("legs", "l1", 20)]],
      ["classItem", [piece("classItem", "ci1", 20)]],
    ]);
    expect(
      partialCanSatisfySetBonuses(
        [],
        ["helmet", "arms", "chest", "legs", "classItem"],
        bySlot,
        [{ setHash: 10, requiredCount: 4, perkHash: 2 }],
      ),
    ).toBe(false);
  });

  it("flags impossible multi 4-piece selections", () => {
    expect(
      setBonusSelectionConflict([
        { setHash: 10, requiredCount: 4, perkHash: 1 },
        { setHash: 20, requiredCount: 4, perkHash: 2 },
      ]),
    ).toMatch(/one 4-piece/i);
  });
});
