import { describe, expect, it } from "vitest";
import { ARMOR_BUCKET_HASHES } from "@/lib/bungie/constants";
import type { ProfileResponse } from "@/lib/bungie/types";
import { deriveArmorPiece } from "@/lib/inventory/derive";
import type { ManifestLookups } from "@/lib/manifest/lookups";
import type { ArmorStatName } from "@/lib/db/types";
import { buildDestinyStatHashToArmorStat } from "@/lib/inventory/armor-stat-destiny-hashes";

const SPEAKERS_SIGHT_HASH = 50_291_571;
const INSTANCE_ID = "6917530125298828509";
const MINOR_GRENADE_MOD = 4_021_790_309;
const ARTIFICE_GRENADE_MOD = 617_569_843;

function emptyLookups(
  overrides: Partial<ManifestLookups> = {},
): ManifestLookups {
  return {
    version: "test",
    archetypeNameByHash: new Map(),
    tuningNameByHash: new Map(),
    setNameByHash: new Map(),
    canonicalSetHashByLegacy: new Map(),
    archetypeByPlug: new Map(),
    tuningByPlug: new Map(),
    armorItemByHash: new Map(),
    exoticArmorByHash: new Map([
      [
        SPEAKERS_SIGHT_HASH,
        {
          slot: "helmet",
          classType: 0,
          name: "Speaker's Sight",
          iconPath: "",
        },
      ],
    ]),
    exoticStatBudgetByItemHash: new Map(),
    exoticStatBudgetByIdentity: new Map(),
    archetypeStatPair: new Map(),
    statPlug: new Map(),
    tuningPlugStats: new Map(),
    statModPlugStats: new Map([
      [MINOR_GRENADE_MOD, [{ stat: "Grenade", value: 5 }]],
      [ARTIFICE_GRENADE_MOD, [{ stat: "Grenade", value: 3 }]],
    ]),
    fragmentPlugByHash: new Map(),
    armorSetPerks: [],
    statIconByName: new Map(),
    destinyStatHashToArmorStat: buildDestinyStatHashToArmorStat(),
    armorSlotIconPathBySetClassSlot: new Map(),
    slotFallbackIconPathBySlot: new Map(),
    ...overrides,
  };
}

function speakersSightProfile(
  stats304: Partial<Record<ArmorStatName, number>>,
  socketPlugHashes: number[],
): ProfileResponse {
  const statEntries: Record<string, { statHash: number; value: number }> = {};
  const hashToStat = buildDestinyStatHashToArmorStat();
  for (const [stat, value] of Object.entries(stats304) as Array<
    [ArmorStatName, number]
  >) {
    for (const [hash, name] of hashToStat.entries()) {
      if (name === stat) {
        statEntries[String(hash)] = { statHash: hash, value };
        break;
      }
    }
  }

  return {
    profileInventory: {
      data: {
        items: [
          {
            itemInstanceId: INSTANCE_ID,
            itemHash: SPEAKERS_SIGHT_HASH,
            bucketHash: ARMOR_BUCKET_HASHES.helmet,
          },
        ],
      },
    },
    itemComponents: {
      stats: {
        data: {
          [INSTANCE_ID]: { stats: statEntries },
        },
      },
      sockets: {
        data: {
          [INSTANCE_ID]: {
            sockets: socketPlugHashes.map((plugHash) => ({
              plugHash,
              isEnabled: true,
              isVisible: true,
            })),
          },
        },
      },
      reusablePlugs: { data: {} },
    },
  } as ProfileResponse;
}

describe("deriveArmorPiece exotic mod stripping", () => {
  it("recovers base Grenade from 304 when minor + artifice mods are slotted", () => {
    const profile = speakersSightProfile(
      {
        Weapons: 25,
        Health: 8,
        Grenade: 12,
        Super: 31,
        Class: 4,
        Melee: 4,
      },
      [MINOR_GRENADE_MOD, ARTIFICE_GRENADE_MOD],
    );
    const entry = {
      item: profile.profileInventory!.data!.items[0]!,
      location: { kind: "vault" as const },
    };
    const derived = deriveArmorPiece(entry, profile, emptyLookups());

    expect(derived?.statTotals.Grenade).toBe(4);
    expect(derived?.statTotals.Weapons).toBe(25);
    expect(derived?.statTotals.Super).toBe(31);
  });

  it("leaves legendary statTotals unchanged", () => {
    const legendaryHash = 9_999_001;
    const lookups = emptyLookups({
      exoticArmorByHash: new Map(),
      armorItemByHash: new Map([
        [
          legendaryHash,
          { setHash: 1, slot: "helmet", classType: 0, iconPath: "" },
        ],
      ]),
      setNameByHash: new Map([[1, "Test Set"]]),
      statPlug: new Map([[100, { stat: "Weapons", value: 30 }]]),
    });
    const profile = {
      profileInventory: {
        data: {
          items: [
            {
              itemInstanceId: "leg-1",
              itemHash: legendaryHash,
              bucketHash: ARMOR_BUCKET_HASHES.helmet,
            },
          ],
        },
      },
      itemComponents: {
        stats: {
          data: {
            "leg-1": {
              stats: {
                "2996146975": { statHash: 2996146975, value: 99 },
              },
            },
          },
        },
        sockets: {
          data: {
            "leg-1": {
              sockets: [{ plugHash: 100, isEnabled: true, isVisible: true }],
            },
          },
        },
        reusablePlugs: { data: {} },
      },
    } as ProfileResponse;
    const entry = {
      item: profile.profileInventory!.data!.items[0]!,
      location: { kind: "vault" as const },
    };
    const derived = deriveArmorPiece(entry, profile, lookups);

    expect(derived?.isExotic).toBe(false);
    expect(derived?.statTotals.Weapons).toBe(30);
  });

  it("no-ops when exotic has manifest budget but no ItemStats (304)", () => {
    const budget = {
      Weapons: 25,
      Health: 8,
      Grenade: 4,
      Super: 31,
      Class: 4,
      Melee: 4,
    };
    const lookups = emptyLookups({
      exoticStatBudgetByItemHash: new Map([[SPEAKERS_SIGHT_HASH, budget]]),
    });
    const profile = {
      profileInventory: {
        data: {
          items: [
            {
              itemInstanceId: INSTANCE_ID,
              itemHash: SPEAKERS_SIGHT_HASH,
              bucketHash: ARMOR_BUCKET_HASHES.helmet,
            },
          ],
        },
      },
      itemComponents: {
        sockets: { data: { [INSTANCE_ID]: { sockets: [] } } },
        reusablePlugs: { data: {} },
      },
    } as ProfileResponse;
    const entry = {
      item: profile.profileInventory!.data!.items[0]!,
      location: { kind: "vault" as const },
    };
    const derived = deriveArmorPiece(entry, profile, lookups);

    expect(derived?.statTotals).toEqual(budget);
  });
});
