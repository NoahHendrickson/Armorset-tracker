/**
 * Why doesn't search find D2ArmorPicker's known five-piece loadout?
 * Run: npx tsx --tsconfig tsconfig.json scripts/diagnose-d2ap-five-piece.ts
 */
import { verifyLoadout } from "../src/lib/optimizer/verify-loadout";
import { searchLoadouts } from "../src/lib/optimizer/search";
import { totalsFromPieces } from "../src/lib/optimizer/constraints";
import { prepareDedupedSlotPool } from "../src/lib/optimizer/enumeration/prepare-slot-pool";
import { estimateFilteredComboCount } from "../src/lib/optimizer/combo-count";
import type { DerivedArmorPieceJson } from "../src/lib/db/types";

const IDS = [
  "6917530125298828509",
  "6917530167771126356",
  "6917530146665347396",
  "6917530160150786116",
  "6917530147186685296",
] as const;

const SET = [
  { setHash: 3_734_029_045, requiredCount: 2, perkHash: 3_734_029_045 },
  { setHash: 2_751_989_785, requiredCount: 2, perkHash: 2_751_989_785 },
];

const base = {
  classType: 2,
  archetypeHash: 1,
  archetypeName: "Gunner",
  tuningCommitted: true,
  tier: 5 as const,
  location: { kind: "vault" as const },
};

function buildPool(exoticStats: Partial<Record<string, number>>): DerivedArmorPieceJson[] {
  return [
    {
      ...base,
      itemInstanceId: IDS[0],
      itemHash: 50_291_571,
      slot: "helmet",
      isExotic: true,
      setHash: null,
      setName: null,
      displayName: "Speaker's Sight",
      tuningCommitted: false,
      tier: null,
      primaryStat: "Weapons",
      secondaryStat: "Health",
      tertiaryStat: "Grenade",
      statTotals: exoticStats,
    },
    {
      ...base,
      itemInstanceId: IDS[1],
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
      itemInstanceId: IDS[2],
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
      itemInstanceId: IDS[3],
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
      itemInstanceId: IDS[4],
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

const CACHED_EXOTIC = {
  Weapons: 25,
  Health: 8,
  Grenade: 12,
  Melee: 4,
  Super: 31,
};

const D2AP_EXOTIC = {
  Weapons: 25,
  Health: 8,
  Grenade: 4,
  Melee: 4,
  Super: 31,
  Class: 4,
};

const D2AP_3 = [
  { stat: "Weapons" as const, min: 200 },
  { stat: "Grenade" as const, min: 100 },
  { stat: "Super" as const, min: 100 },
];

const UI_5 = [
  ...D2AP_3,
  { stat: "Class" as const, min: 41 },
  { stat: "Melee" as const, min: 5 },
];

const MODS_3 = { majorCount: 3, slotFill: true, artifice: true };
const MODS_5 = { majorCount: 5, slotFill: true, artifice: true };

const lock = {
  mode: "locked" as const,
  itemInstanceId: IDS[0],
  slot: "helmet" as const,
};

function diagnose(
  label: string,
  pool: DerivedArmorPieceJson[],
  constraints: typeof D2AP_3,
  mods: typeof MODS_3,
) {
  const v = verifyLoadout(pool, {
    constraints,
    assumedMods: mods,
    setBonusSelections: SET,
  });
  const solutions = searchLoadouts({
    pool,
    constraints,
    setBonusSelections: SET,
    assumedStatMods: mods,
    exoticLock: lock,
    topN: 3,
  });
  console.log(`\n=== ${label} ===`);
  console.log("armor totals:", totalsFromPieces(pool));
  console.log("mod budget:", mods.majorCount, "majors, artifice:", mods.artifice);
  console.log("verify:", v.ok, !v.ok ? v.reason.split("\n")[0] : "");
  console.log("search hits:", solutions.length);
  if (solutions[0]) {
    console.log("first totals:", solutions[0].totals);
    console.log("mod allocation:", solutions[0].modAllocation);
  }
}

const cachedPool = buildPool(CACHED_EXOTIC);
const d2apPool = buildPool(D2AP_EXOTIC);

diagnose("cached exotic + D2AP 3-stat + 3 majors", cachedPool, D2AP_3, MODS_3);
diagnose("cached exotic + D2AP 3-stat + 5 majors", cachedPool, D2AP_3, MODS_5);
diagnose("cached exotic + UI 5-stat + 5 majors", cachedPool, UI_5, MODS_5);
diagnose("D2AP exotic stats + D2AP 3-stat + 3 majors", d2apPool, D2AP_3, MODS_3);
diagnose("D2AP exotic stats + D2AP 3-stat + 5 majors", d2apPool, D2AP_3, MODS_5);
diagnose("D2AP exotic stats + UI 5-stat + 5 majors", d2apPool, UI_5, MODS_5);

const prep = prepareDedupedSlotPool({ pool: cachedPool, exoticLock: lock });
console.log("\n=== dedupe (5-piece pool) ===");
console.log(
  "reps:",
  prep?.slotPieces.map((slot) =>
    slot.map((p) => `${p.slot}:${p.itemInstanceId}`),
  ),
);

const combo = estimateFilteredComboCount(cachedPool, lock, {
  constraints: D2AP_3,
  setBonusSelections: SET,
  assumedMods: MODS_5,
  cap: 5,
});
console.log("\n=== combo estimate (5-piece, 3-stat, 5 majors) ===", combo);
