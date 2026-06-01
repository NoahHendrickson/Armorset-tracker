import { describe, expect, it } from "vitest";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import {
  armorTierFromIntrinsicMagnitudes,
  buildStatTotals,
  estimateStatTotalsFromLabels,
  isTier5Piece,
  parseTuningPairFromName,
  pieceHasStatTotals,
  tuningDeltasFromDisplayName,
} from "@/lib/inventory/compute-stat-totals";

describe("buildStatTotals", () => {
  it("sums armor_stats plugs and tuning +/- deltas", () => {
    const totals = buildStatTotals(
      [
        { stat: "Weapons", value: 30 },
        { stat: "Health", value: 25 },
        { stat: "Class", value: 20 },
      ],
      [
        { stat: "Weapons", value: 5 },
        { stat: "Grenade", value: -5 },
      ],
    );
    expect(totals).toEqual({
      Weapons: 35,
      Health: 25,
      Class: 20,
      Grenade: -5,
    });
  });
});

describe("parseTuningPairFromName", () => {
  it("extracts boosted and debuffed stats", () => {
    expect(parseTuningPairFromName("Tuned: +Weapons / -Grenade")).toEqual({
      positive: "Weapons",
      negative: "Grenade",
    });
  });

  it("rejects balanced tuning", () => {
    expect(parseTuningPairFromName("Balanced Tuning")).toBeNull();
  });
});

describe("tuningDeltasFromDisplayName", () => {
  it("builds symmetric +/- magnitudes", () => {
    expect(tuningDeltasFromDisplayName("+Class / -Super")).toEqual([
      { stat: "Class", value: 5 },
      { stat: "Super", value: -5 },
    ]);
  });
});

describe("estimateStatTotalsFromLabels", () => {
  it("derives totals from ranked stats and +stat tuning bucket", () => {
    const piece: DerivedArmorPieceJson = {
      itemInstanceId: "x",
      itemHash: 1,
      slot: "helmet",
      classType: 2,
      setHash: 1,
      setName: "Test",
      archetypeHash: 1,
      archetypeName: "Gunner",
      tuningHash: 1,
      tuningName: "+Weapons",
      primaryStat: "Weapons",
      secondaryStat: "Health",
      tertiaryStat: "Class",
      location: { kind: "vault" },
    };
    expect(estimateStatTotalsFromLabels(piece)).toEqual({
      Weapons: 35,
      Health: 25,
      Class: 20,
    });
    expect(pieceHasStatTotals(piece)).toBe(true);
  });
});

describe("armorTierFromIntrinsicMagnitudes", () => {
  it("flags a perfect 30/25/20 roll as Tier 5 regardless of order", () => {
    expect(armorTierFromIntrinsicMagnitudes([20, 30, 25])).toBe(5);
  });

  it("buckets lower tiers by total stat budget", () => {
    expect(armorTierFromIntrinsicMagnitudes([28, 24, 18])).toBe(4); // 70
    expect(armorTierFromIntrinsicMagnitudes([26, 22, 16])).toBe(3); // 64
    expect(armorTierFromIntrinsicMagnitudes([24, 20, 14])).toBe(2); // 58
    expect(armorTierFromIntrinsicMagnitudes([20, 18, 14])).toBe(1); // 52
  });

  it("returns null with no intrinsic plugs", () => {
    expect(armorTierFromIntrinsicMagnitudes([])).toBeNull();
  });
});

describe("isTier5Piece", () => {
  const base: DerivedArmorPieceJson = {
    itemInstanceId: "x",
    itemHash: 1,
    slot: "helmet",
    classType: 2,
    setHash: 1,
    setName: "Test",
    archetypeHash: 1,
    archetypeName: "Gunner",
    tuningHash: 1,
    tuningName: "+Weapons / -Grenade",
    primaryStat: "Weapons",
    secondaryStat: "Health",
    tertiaryStat: "Class",
    location: { kind: "vault" },
  };

  it("uses the stored tier when present", () => {
    expect(isTier5Piece({ ...base, tier: 5 })).toBe(true);
    expect(isTier5Piece({ ...base, tier: 4 })).toBe(false);
  });

  it("falls back to the ~75 total signature when tier is absent", () => {
    expect(
      isTier5Piece({
        ...base,
        statTotals: { Weapons: 35, Health: 25, Class: 20, Grenade: -5 },
      }),
    ).toBe(true);
    expect(
      isTier5Piece({
        ...base,
        statTotals: { Weapons: 24, Health: 20, Class: 14 },
      }),
    ).toBe(false);
  });
});
