import { describe, expect, it } from "vitest";
import { pieceDuplicateKey, dedupeSlotPieces } from "@/lib/optimizer/dedupe";
import type { DerivedArmorPieceJson } from "@/lib/db/types";

const base: Omit<DerivedArmorPieceJson, "itemInstanceId" | "slot" | "statTotals" | "tuningName" | "tuningDeltas"> = {
  itemHash: 1,
  classType: 2,
  setHash: 3_734_029_045,
  setName: "Ferropotent",
  displayName: "Ferropotent",
  archetypeHash: 1,
  archetypeName: "Gunner",
  tuningCommitted: true,
  tier: 5,
  location: { kind: "vault" },
};

const displayStats = {
  Weapons: 30,
  Health: 5,
  Class: 5,
  Grenade: 25,
  Melee: 5,
  Super: 20,
};

describe("pieceDuplicateKey", () => {
  it("separates same display stats with different committed tuning", () => {
    const weaponsTuning: DerivedArmorPieceJson = {
      ...base,
      itemInstanceId: "a",
      slot: "arms",
      tuningName: "+Weapons",
      statTotals: displayStats,
      tuningDeltas: [
        { stat: "Weapons", value: 5 },
        { stat: "Melee", value: -5 },
      ],
    };
    const grenadeTuning: DerivedArmorPieceJson = {
      ...base,
      itemInstanceId: "b",
      slot: "arms",
      tuningName: "+Grenade",
      statTotals: displayStats,
      tuningDeltas: [
        { stat: "Grenade", value: 5 },
        { stat: "Health", value: -5 },
      ],
    };

    expect(pieceDuplicateKey(weaponsTuning)).not.toBe(
      pieceDuplicateKey(grenadeTuning),
    );
    const { representatives } = dedupeSlotPieces([weaponsTuning, grenadeTuning]);
    expect(representatives).toHaveLength(2);
  });
});
