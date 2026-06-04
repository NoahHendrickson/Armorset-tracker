import { describe, expect, it } from "vitest";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import { verifyLoadout } from "@/lib/optimizer/verify-loadout";
import { resolveLoadoutTotals } from "@/lib/optimizer/resolve-loadout-totals";
const D2ARMORPICKER_USER_INSTANCE_IDS = [
  "6917530125298828509",
  "6917530167771126356",
  "6917530146665347396",
  "6917530160150786116",
  "6917530147186685296",
] as const;

/** D2AP screenshot targets (all six pinned). */
const D2AP_TARGETS = [
  { stat: "Weapons" as const, min: 200 },
  { stat: "Health" as const, min: 13 },
  { stat: "Class" as const, min: 42 },
  { stat: "Grenade" as const, min: 104 },
  { stat: "Melee" as const, min: 19 },
  { stat: "Super" as const, min: 101 },
];

const SET = [
  { setHash: 3_734_029_045, requiredCount: 2, perkHash: 3_734_029_045 },
  { setHash: 2_751_989_785, requiredCount: 2, perkHash: 2_751_989_785 },
];

const MODS_3_2 = { majorCount: 3, slotFill: true, artifice: true };

/** D2AP "Tuning" row from screenshot. */
export const D2AP_TUNING_ROW = {
  Weapons: 15,
  Health: -15,
  Melee: -5,
  Super: 5,
  Class: 0,
  Grenade: 0,
};

function legacyCachedPool(): DerivedArmorPieceJson[] {
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
      tier: null,
      statTotals: { Weapons: 25, Health: 8, Grenade: 12, Super: 31, Melee: 4 },
    },
    {
      ...base,
      itemInstanceId: D2ARMORPICKER_USER_INSTANCE_IDS[1],
      itemHash: 9_002,
      slot: "arms",
      setHash: 3_734_029_045,
      setName: "Ferropotent",
      displayName: "Ferropotent",
      tuningName: "+Weapons",
      statTotals: { Melee: -5, Super: 20, Grenade: 25, Weapons: 35 },
    },
    {
      ...base,
      itemInstanceId: D2ARMORPICKER_USER_INSTANCE_IDS[2],
      itemHash: 9_003,
      slot: "chest",
      setHash: 2_751_989_785,
      setName: "Smoke Jumper Set",
      displayName: "Smoke Jumper Set",
      tuningName: "+Super",
      statTotals: { Super: 25, Health: -5, Grenade: 25, Weapons: 30 },
    },
    {
      ...base,
      itemInstanceId: D2ARMORPICKER_USER_INSTANCE_IDS[3],
      itemHash: 9_004,
      slot: "legs",
      setHash: 3_734_029_045,
      setName: "Ferropotent",
      displayName: "Ferropotent",
      tuningName: "+Weapons",
      statTotals: { Super: 20, Health: -5, Grenade: 25, Weapons: 35 },
    },
    {
      ...base,
      itemInstanceId: D2ARMORPICKER_USER_INSTANCE_IDS[4],
      itemHash: 9_005,
      slot: "classItem",
      setHash: 2_751_989_785,
      setName: "Smoke Jumper Set",
      displayName: "Smoke Jumper Set",
      tuningName: "+Weapons",
      statTotals: { Class: 20, Health: -5, Grenade: 25, Weapons: 35 },
    },
  ];
}

