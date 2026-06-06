import { describe, expect, it } from "vitest";
import { buildDestinyStatHashToArmorStat } from "@/lib/inventory/armor-stat-destiny-hashes";
import {
  instanceArmorStatTotals,
  mergeExoticInstanceStatTotals,
  resolveExoticBaseStatsForOptimizer,
  resolveExoticStatTotals,
  stripSlottedStatMods,
} from "@/lib/inventory/instance-armor-stats";
import type { ProfileResponse } from "@/lib/bungie/types";

describe("instanceArmorStatTotals", () => {
  it("maps Bungie ItemStats using fallback hashes when DB map is empty", () => {
    const profile = {
      itemComponents: {
        stats: {
          data: {
            "6917530125283917710": {
              stats: {
                "2996146975": { statHash: 2996146975, value: 31 },
                "392767087": { statHash: 392767087, value: 8 },
                "1735777505": { statHash: 1735777505, value: 16 },
                "2135857333": { statHash: 2135857333, value: 4 },
                "4244567218": { statHash: 4244567218, value: 4 },
                "144602215": { statHash: 144602215, value: 20 },
              },
            },
          },
        },
      },
    } as ProfileResponse;

    const totals = instanceArmorStatTotals(
      "6917530125283917710",
      profile,
      new Map(),
    );

    expect(totals).toEqual({
      Weapons: 31,
      Health: 8,
      Grenade: 16,
      Class: 4,
      Melee: 4,
      Super: 20,
    });
  });

  it("prefers manifest-synced hash overrides from DB", () => {
    const profile = {
      itemComponents: {
        stats: {
          data: {
            inst: {
              stats: {
                "999": { statHash: 999, value: 42 },
              },
            },
          },
        },
      },
    } as ProfileResponse;

    const map = buildDestinyStatHashToArmorStat([[999, "Weapons"]]);
    expect(instanceArmorStatTotals("inst", profile, map)).toEqual({
      Weapons: 42,
    });
  });

  it("resolveExoticStatTotals merges ItemStats without overriding plug Weapons", () => {
    const profile = {
      itemComponents: {
        stats: {
          data: {
            exotic: {
              stats: {
                "2996146975": { statHash: 2996146975, value: 31 },
              },
            },
          },
        },
      },
    } as ProfileResponse;

    const resolved = resolveExoticStatTotals(
      true,
      "exotic",
      profile,
      { Weapons: 25, Super: 31 },
      new Map(),
    );
    expect(resolved.Weapons).toBe(25);
    expect(resolved.Super).toBe(31);
  });

  it("maps alternate Class statHash 1943323491 from ItemStats blocks", () => {
    const profile = {
      itemComponents: {
        stats: {
          data: {
            inst: {
              stats: {
                "2996146975": { statHash: 2996146975, value: 25 },
                "392767087": { statHash: 392767087, value: 8 },
                "1735777505": { statHash: 1735777505, value: 12 },
                "1943323491": { statHash: 1943323491, value: 4 },
                "4244567218": { statHash: 4244567218, value: 4 },
                "144602215": { statHash: 144602215, value: 31 },
              },
            },
          },
        },
      },
    } as ProfileResponse;

    expect(instanceArmorStatTotals("inst", profile, new Map())).toEqual({
      Weapons: 25,
      Health: 8,
      Grenade: 12,
      Class: 4,
      Melee: 4,
      Super: 31,
    });
  });

  it("mergeExoticInstanceStatTotals lowers inflated Grenade and fills Class", () => {
    expect(
      mergeExoticInstanceStatTotals(
        { Weapons: 25, Health: 8, Grenade: 12, Super: 31, Melee: 4 },
        {
          Weapons: 31,
          Health: 8,
          Grenade: 4,
          Super: 31,
          Class: 4,
          Melee: 4,
        },
      ),
    ).toEqual({
      Weapons: 25,
      Health: 8,
      Grenade: 4,
      Super: 31,
      Class: 4,
      Melee: 4,
    });
  });

  it("mergeExoticInstanceStatTotals prefers lower plug Grenade when instance is higher", () => {
    expect(
      mergeExoticInstanceStatTotals(
        { Weapons: 25, Grenade: 4 },
        { Grenade: 12 },
      ),
    ).toEqual({ Weapons: 25, Grenade: 4 });
  });

  it("resolveExoticStatTotals keeps plug totals for legendaries", () => {
    const plug = { Weapons: 35, Grenade: 25 };
    expect(
      resolveExoticStatTotals(false, "leg", {} as ProfileResponse, plug, new Map()),
    ).toEqual(plug);
  });
});

