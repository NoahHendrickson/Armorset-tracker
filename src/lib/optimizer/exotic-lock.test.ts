import { describe, expect, it } from "vitest";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import {
  applyExoticLockToPool,
  countExoticsInPieces,
  exoticAllowedInPartialCombo,
  normalizeExoticLock,
  uniqueOwnedExoticsForClass,
} from "@/lib/optimizer/exotic-lock";

function piece(
  slot: DerivedArmorPieceJson["slot"],
  id: string,
  exotic = false,
): DerivedArmorPieceJson {
  return {
    itemInstanceId: id,
    itemHash: exotic ? 99 : 1,
    slot,
    classType: 0,
    setHash: 1,
    setName: exotic ? null : "Set",
    displayName: exotic ? "Exotic" : "Set",
    isExotic: exotic,
    archetypeHash: 1,
    archetypeName: "Gunner",
    tuningHash: 1,
    tuningName: "+Weapons",
    primaryStat: "Weapons",
    secondaryStat: "Health",
    tertiaryStat: "Class",
    statTotals: { Weapons: 40 },
    location: { kind: "vault" },
  };
}

describe("exotic lock", () => {
  const pool = [
    piece("helmet", "leg-h"),
    piece("helmet", "ex-h", true),
    piece("chest", "ex-c", true),
  ];

  it("none mode drops exotics from pool", () => {
    const filtered = applyExoticLockToPool(pool, { mode: "none" });
    expect(filtered.every((p) => !p.isExotic)).toBe(true);
  });

  it("locked mode keeps only the chosen exotic", () => {
    const filtered = applyExoticLockToPool(pool, {
      mode: "locked",
      itemInstanceId: "ex-h",
      slot: "helmet",
    });
    expect(filtered.find((p) => p.itemInstanceId === "ex-c")).toBeUndefined();
    expect(filtered.find((p) => p.itemInstanceId === "ex-h")).toBeDefined();
  });

  it("locked mode keeps every copy of the same exotic identity", () => {
    const weak = piece("helmet", "ex-weak", true);
    weak.itemHash = 100;
    weak.displayName = "Speaker's Sight";
    weak.statTotals = { Weapons: 20 };
    const strong = piece("helmet", "ex-strong", true);
    strong.itemHash = 200;
    strong.displayName = "Speaker's Sight";
    strong.statTotals = { Weapons: 45 };
    const filtered = applyExoticLockToPool(
      [weak, strong, piece("chest", "leg-c")],
      { mode: "locked", itemInstanceId: "ex-weak", slot: "helmet" },
    );
    expect(
      filtered
        .filter((p) => p.isExotic)
        .map((p) => p.itemInstanceId)
        .sort(),
    ).toEqual(["ex-strong", "ex-weak"]);
  });

  it("allows at most one exotic in partial combo for any mode", () => {
    expect(
      exoticAllowedInPartialCombo(piece("chest", "ex2", true), [piece("helmet", "ex1", true)], {
        mode: "any",
      }),
    ).toBe(false);
    expect(countExoticsInPieces([piece("helmet", "ex1", true)])).toBe(1);
  });

  it("dedupes duplicate copies of the same item hash", () => {
    const dupA = piece("helmet", "ex-dup-a", true);
    dupA.itemHash = 4242;
    const dupB = piece("helmet", "ex-dup-b", true);
    dupB.itemHash = 4242;
    const other = piece("chest", "ex-chest", true);
    other.itemHash = 777;

    const unique = uniqueOwnedExoticsForClass(
      [dupB, dupA, other],
      0,
    );
    expect(unique).toHaveLength(2);
    expect(unique.map((p) => p.itemHash).sort((a, b) => a - b)).toEqual([
      777, 4242,
    ]);
    expect(unique.find((p) => p.itemHash === 4242)?.itemInstanceId).toBe(
      "ex-dup-a",
    );
  });

  it("dedupes distinct item hashes that share slot and display name", () => {
    const legacy = piece("helmet", "ex-legacy", true);
    legacy.itemHash = 100;
    legacy.displayName = "Apotheosis Veil";
    const current = piece("helmet", "ex-current", true);
    current.itemHash = 200;
    current.displayName = "Apotheosis Veil";

    const unique = uniqueOwnedExoticsForClass([legacy, current], 0);
    expect(unique).toHaveLength(1);
    expect(unique[0]?.itemInstanceId).toBe("ex-current");
  });

  it("normalizes a locked duplicate to the representative instance", () => {
    const dupA = piece("helmet", "ex-dup-a", true);
    dupA.itemHash = 4242;
    dupA.displayName = "Same Exotic";
    const dupB = piece("helmet", "ex-dup-b", true);
    dupB.itemHash = 9999;
    dupB.displayName = "Same Exotic";

    const next = normalizeExoticLock(
      { mode: "locked", itemInstanceId: "ex-dup-b", slot: "helmet" },
      [dupB, dupA],
      0,
    );
    expect(next).toEqual({
      mode: "locked",
      itemInstanceId: "ex-dup-a",
      slot: "helmet",
    });
  });
});