function d2apDisplayPool(): DerivedArmorPieceJson[] {
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
      tier: null,
      statTotals: {
        Weapons: 25,
        Health: 8,
        Grenade: 4,
        Super: 31,
        Class: 4,
        Melee: 4,
      },
    },
    {
      ...base,
      itemInstanceId: D2ARMORPICKER_USER_INSTANCE_IDS[1],
      itemHash: 9_002,
      slot: "arms",
      setHash: 3_734_029_045,
      setName: "Ferropotent",
      displayName: "Ferropotent",
      tuningName: "+Weapons",
      tuningDeltas: [
        { stat: "Weapons", value: 5 },
        { stat: "Melee", value: -5 },
      ],
      statTotals: {
        Weapons: 30,
        Health: 5,
        Grenade: 25,
        Super: 20,
        Class: 5,
        Melee: 5,
      },
    },
    {
      ...base,
      itemInstanceId: D2ARMORPICKER_USER_INSTANCE_IDS[2],
      itemHash: 9_003,
      slot: "chest",
      setHash: 2_751_989_785,
      setName: "Smoke Jumper Set",
      displayName: "Smoke Jumper Set",
      tuningName: "+Super",
      tuningDeltas: [
        { stat: "Super", value: 5 },
        { stat: "Health", value: -5 },
      ],
      statTotals: {
        Weapons: 30,
        Health: 5,
        Grenade: 25,
        Super: 20,
        Class: 5,
        Melee: 5,
      },
    },
    {
      ...base,
      itemInstanceId: D2ARMORPICKER_USER_INSTANCE_IDS[3],
      itemHash: 9_004,
      slot: "legs",
      setHash: 3_734_029_045,
      setName: "Ferropotent",
      displayName: "Ferropotent",
      tuningName: "+Weapons",
      tuningDeltas: [
        { stat: "Weapons", value: 5 },
        { stat: "Health", value: -5 },
      ],
      statTotals: {
        Weapons: 30,
        Health: 5,
        Grenade: 25,
        Super: 20,
        Class: 5,
        Melee: 5,
      },
    },
    {
      ...base,
      itemInstanceId: D2ARMORPICKER_USER_INSTANCE_IDS[4],
      itemHash: 9_005,
      slot: "classItem",
      setHash: 2_751_989_785,
      setName: "Smoke Jumper Set",
      displayName: "Smoke Jumper Set",
      tuningName: "+Weapons",
      tuningDeltas: [
        { stat: "Weapons", value: 5 },
        { stat: "Health", value: -5 },
      ],
      statTotals: {
        Weapons: 30,
        Health: 5,
        Grenade: 25,
        Super: 5,
        Class: 20,
        Melee: 5,
      },
    },
  ];
}

describe("D2ArmorPicker Speaker's Sight parity (6917530125298828509)", () => {
  it("FAIL: legacy cache with wrong exotic Grenade 12 and baked tuning", () => {
    const result = verifyLoadout(legacyCachedPool(), {
      constraints: D2AP_TARGETS,
      assumedMods: MODS_3_2,
      setBonusSelections: SET,
    });
    expect(result.ok).toBe(false);
  });

  it("PASS: D2AP display + internal armor tuning row → 200/13/42/104/19/101", () => {
    const result = verifyLoadout(d2apDisplayPool(), {
      constraints: D2AP_TARGETS,
      assumedMods: MODS_3_2,
      setBonusSelections: SET,
    });
    expect(result.ok, !result.ok ? result.reason : "").toBe(true);
    if (result.ok) {
      expect(result.resolved.totals).toEqual({
        Weapons: 200,
        Health: 13,
        Class: 42,
        Grenade: 104,
        Melee: 19,
        Super: 101,
      });
      expect(result.resolved.modAllocation).toEqual({ Class: 3, Weapons: 40 });
    }
  });

  it("PASS: legacy cache after exotic Grenade/Class correction", () => {
    const pool = legacyCachedPool().map((p) =>
      p.isExotic
        ? {
            ...p,
            statTotals: {
              Weapons: 25,
              Health: 8,
              Grenade: 4,
              Super: 31,
              Class: 4,
              Melee: 4,
            },
          }
        : p,
    );
    const resolved = resolveLoadoutTotals(pool, D2AP_TARGETS, {}, MODS_3_2);
    expect(resolved?.totals).toEqual({
      Weapons: 200,
      Health: 13,
      Class: 42,
      Grenade: 104,
      Melee: 19,
      Super: 101,
    });
  });
});
