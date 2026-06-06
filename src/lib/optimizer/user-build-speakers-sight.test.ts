import { describe, expect, it } from "vitest";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import { searchLoadouts } from "@/lib/optimizer/search";
import { verifyLoadout } from "@/lib/optimizer/verify-loadout";
import { resolveLoadoutTotals } from "@/lib/optimizer/resolve-loadout-totals";
import { estimateFilteredComboCount } from "@/lib/optimizer/combo-count";
import { computeStatBounds } from "@/lib/optimizer/bounds";
import { DEFAULT_EXOTIC_LOCK } from "@/lib/optimizer/exotic-lock";

/** Real manifest set hashes from inventory cache. */
const FERROPOTENT_HASH = 3_734_029_045;
const SMOKE_JUMPER_HASH = 2_751_989_785;

/** User DIM loadout instance ids (Warlock Speaker's Sight + Ferropotent / Smoke Jumper). */
export const USER_DIM_INSTANCE_IDS = [
  "6917530125283917710",
  "6917530167771126356",
  "6917530146795020473",
  "6917530159911796935",
  "6917530147186685296",
] as const;

/**
 * Stat totals from Bungie ItemStats (304) on Speaker's Sight plus cached
 * legendary `statTotals` rows (sparse — only non-zero stats stored).
 */