describe("resolveExoticBaseStatsForOptimizer", () => {
  const statModPlugStats = new Map([
    [4_021_790_309, [{ stat: "Grenade" as const, value: 5 }]],
    [617_569_843, [{ stat: "Grenade" as const, value: 3 }]],
  ]);

  const speakersSight304 = {
    itemComponents: {
      stats: {
        data: {
          exotic: {
            stats: {
              "2996146975": { statHash: 2996146975, value: 25 },
              "392767087": { statHash: 392767087, value: 8 },
              "1735777505": { statHash: 1735777505, value: 12 },
              "1943323491": { statHash: 1943323491, value: 4 },
              "4244567218": { statHash: 4244567218, value: 4 },
              "144602215": { statHash: 144602215, value: 31 },
            },
          },
        },
      },
    },
  } as ProfileResponse;

  it("strips slotted mods and preserves plug Weapons when 304 Weapons is inflated", () => {
    const plugDerived = {
      Weapons: 25,
      Health: 8,
      Grenade: 12,
      Super: 31,
      Melee: 4,
    };

    expect(
      resolveExoticBaseStatsForOptimizer(
        "exotic",
        speakersSight304,
        plugDerived,
        [{ plugHash: 4_021_790_309 }, { plugHash: 617_569_843 }],
        new Map(),
        statModPlugStats,
      ),
    ).toEqual({
      Weapons: 25,
      Health: 8,
      Grenade: 4,
      Super: 31,
      Class: 4,
      Melee: 4,
    });
  });

  it("falls back to plug-derived totals when ItemStats (304) is absent", () => {
    const plugDerived = { Weapons: 25, Grenade: 4 };
    expect(
      resolveExoticBaseStatsForOptimizer(
        "exotic",
        {} as ProfileResponse,
        plugDerived,
        [],
        new Map(),
        statModPlugStats,
      ),
    ).toEqual(plugDerived);
  });
});

describe("stripSlottedStatMods", () => {
  const statModPlugStats = new Map([
    [4_021_790_309, [{ stat: "Grenade" as const, value: 5 }]],
    [617_569_843, [{ stat: "Grenade" as const, value: 3 }]],
    [1_703_647_492, [{ stat: "Weapons" as const, value: 5 }]],
  ]);

  it("subtracts slotted mods from modded totals", () => {
    expect(
      stripSlottedStatMods(
        { Weapons: 25, Grenade: 12 },
        [{ plugHash: 4_021_790_309 }, { plugHash: 617_569_843 }],
        statModPlugStats,
      ),
    ).toEqual({ Weapons: 25, Grenade: 4 });
  });

  it("floors stripped stats at zero", () => {
    expect(
      stripSlottedStatMods(
        { Grenade: 2 },
        [{ plugHash: 4_021_790_309 }],
        statModPlugStats,
      ),
    ).toEqual({ Grenade: 0 });
  });

  it("leaves unmodded stats unchanged", () => {
    expect(
      stripSlottedStatMods(
        { Weapons: 25, Super: 31 },
        [{ plugHash: 4_021_790_309 }],
        statModPlugStats,
      ),
    ).toEqual({ Weapons: 25, Super: 31, Grenade: 0 });
  });
});
