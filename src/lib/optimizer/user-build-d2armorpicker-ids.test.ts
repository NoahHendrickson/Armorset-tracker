import { describe, expect, it } from "vitest";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import { verifyLoadout } from "@/lib/optimizer/verify-loadout";

/** D2ArmorPicker screenshot build (Speaker's Sight helmet exotic). */
export const D2ARMORPICKER_USER_INSTANCE_IDS = [
  "6917530125298828509",
  "6917530167771126356",
  "6917530146665347396",
  "6917530160150786116",
  "6917530147186685296",
] as const;

const FERROPOTENT_HASH = 3_734_029_045;
const SMOKE_JUMPER_HASH = 2_751_989_785;

/**
 * Legendary rows from inventory cache; Speaker's Sight uses Bungie ItemStats (304)
 * (see scripts/verify-dim-loadout.ts) — not the under-counted plug walk.
 */
function d2ArmorPickerUserPool(): DerivedArmorPieceJson[] {
  const base = {
    classType: 2,
    archetypeHash: 1,
    archetypeName: "Gunner",
    tuningCommitted: true,
    tier: 5 as const,
    location: { kind: "vault" as const },
  };

  return [
    {
      ...base,
      itemInstanceId: D2ARMORPICKER_USER_INSTANCE_IDS[0],
      itemHash: 50_291_571,
      slot: "helmet",
      isExotic: true,
      setHash: null,
      setName: null,
      displayName: "Speaker's Sight",
      tuningCommitted: false,
      primaryStat: "Weapons" as const,
      secondaryStat: "Health" as const,
      tertiaryStat: "Grenade" as const,
      statTotals: {
        Weapons: 31,
        Health: 8,
        Grenade: 16,
        Class: 4,
        Melee: 4,
        Super: 20,
      },
    },
    {
      ...base,
      itemInstanceId: D2ARMORPICKER_USER_INSTANCE_IDS[1],
      itemHash: 9_002,
      slot: "arms",
      setHash: FERROPOTENT_HASH,
      setName: "Ferropotent",
      displayName: "Ferropotent",
      tuningName: "+Weapons",
      primaryStat: "Weapons" as const,
      secondaryStat: "Grenade" as const,
      tertiaryStat: "Super" as const,
      statTotals: {
        Melee: -5,
        Super: 20,
        Grenade: 25,
        Weapons: 35,
      },
    },
    {
      ...base,
      itemInstanceId: D2ARMORPICKER_USER_INSTANCE_IDS[2],
      itemHash: 9_003,
      slot: "chest",
      setHash: SMOKE_JUMPER_HASH,
      setName: "Smoke Jumper Set",
      displayName: "Smoke Jumper Set",
      tuningName: "+Super",
      primaryStat: "Weapons" as const,
      secondaryStat: "Grenade" as const,
      tertiaryStat: "Super" as const,
      statTotals: {
        Super: 25,
        Health: -5,
        Grenade: 25,
        Weapons: 30,
      },
    },
    {
      ...base,
      itemInstanceId: D2ARMORPICKER_USER_INSTANCE_IDS[3],
      itemHash: 9_004,
      slot: "legs",
      setHash: FERROPOTENT_HASH,
      setName: "Ferropotent",
      displayName: "Ferropotent",
      tuningName: "+Weapons",
      primaryStat: "Weapons" as const,
      secondaryStat: "Grenade" as const,
      tertiaryStat: "Super" as const,
      statTotals: {
        Super: 20,
        Health: -5,
        Grenade: 25,
        Weapons: 35,
      },
    },
    {
      ...base,
      itemInstanceId: D2ARMORPICKER_USER_INSTANCE_IDS[4],
      itemHash: 9_005,
      slot: "classItem",
      setHash: SMOKE_JUMPER_HASH,
      setName: "Smoke Jumper Set",
      displayName: "Smoke Jumper Set",
      tuningName: "+Weapons",
      primaryStat: "Weapons" as const,
      secondaryStat: "Grenade" as const,
      tertiaryStat: "Class" as const,
      statTotals: {
        Class: 20,
        Health: -5,
        Grenade: 25,
        Weapons: 35,
      },
    },
  ];
}

/** App screenshot: high Weapons / Grenade / Super (matches first screenshot). */
const APP_SCREENSHOT_TARGETS = [
  { stat: "Weapons" as const, min: 200 },
  { stat: "Grenade" as const, min: 100 },
  { stat: "Super" as const, min: 100 },
];

const SET_BONUSES = [
  { setHash: FERROPOTENT_HASH, requiredCount: 2, perkHash: FERROPOTENT_HASH },
  { setHash: SMOKE_JUMPER_HASH, requiredCount: 2, perkHash: SMOKE_JUMPER_HASH },
];

const ASSUMED_MODS = { majorCount: 5, slotFill: true, artifice: true };

describe("D2ArmorPicker user instance ids (Speaker's Sight build)", () => {
  const pool = d2ArmorPickerUserPool();

  it("verifies app screenshot targets when exotic uses cached plug-walk Super (31)", () => {
    const plugWalkExotic = {
      ...pool[0]!,
      statTotals: {
        Weapons: 25,
        Health: 8,
        Grenade: 12,
        Melee: 4,
        Super: 31,
      },
    };
    const plugWalkPool = [plugWalkExotic, ...pool.slice(1)];
    const result = verifyLoadout(plugWalkPool, {
      constraints: APP_SCREENSHOT_TARGETS,
      assumedMods: ASSUMED_MODS,
      setBonusSelections: SET_BONUSES,
    });
    expect(result.ok, !result.ok ? result.reason : "").toBe(true);
    if (result.ok) {
      expect(result.resolved.totals.Weapons).toBe(200);
      expect(result.resolved.totals.Super).toBeGreaterThanOrEqual(100);
    }
  });

  it("verifies D2AP six-stat targets with plug-walk exotic Super 31 and armor tuning row", () => {
    const plugWalkExotic = {
      ...pool[0]!,
      statTotals: {
        Weapons: 25,
        Health: 8,
        Grenade: 4,
        Class: 4,
        Melee: 4,
        Super: 31,
      },
    };
    const plugWalkPool = [plugWalkExotic, ...pool.slice(1)];
    const d2apTargets = [
      { stat: "Weapons" as const, min: 200 },
      { stat: "Health" as const, min: 13 },
      { stat: "Class" as const, min: 42 },
      { stat: "Grenade" as const, min: 104 },
      { stat: "Melee" as const, min: 19 },
      { stat: "Super" as const, min: 101 },
    ];
    const result = verifyLoadout(plugWalkPool, {
      constraints: d2apTargets,
      assumedMods: { majorCount: 3, slotFill: true, artifice: true },
      setBonusSelections: SET_BONUSES,
    });
    expect(result.ok, !result.ok ? result.reason : "").toBe(true);
  });
});
