/**
 * Does the full Warlock vault contain the known D2AP five-piece as a feasible solution?
 * Run: NODE_OPTIONS='--require ./scripts/stub-server-only.cjs' npx tsx --tsconfig tsconfig.json scripts/diagnose-d2ap-vault.ts
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const IDS = new Set([
  "6917530125298828509",
  "6917530167771126356",
  "6917530146665347396",
  "6917530160150786116",
  "6917530147186685296",
]);

const SET = [
  { setHash: 3_734_029_045, requiredCount: 2, perkHash: 3_734_029_045 },
  { setHash: 2_751_989_785, requiredCount: 2, perkHash: 2_751_989_785 },
];

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

const MODS_5 = { majorCount: 5, slotFill: true, artifice: true };
const MODS_3 = { majorCount: 3, slotFill: true, artifice: true };

async function main() {
  const { getServiceRoleClient } = await import("../src/lib/db/server");
  const { filterOptimizerPool } = await import("../src/lib/optimizer/pool");
  const { buildOptimizerLookupPayload } = await import(
    "../src/lib/views/optimizer-lookup-payload.server"
  );
  const { getManifestLookups } = await import("../src/lib/manifest/lookups");
  const { verifyLoadout } = await import("../src/lib/optimizer/verify-loadout");
  const { searchLoadouts } = await import("../src/lib/optimizer/search");
  const { estimateFilteredComboCount } = await import(
    "../src/lib/optimizer/combo-count"
  );

  const sb = getServiceRoleClient();
  const { data: rows } = await sb.from("inventory_cache").select("items");
  let inv: import("../src/lib/db/types").DerivedArmorPieceJson[] = [];
  for (const row of rows ?? []) {
    const items = row.items as import("../src/lib/db/types").DerivedArmorPieceJson[];
    if (Array.isArray(items)) inv.push(...items.filter((p) => p.classType === 2));
  }

  const lookups = await getManifestLookups();
  const opt = buildOptimizerLookupPayload(lookups);
  const exotic = inv.find((p) => p.itemInstanceId === "6917530125298828509")!;
  const lock = {
    mode: "locked" as const,
    itemInstanceId: exotic.itemInstanceId,
    slot: exotic.slot,
  };
  const pool = filterOptimizerPool(inv, 2, {
    exoticLock: lock,
    exoticStatBudget: opt.exoticStatBudget,
  });

  const knownFive = [...IDS]
    .map((id) => inv.find((p) => p.itemInstanceId === id))
    .filter(Boolean) as import("../src/lib/db/types").DerivedArmorPieceJson[];

  console.log("vault pool (locked SS):", pool.length);
  console.log("known five in inv:", knownFive.length);
  console.log(
    "known five in filtered pool:",
    knownFive.every((p) => pool.some((x) => x.itemInstanceId === p.itemInstanceId)),
  );

  for (const [label, constraints, mods] of [
    ["D2AP 3-stat + 5 majors", D2AP_3, MODS_5],
    ["D2AP 3-stat + 3 majors", D2AP_3, MODS_3],
    ["UI 5-stat + 5 majors", UI_5, MODS_5],
  ] as const) {
    const v = verifyLoadout(knownFive, {
      constraints,
      assumedMods: mods,
      setBonusSelections: SET,
    });
    const est = estimateFilteredComboCount(pool, lock, {
      constraints,
      setBonusSelections: SET,
      assumedMods: mods,
      cap: 3,
    });
    console.log(`\n${label}:`);
    console.log("  verify known five:", v.ok, !v.ok ? v.reason.slice(0, 90) : "");
    console.log("  vault feasible estimate (cap 3):", est);
  }

  // Full search for D2AP 3-stat — may take a while
  console.log("\nRunning vault search (D2AP 3-stat, 5 majors, set bonuses)...");
  const t0 = Date.now();
  const solutions = searchLoadouts(
    {
      pool,
      constraints: D2AP_3,
      setBonusSelections: SET,
      assumedStatMods: MODS_5,
      exoticLock: lock,
      topN: 5,
    },
    undefined,
    () => false,
  );
  console.log("search ms:", Date.now() - t0, "solutions:", solutions.length);
  if (solutions[0]) {
    const slots = solutions[0].slots;
    const usesKnown = [...IDS].every((id) => Object.values(slots).includes(id));
    console.log("first solution slots:", slots);
    console.log("first solution uses all 5 known ids:", usesKnown);
    console.log("first totals:", solutions[0].totals);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