function userBuildPool(): DerivedArmorPieceJson[] {
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
      itemInstanceId: USER_DIM_INSTANCE_IDS[0],
      itemHash: 50_291_571,
      slot: "helmet",
      isExotic: true,
      setHash: null,
      setName: null,
      displayName: "Speaker's Sight",
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
      itemInstanceId: USER_DIM_INSTANCE_IDS[1],
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
      itemInstanceId: USER_DIM_INSTANCE_IDS[2],
      itemHash: 9_003,
      slot: "chest",
      setHash: SMOKE_JUMPER_HASH,
      setName: "Smoke Jumper Set",
      displayName: "Smoke Jumper Set",
      tuningName: "+Grenade",
      primaryStat: "Weapons" as const,
      secondaryStat: "Grenade" as const,
      tertiaryStat: "Super" as const,
      statTotals: {
        Super: 20,
        Health: -5,
        Grenade: 30,
        Weapons: 30,
      },
    },
    {
      ...base,
      itemInstanceId: USER_DIM_INSTANCE_IDS[3],
      itemHash: 9_004,
      slot: "legs",
      setHash: FERROPOTENT_HASH,
      setName: "Ferropotent",
      displayName: "Ferropotent",
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
    {
      ...base,
      itemInstanceId: USER_DIM_INSTANCE_IDS[4],
      itemHash: 9_005,
      slot: "classItem",
      setHash: SMOKE_JUMPER_HASH,
      setName: "Smoke Jumper Set",
      displayName: "Smoke Jumper Set",
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

const SCREENSHOT_CONSTRAINTS = [
  { stat: "Weapons" as const, min: 210 },
  { stat: "Class" as const, min: 50 },
  { stat: "Grenade" as const, min: 100 },
  { stat: "Super" as const, min: 70 },
];

const SET_BONUSES = [
  { setHash: FERROPOTENT_HASH, requiredCount: 2, perkHash: FERROPOTENT_HASH },
  { setHash: SMOKE_JUMPER_HASH, requiredCount: 2, perkHash: SMOKE_JUMPER_HASH },
];

const ASSUMED_MODS = { majorCount: 5, slotFill: true, artifice: true };

describe("Speaker's Sight user build (real stat totals)", () => {
  const pool = userBuildPool();
  const locked = {
    mode: "locked" as const,
    itemInstanceId: USER_DIM_INSTANCE_IDS[0],
    slot: "helmet" as const,
  };

  it("finds zero loadouts when exotics are excluded (default lock)", () => {
    const { count } = estimateFilteredComboCount(pool, DEFAULT_EXOTIC_LOCK, {
      constraints: SCREENSHOT_CONSTRAINTS,
      setBonusSelections: SET_BONUSES,
      assumedMods: ASSUMED_MODS,
      cap: 1,
    });
    expect(count).toBe(0);
  });

  it("rejects Weapons 210 — five +10 mods cannot close the gap on these rolls", () => {
    const five = pool;
    expect(
      resolveLoadoutTotals(five, SCREENSHOT_CONSTRAINTS, {}, ASSUMED_MODS),
    ).toBeNull();
    expect(
      searchLoadouts({
        pool,
        constraints: SCREENSHOT_CONSTRAINTS,
        setBonusSelections: SET_BONUSES,
        assumedStatMods: ASSUMED_MODS,
        exoticLock: locked,
      }).length,
    ).toBe(0);
  });

  it("finds the build at Weapons 196 with Speaker's Sight locked", () => {
    const constraints = SCREENSHOT_CONSTRAINTS.map((row) =>
      row.stat === "Weapons" ? { ...row, min: 196 } : row,
    );
    const solutions = searchLoadouts({
      pool,
      constraints,
      setBonusSelections: SET_BONUSES,
      assumedStatMods: ASSUMED_MODS,
      exoticLock: locked,
    });
    expect(solutions.length).toBeGreaterThan(0);
    const totals = solutions[0]!.totals;
    expect(totals.Weapons).toBeGreaterThanOrEqual(196);
    expect(totals.Grenade).toBeGreaterThanOrEqual(100);
    expect(totals.Super).toBeGreaterThanOrEqual(70);
    expect(totals.Class).toBeGreaterThanOrEqual(50);
  });

  it("verifyLoadout fails when Speaker's Sight has empty statTotals", () => {
    const five = pool.map((p) =>
      p.isExotic
        ? {
            ...p,
            statTotals: {},
            primaryStat: null,
            secondaryStat: null,
            tertiaryStat: null,
          }
        : p,
    );
    const result = verifyLoadout(five, {
      constraints: SCREENSHOT_CONSTRAINTS.map((row) =>
        row.stat === "Weapons" ? { ...row, min: 196 } : row,
      ),
      assumedMods: ASSUMED_MODS,
      setBonusSelections: SET_BONUSES,
    });
    expect(result.ok).toBe(false);
  });

  it("allows stacked tuning debuffs on non-target stats (Health floors at 0)", () => {
    const result = verifyLoadout(pool, {
      constraints: SCREENSHOT_CONSTRAINTS.map((row) =>
        row.stat === "Weapons" ? { ...row, min: 196 } : row,
      ),
      assumedMods: ASSUMED_MODS,
      setBonusSelections: SET_BONUSES,
    });
    expect(result.ok).toBe(true);
  });

  it("slider gray bands stay non-zero with set bonuses on the user build", () => {
    const constraints = [
      { stat: "Weapons" as const, min: 196 },
      { stat: "Class" as const, min: 50 },
      { stat: "Grenade" as const, min: 100 },
      { stat: "Super" as const, min: 70 },
    ];
    const mods = { majorCount: 3, slotFill: true, artifice: true };
    const bounds = computeStatBounds(
      pool,
      {},
      locked,
      constraints,
      mods,
      SET_BONUSES,
    );
    expect(bounds.Weapons.max).toBeGreaterThan(0);
    expect(bounds.Grenade.max).toBeGreaterThan(0);
    expect(bounds.Weapons.max).toBeGreaterThanOrEqual(bounds.Weapons.min);
    expect(bounds.Grenade.max).toBeGreaterThanOrEqual(bounds.Grenade.min);
  });

  it("does not zero bounds when greedy fails on a tiny pool", () => {
    const bounds = computeStatBounds(
      pool,
      {},
      locked,
      [
        { stat: "Weapons" as const, min: 200 },
        { stat: "Super" as const, min: 200 },
      ],
      { majorCount: 3, slotFill: true, artifice: true },
      SET_BONUSES,
    );
    expect(bounds.Weapons.max).toBeGreaterThan(0);
    expect(bounds.Super.max).toBeGreaterThan(0);
  });
});
