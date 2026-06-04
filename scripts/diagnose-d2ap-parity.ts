/**
 * D2ArmorPicker screenshot parity check for the known five-piece build.
 * Run: npx tsx --tsconfig tsconfig.json scripts/diagnose-d2ap-parity.ts
 */
import { verifyLoadout } from "../src/lib/optimizer/verify-loadout";
import { resolveLoadoutTotals } from "../src/lib/optimizer/resolve-loadout-totals";
import { totalsFromPieces } from "../src/lib/optimizer/constraints";
import { addStatOffsets } from "../src/lib/optimizer/fragment-offset";
import type { DerivedArmorPieceJson } from "../src/lib/db/types";

const SET = [
  { setHash: 3_734_029_045, requiredCount: 2, perkHash: 3_734_029_045 },
  { setHash: 2_751_989_785, requiredCount: 2, perkHash: 2_751_989_785 },
];

/** D2AP screenshot targets (all six pinned). */
const D2AP_TARGETS = [
  { stat: "Weapons" as const, min: 200 },
  { stat: "Health" as const, min: 13 },
  { stat: "Class" as const, min: 42 },
  { stat: "Grenade" as const, min: 104 },
  { stat: "Melee" as const, min: 19 },
  { stat: "Super" as const, min: 101 },
];

const MODS_3_2 = { majorCount: 3, slotFill: true, artifice: true };

/** D2AP "Tuning" row from screenshot (not subclass fragments — armor tuning net). */
const D2AP_TUNING_ROW = {
  Weapons: 15,
  Health: -15,
  Melee: -5,
  Super: 5,
  Class: 0,
  Grenade: 0,
};

const base = {
  classType: 2,
  archetypeHash: 1,
  archetypeName: "Gunner",
  tuningCommitted: true,
  tier: 5 as const,
  location: { kind: "vault" as const },
};

/** Our cached inventory stats for the five instance IDs. */
function ourCachedPool(): DerivedArmorPieceJson[] {
  return [
    {
      ...base,
      itemInstanceId: "6917530125298828509",
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
      itemInstanceId: "6917530167771126356",
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
      itemInstanceId: "6917530146665347396",
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
      itemInstanceId: "6917530160150786116",
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
      itemInstanceId: "6917530147186685296",
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

/** D2AP per-piece display stats (positive rows in screenshot). */
function d2apDisplayPool(): DerivedArmorPieceJson[] {
  const mk = (
    id: string,
    slot: DerivedArmorPieceJson["slot"],
    stats: Partial<Record<string, number>>,
    extra: Partial<DerivedArmorPieceJson> = {},
  ): DerivedArmorPieceJson => ({
    ...base,
    itemInstanceId: id,
    itemHash: 9_000,
    slot,
    setHash: extra.setHash ?? 1,
    setName: "Set",
    displayName: "Piece",
    statTotals: stats,
    ...extra,
  });
  return [
    mk("6917530125298828509", "helmet", {
      Weapons: 25,
      Health: 8,
      Grenade: 4,
      Super: 31,
      Class: 4,
      Melee: 4,
    }, { isExotic: true, setHash: null, setName: null, displayName: "Speaker's Sight", tier: null }),
    mk("6917530167771126356", "arms", {
      Weapons: 30,
      Health: 5,
      Grenade: 25,
      Super: 20,
      Class: 5,
      Melee: 5,
    }, { setHash: 3_734_029_045, setName: "Ferropotent", displayName: "Ferropotent" }),
    mk("6917530146665347396", "chest", {
      Weapons: 30,
      Health: 5,
      Grenade: 25,
      Super: 20,
      Class: 5,
      Melee: 5,
    }, { setHash: 2_751_989_785, setName: "Smoke Jumper", displayName: "Smoke Jumper" }),
    mk("6917530160150786116", "legs", {
      Weapons: 30,
      Health: 5,
      Grenade: 25,
      Super: 20,
      Class: 5,
      Melee: 5,
    }, { setHash: 3_734_029_045, setName: "Ferropotent", displayName: "Ferropotent" }),
    mk("6917530147186685296", "classItem", {
      Weapons: 30,
      Health: 5,
      Grenade: 25,
      Super: 5,
      Class: 20,
      Melee: 5,
    }, { setHash: 2_751_989_785, setName: "Smoke Jumper", displayName: "Smoke Jumper" }),
  ];
}

function run(label: string, pool: DerivedArmorPieceJson[], tuningOffset: typeof D2AP_TUNING_ROW | null) {
  const offset = tuningOffset ?? { Weapons: 0, Health: 0, Class: 0, Grenade: 0, Melee: 0, Super: 0 };
  const v = verifyLoadout(pool, {
    constraints: D2AP_TARGETS,
    assumedMods: MODS_3_2,
    setBonusSelections: SET,
    fragmentOffset: offset,
  });
  const resolved = resolveLoadoutTotals(pool, D2AP_TARGETS, offset, MODS_3_2);
  console.log(`\n=== ${label} ===`);
  console.log("armor sum:", totalsFromPieces(pool));
  if (tuningOffset) console.log("+ tuning row:", tuningOffset);
  console.log("verify:", v.ok, !v.ok && !v.ok ? v.reason.split("\n")[0] : "");
  if (resolved) {
    console.log("resolved totals:", resolved.totals);
    console.log("mod allocation:", resolved.modAllocation);
  }
}

run("OUR cache, no tuning offset", ourCachedPool(), null);
run(
  "OUR cache + exotic Grenade 4 / Class 4 (post-derive)",
  ourCachedPool().map((p) =>
    p.itemInstanceId === "6917530125298828509"
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
  ),
  null,
);
run("OUR cache + D2AP tuning row as fragment offset", ourCachedPool(), D2AP_TUNING_ROW);
run("D2AP display stats, no tuning offset", d2apDisplayPool(), null);
run("D2AP display stats + tuning row", d2apDisplayPool(), D2AP_TUNING_ROW);

// Manual D2AP math from screenshot armor row
const armorRow = { Weapons: 143, Health: 6, Melee: 2, Grenade: 102, Super: 89, Class: 22 };
const withMods = addStatOffsets(armorRow, { Weapons: 40, Super: 3, Health: 0, Class: 0, Grenade: 0, Melee: 0 });
const final = addStatOffsets(withMods, D2AP_TUNING_ROW);
console.log("\n=== D2AP screenshot math (armor row + mods + tuning) ===");
console.log("after mods:", withMods);
console.log("final:", final);
