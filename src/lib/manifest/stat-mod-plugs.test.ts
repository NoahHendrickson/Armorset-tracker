import { describe, expect, it } from "vitest";
import { deriveManifestData } from "@/lib/manifest/derive";
import type { ManifestInventoryItemDefinition } from "@/lib/manifest/types";
import type { ArmorStatName } from "@/lib/db/types";

/** Manifest hashes from Bungie public manifest (A0 discovery). */
const MINOR_GRENADE_MOD = 4021790309;
const MAJOR_GRENADE_MOD = 1435557120;
const ARTIFICE_GRENADE_MOD = 617569843;
const INTRINSIC_ARMOR_STATS_PLUG = 900_001;
const MASTERWORK_PLUG = 900_002;

const WEAPONS_STAT_HASH = 2_996_146_975;
const GRENADE_STAT_HASH = 1_735_777_505;

const emptyDeriveInputs = {
  socketCategories: {},
  socketTypes: {},
  collectibles: {},
  equipableItemSets: {},
  sandboxPerks: {},
  plugSets: {},
};

function statPlug(
  hash: number,
  categoryId: string,
  name: string,
  statHash: number,
  value: number,
): ManifestInventoryItemDefinition {
  return {
    hash,
    displayProperties: { name },
    plug: { plugCategoryIdentifier: categoryId },
    investmentStats: [{ statTypeHash: statHash, value }],
  } as ManifestInventoryItemDefinition;
}

function rowsForPlug(
  derived: ReturnType<typeof deriveManifestData>,
  plugHash: number,
): Array<{ stat: ArmorStatName; value: number }> {
  return derived.statModPlugStats
    .filter((row) => row.plug_hash === plugHash)
    .map((row) => ({ stat: row.stat, value: row.value }));
}

describe("statModPlugStats manifest derive", () => {
  it("maps general (+5/+10) and artifice (+3) stat mods", () => {
    const derived = deriveManifestData({
      version: "test",
      items: {
        [MINOR_GRENADE_MOD]: statPlug(
          MINOR_GRENADE_MOD,
          "enhancements.v2_general",
          "Minor Grenade Mod",
          GRENADE_STAT_HASH,
          5,
        ),
        [MAJOR_GRENADE_MOD]: statPlug(
          MAJOR_GRENADE_MOD,
          "enhancements.v2_general",
          "Grenade Mod",
          GRENADE_STAT_HASH,
          10,
        ),
        [ARTIFICE_GRENADE_MOD]: statPlug(
          ARTIFICE_GRENADE_MOD,
          "enhancements.artifice",
          "Grenade Forged",
          GRENADE_STAT_HASH,
          3,
        ),
      },
      stats: {
        [WEAPONS_STAT_HASH]: {
          hash: WEAPONS_STAT_HASH,
          displayProperties: { name: "Weapons" },
        },
        [GRENADE_STAT_HASH]: {
          hash: GRENADE_STAT_HASH,
          displayProperties: { name: "Grenade" },
        },
      },
      ...emptyDeriveInputs,
    });

    expect(rowsForPlug(derived, MINOR_GRENADE_MOD)).toEqual([
      { stat: "Grenade", value: 5 },
    ]);
    expect(rowsForPlug(derived, MAJOR_GRENADE_MOD)).toEqual([
      { stat: "Grenade", value: 10 },
    ]);
    expect(rowsForPlug(derived, ARTIFICE_GRENADE_MOD)).toEqual([
      { stat: "Grenade", value: 3 },
    ]);
    expect(derived.statModPlugStats).toHaveLength(3);
  });

  it("excludes intrinsic armor_stats and masterwork plugs", () => {
    const derived = deriveManifestData({
      version: "test",
      items: {
        [INTRINSIC_ARMOR_STATS_PLUG]: {
          hash: INTRINSIC_ARMOR_STATS_PLUG,
          plug: { plugCategoryIdentifier: "enhancements.armor_stats" },
          investmentStats: [{ statTypeHash: WEAPONS_STAT_HASH, value: 30 }],
        } as ManifestInventoryItemDefinition,
        [MASTERWORK_PLUG]: statPlug(
          MASTERWORK_PLUG,
          "v460.plugs.armor.masterworks.stat.resistance_3",
          "Masterwork",
          GRENADE_STAT_HASH,
          5,
        ),
        [MINOR_GRENADE_MOD]: statPlug(
          MINOR_GRENADE_MOD,
          "enhancements.v2_general",
          "Minor Grenade Mod",
          GRENADE_STAT_HASH,
          5,
        ),
      },
      stats: {
        [WEAPONS_STAT_HASH]: {
          hash: WEAPONS_STAT_HASH,
          displayProperties: { name: "Weapons" },
        },
        [GRENADE_STAT_HASH]: {
          hash: GRENADE_STAT_HASH,
          displayProperties: { name: "Grenade" },
        },
      },
      ...emptyDeriveInputs,
    });

    expect(
      derived.statModPlugStats.some((row) => row.plug_hash === INTRINSIC_ARMOR_STATS_PLUG),
    ).toBe(false);
    expect(
      derived.statModPlugStats.some((row) => row.plug_hash === MASTERWORK_PLUG),
    ).toBe(false);
    expect(derived.armorStatPlugs.some((row) => row.plug_hash === INTRINSIC_ARMOR_STATS_PLUG)).toBe(
      true,
    );
  });
});
