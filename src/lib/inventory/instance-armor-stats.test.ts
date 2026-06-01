import { describe, expect, it } from "vitest";
import { buildDestinyStatHashToArmorStat } from "@/lib/inventory/armor-stat-destiny-hashes";
import { instanceArmorStatTotals } from "@/lib/inventory/instance-armor-stats";
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
});
