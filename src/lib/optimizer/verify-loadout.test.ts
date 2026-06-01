import { describe, expect, it } from "vitest";
import { SLOT_ORDER } from "@/lib/bungie/constants";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import { verifyLoadout } from "@/lib/optimizer/verify-loadout";

function piece(
  slot: DerivedArmorPieceJson["slot"],
  stats: Partial<Record<string, number>>,
  setHash = 10,
): DerivedArmorPieceJson {
  return {
    itemInstanceId: `id-${slot}`,
    itemHash: 1,
    slot,
    classType: 2,
    setHash,
    setName: "Test",
    displayName: "Test",
    archetypeHash: 1,
    archetypeName: "Gunner",
    tuningHash: 1,
    tuningName: "+Weapons / -Grenade",
    primaryStat: "Weapons",
    secondaryStat: "Health",
    tertiaryStat: "Class",
    statTotals: stats as DerivedArmorPieceJson["statTotals"],
    location: { kind: "vault" },
  };
}

describe("verifyLoadout", () => {
  it("accepts a feasible five-piece loadout", () => {
    const pool = SLOT_ORDER.map((slot) =>
      piece(slot, {
        Weapons: 40,
        Health: 22,
        Class: 14,
        Grenade: 20,
        Melee: 8,
        Super: 14,
      }),
    );
    const result = verifyLoadout(pool, {
      constraints: [
        { stat: "Weapons", min: 200 },
        { stat: "Grenade", min: 100 },
        { stat: "Super", min: 70 },
      ],
      assumedMods: { majorCount: 3 },
    });
    expect(result.ok).toBe(true);
  });

  it("explains set bonus mismatch", () => {
    const pool = SLOT_ORDER.map((slot) => piece(slot, { Weapons: 40 }, 99));
    const result = verifyLoadout(pool, {
      constraints: [{ stat: "Weapons", min: 0 }],
      setBonusSelections: [{ setHash: 10, requiredCount: 2, perkHash: 1 }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/set bonus/i);
    }
  });
});
