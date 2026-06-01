import { describe, expect, it } from "vitest";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import { dedupeSlotPieces, pieceDuplicateKey } from "@/lib/optimizer/dedupe";

function piece(
  id: string,
  statTotals: Partial<Record<string, number>>,
  overrides: Partial<DerivedArmorPieceJson> = {},
): DerivedArmorPieceJson {
  return {
    itemInstanceId: id,
    itemHash: 1,
    slot: "helmet",
    classType: 0,
    setHash: 1,
    setName: "Test",
    archetypeHash: 1,
    archetypeName: "Gunner",
    tuningHash: 1,
    tuningName: "+Weapons / -Grenade",
    primaryStat: "Weapons",
    secondaryStat: "Health",
    tertiaryStat: "Class",
    statTotals: statTotals as DerivedArmorPieceJson["statTotals"],
    location: { kind: "vault" },
    ...overrides,
  };
}

describe("dedupeSlotPieces", () => {
  it("collapses identical stat/set/rarity rolls to one representative", () => {
    const { representatives, membersByRepresentative } = dedupeSlotPieces([
      piece("a", { Weapons: 30, Health: 25, Class: 20 }),
      piece("b", { Weapons: 30, Health: 25, Class: 20 }),
      piece("c", { Weapons: 25, Health: 30, Class: 20 }),
    ]);
    expect(representatives.map((p) => p.itemInstanceId)).toEqual(["a", "c"]);
    expect(membersByRepresentative.get("a")).toEqual(["a", "b"]);
    expect(membersByRepresentative.get("c")).toEqual(["c"]);
  });

  it("keeps pieces from different sets separate (set-bonus correctness)", () => {
    const { representatives } = dedupeSlotPieces([
      piece("a", { Weapons: 30 }, { setHash: 10 }),
      piece("b", { Weapons: 30 }, { setHash: 20 }),
    ]);
    expect(representatives).toHaveLength(2);
  });

  it("keeps exotics separate from identical-stat legendaries", () => {
    expect(
      pieceDuplicateKey(piece("a", { Weapons: 30 }, { isExotic: true })),
    ).not.toBe(pieceDuplicateKey(piece("b", { Weapons: 30 })));
  });
});
