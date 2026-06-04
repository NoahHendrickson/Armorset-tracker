import { describe, expect, it } from "vitest";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import { computeStatBounds } from "@/lib/optimizer/bounds";
import { defaultStatConstraints } from "@/lib/optimizer/constraints";
import { searchLoadouts } from "@/lib/optimizer/search";
import { verifyLoadout } from "@/lib/optimizer/verify-loadout";

/** Real manifest set hashes from inventory cache. */
export const FERROPOTENT_HASH = 3_734_029_045;
export const SMOKE_JUMPER_HASH = 2_751_989_785;

/** D2ArmorPicker reference build (Boots of the Assembler exotic legs). */
export const BOOTS_ASSEMBLER_INSTANCE_IDS = [
  "6917530147055270152",
  "6917530167771126356",
  "6917530146665347396",
  "6917530158828866218",
  "6917530159155527574",
] as const;

/**
 * Sparse stat totals from cached inventory (see docs/optimizer-gray-band-bounds-handoff.md §3).
 */
export function userBuildPool(): DerivedArmorPieceJson[] {
  const base = {
    classType: 2,
    archetypeHash: 1,
    archetypeName: "Gunner",
    tuningHash: 1,
    tuningName: "+Weapons",
    tuningCommitted: true,
    tier: 5 as const,
    location: { kind: "vault" as const },
  };

  return [
    {
      ...base,
      itemInstanceId: BOOTS_ASSEMBLER_INSTANCE_IDS[0],
      itemHash: 9_001,
      slot: "helmet",
      setHash: SMOKE_JUMPER_HASH,
      setName: "Smoke Jumper Set",
      displayName: "Smoke Jumper Set",
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
      itemInstanceId: BOOTS_ASSEMBLER_INSTANCE_IDS[1],
      itemHash: 9_002,
      slot: "arms",
      setHash: FERROPOTENT_HASH,
      setName: "Ferropotent",
      displayName: "Ferropotent",
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
      itemInstanceId: BOOTS_ASSEMBLER_INSTANCE_IDS[2],
      itemHash: 9_003,
      slot: "chest",
      setHash: SMOKE_JUMPER_HASH,
      setName: "Smoke Jumper Set",
      displayName: "Smoke Jumper Set",
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
      itemInstanceId: BOOTS_ASSEMBLER_INSTANCE_IDS[3],
      itemHash: 9_004,
      slot: "legs",
      isExotic: true,
      setHash: null,
      setName: null,
      displayName: "Boots of the Assembler",
      primaryStat: "Weapons" as const,
      secondaryStat: "Grenade" as const,
      tertiaryStat: "Super" as const,
      statTotals: {
        Super: 12,
        Grenade: 19,
        Weapons: 30,
      },
    },
    {
      ...base,
      itemInstanceId: BOOTS_ASSEMBLER_INSTANCE_IDS[4],
      itemHash: 9_005,
      slot: "classItem",
      setHash: FERROPOTENT_HASH,
      setName: "Ferropotent",
      displayName: "Ferropotent",
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
  ];
}

/** Vault-style filler: alternate rolls per slot (still needs set bonuses + exotic lock). */
export function vaultFillerPieces(): DerivedArmorPieceJson[] {
  const base = {
    classType: 2,
    archetypeHash: 1,
    archetypeName: "Gunner",
    tuningHash: 1,
    tuningName: "+Weapons",
    tuningCommitted: true,
    tier: 5 as const,
    location: { kind: "vault" as const },
  };

  return [
    {
      ...base,
      itemInstanceId: "filler-helmet-health",
      itemHash: 10_001,
      slot: "helmet",
      setHash: SMOKE_JUMPER_HASH,
      setName: "Smoke Jumper Set",
      displayName: "Smoke Jumper Set",
      primaryStat: "Health" as const,
      secondaryStat: "Grenade" as const,
      tertiaryStat: "Super" as const,
      statTotals: {
        Super: 5,
        Health: 25,
        Grenade: 25,
        Weapons: 30,
      },
    },
    {
      ...base,
      itemInstanceId: "filler-arms-melee",
      itemHash: 10_002,
      slot: "arms",
      setHash: FERROPOTENT_HASH,
      setName: "Ferropotent",
      displayName: "Ferropotent",
      primaryStat: "Melee" as const,
      secondaryStat: "Grenade" as const,
      tertiaryStat: "Super" as const,
      statTotals: {
        Melee: 25,
        Super: 5,
        Grenade: 25,
        Weapons: 30,
      },
    },
    {
      ...base,
      itemInstanceId: "filler-chest-class",
      itemHash: 10_003,
      slot: "chest",
      setHash: SMOKE_JUMPER_HASH,
      setName: "Smoke Jumper Set",
      displayName: "Smoke Jumper Set",
      primaryStat: "Class" as const,
      secondaryStat: "Grenade" as const,
      tertiaryStat: "Super" as const,
      statTotals: {
        Super: 5,
        Class: 25,
        Grenade: 25,
        Weapons: 30,
      },
    },
    {
      ...base,
      itemInstanceId: "filler-classItem-class",
      itemHash: 10_005,
      slot: "classItem",
      setHash: FERROPOTENT_HASH,
      setName: "Ferropotent",
      displayName: "Ferropotent",
      primaryStat: "Class" as const,
      secondaryStat: "Grenade" as const,
      tertiaryStat: "Super" as const,
      statTotals: {
        Super: 5,
        Grenade: 25,
        Weapons: 30,
      },
    },
  ];
}

const D2ARMORPICKER_CONSTRAINTS = [
  { stat: "Weapons" as const, min: 200 },
  { stat: "Grenade" as const, min: 100 },
  { stat: "Super" as const, min: 100 },
];

const SET_BONUSES = [
  { setHash: FERROPOTENT_HASH, requiredCount: 2, perkHash: FERROPOTENT_HASH },
  { setHash: SMOKE_JUMPER_HASH, requiredCount: 2, perkHash: SMOKE_JUMPER_HASH },
];

const ASSUMED_MODS = { majorCount: 3, slotFill: true, artifice: true };

describe("Boots of the Assembler user build (D2ArmorPicker gray bands)", () => {
  const referencePool = userBuildPool();
  const vaultPool = [...referencePool, ...vaultFillerPieces()];
  const locked = {
    mode: "locked" as const,
    itemInstanceId: BOOTS_ASSEMBLER_INSTANCE_IDS[3],
    slot: "legs" as const,
  };
  const sliderConstraints = defaultStatConstraints().map((row) => {
    const target = D2ARMORPICKER_CONSTRAINTS.find((c) => c.stat === row.stat);
    return target ? { ...row, min: target.min } : row;
  });

  it("finds the reference loadout at Weapons 200 / Grenade 100 / Super 100", () => {
    const solutions = searchLoadouts({
      pool: referencePool,
      constraints: D2ARMORPICKER_CONSTRAINTS,
      setBonusSelections: SET_BONUSES,
      assumedStatMods: ASSUMED_MODS,
      exoticLock: locked,
    });
    expect(solutions.length).toBeGreaterThanOrEqual(1);
    const totals = solutions[0]!.totals;
    expect(totals.Weapons).toBe(200);
    expect(totals.Grenade).toBe(119);
    expect(totals.Super).toBe(100);
    expect(totals.Health).toBe(-15);
    expect(totals.Class).toBe(0);
    expect(totals.Melee).toBe(-5);
  });

  it("verifyLoadout accepts the reference build totals", () => {
    const result = verifyLoadout(referencePool, {
      constraints: D2ARMORPICKER_CONSTRAINTS,
      assumedMods: ASSUMED_MODS,
      setBonusSelections: SET_BONUSES,
    });
    expect(result.ok).toBe(true);
  });

  it("matches D2ArmorPicker gray-band maxes on an expanded vault pool", () => {
    const bounds = computeStatBounds(
      vaultPool,
      {},
      locked,
      sliderConstraints,
      ASSUMED_MODS,
      SET_BONUSES,
    );

    expect(bounds.Health.max).toBeGreaterThanOrEqual(20);
    expect(bounds.Health.max).toBeLessThanOrEqual(30);
    expect(bounds.Melee.max).toBeGreaterThanOrEqual(20);
    expect(bounds.Melee.max).toBeLessThanOrEqual(30);
    expect(bounds.Class.max).toBeGreaterThanOrEqual(20);
    expect(bounds.Class.max).toBeLessThanOrEqual(30);
    expect(bounds.Super.max).toBeGreaterThanOrEqual(100);
    expect(bounds.Super.max).toBeLessThanOrEqual(102);
    expect(bounds.Grenade.max).toBeGreaterThanOrEqual(115);
    expect(bounds.Grenade.max).toBeLessThanOrEqual(125);
  });
});
