/**
 * Verify screenshot builds: user targets + 5 majors vs D2AP 3+2 mods.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const SET = [
  { setHash: 3_734_029_045, requiredCount: 2, perkHash: 3_734_029_045 },
  { setHash: 2_751_989_785, requiredCount: 2, perkHash: 2_751_989_785 },
];

/** Screenshot 2 slider mins (Mobility→Weapons … Strength→Melee). */
const APP_TARGETS = [
  { stat: "Weapons" as const, min: 200 },
  { stat: "Health" as const, min: 11 },
  { stat: "Class" as const, min: 42 },
  { stat: "Grenade" as const, min: 104 },
  { stat: "Melee" as const, min: 101 },
  { stat: "Super" as const, min: 25 },
];

/** D2AP screenshot 1 locked targets. */
const D2AP_SCREEN_TARGETS = [
  { stat: "Weapons" as const, min: 200 },
  { stat: "Health" as const, min: 8 },
  { stat: "Class" as const, min: 42 },
  { stat: "Grenade" as const, min: 104 },
  { stat: "Melee" as const, min: 24 },
  { stat: "Super" as const, min: 101 },
];

const MODS_5_MAJ = { majorCount: 5, slotFill: true, artifice: true };
const MODS_3_2 = { majorCount: 3, slotFill: true, artifice: true };

async function main(): Promise<void> {
  const { getServiceRoleClient } = await import("../src/lib/db/server");
  const { filterOptimizerPool } = await import("../src/lib/optimizer/pool");
  const { buildOptimizerLookupPayload } = await import(
    "../src/lib/views/optimizer-lookup-payload.server"
  );
  const { getManifestLookups } = await import("../src/lib/manifest/lookups");
  const { verifyLoadout } = await import("../src/lib/optimizer/verify-loadout");
  const { searchLoadouts } = await import("../src/lib/optimizer/search");
  const { resolveLoadoutTotals } = await import(
    "../src/lib/optimizer/resolve-loadout-totals"
  );
  const { totalsFromPieces } = await import("../src/lib/optimizer/constraints");
  const { totalAssumedModBudget } = await import("../src/lib/optimizer/mod-offset");

  const sb = getServiceRoleClient();
  const { data: rows } = await sb.from("inventory_cache").select("items");
  let inv: import("../src/lib/db/types").DerivedArmorPieceJson[] = [];
  for (const row of rows ?? []) {
    const items = row.items as import("../src/lib/db/types").DerivedArmorPieceJson[] | null;
    if (Array.isArray(items)) inv.push(...items.filter((p) => p.classType === 2));
  }

  const lookups = await getManifestLookups();
  const opt = buildOptimizerLookupPayload(lookups);
  const helmet = inv.find((p) => p.itemInstanceId === "6917530125298828509")!;
  const lock = {
    mode: "locked" as const,
    itemInstanceId: helmet.itemInstanceId,
    slot: helmet.slot,
  };
  const pool = filterOptimizerPool(inv, 2, {
    exoticLock: lock,
    exoticStatBudget: opt.exoticStatBudget,
  });

  console.log("Mod budgets:");
  console.log("  5 major:", totalAssumedModBudget(MODS_5_MAJ));
  console.log("  3+2:", totalAssumedModBudget(MODS_3_2));

  const { resolveLoadoutStatExtremum } = await import(
    "../src/lib/optimizer/resolve-loadout-totals"
  );
  const maxMeleeWithAllTargets = resolveLoadoutStatExtremum(
    pool,
    APP_TARGETS,
    {},
    MODS_5_MAJ,
    "Melee",
    "max",
  );
  console.log("\nMax achievable Melee (app targets, 5 majors):", maxMeleeWithAllTargets);

  for (const [label, constraints, mods] of [
    ["App screenshot targets + 5 majors", APP_TARGETS, MODS_5_MAJ],
    ["App screenshot targets + D2AP 3+2 mods", APP_TARGETS, MODS_3_2],
    ["D2AP screenshot targets + 3+2 mods", D2AP_SCREEN_TARGETS, MODS_3_2],
  ] as const) {
    console.log(`\n=== ${label} ===`);
    const solutions = searchLoadouts(
      {
        pool,
        constraints,
        setBonusSelections: SET,
        assumedStatMods: mods,
        exoticLock: lock,
        topN: 3,
      },
      undefined,
      () => false,
    );
    console.log("solutions:", solutions.length);
    for (const [i, sol] of solutions.entries()) {
      const pieces = Object.values(sol.slots).map(
        (id) => inv.find((p) => p.itemInstanceId === id)!,
      );
      const v = verifyLoadout(pieces, {
        constraints,
        assumedMods: mods,
        setBonusSelections: SET,
      });
      console.log(`#${i + 1} totals:`, sol.totals);
      console.log(`   mods:`, sol.resolved?.modAllocation);
      console.log(`   armor display sum:`, totalsFromPieces(pieces));
      console.log(`   verify:`, v.ok);
      console.log(
        `   slots:`,
        pieces.map((p) => `${p.slot}:${p.displayName ?? p.setName}`).join(", "),
      );
    }
    if (solutions.length === 0) {
      console.log("  (no builds — targets may be infeasible with this mod budget)");
    }
  }

  // Re-check reference five with D2AP screenshot targets
  const refIds = [
    "6917530125298828509",
    "6917530167771126356",
    "6917530146665347396",
    "6917530160150786116",
    "6917530147186685296",
  ];
  const refFive = refIds.map((id) => inv.find((p) => p.itemInstanceId === id)!);
  console.log("\n=== Reference D2AP five-piece ===");
  for (const [label, constraints, mods] of [
    ["D2AP screen targets", D2AP_SCREEN_TARGETS, MODS_3_2],
    ["Handoff targets (13/19)", [
      { stat: "Weapons" as const, min: 200 },
      { stat: "Health" as const, min: 13 },
      { stat: "Class" as const, min: 42 },
      { stat: "Grenade" as const, min: 104 },
      { stat: "Melee" as const, min: 19 },
      { stat: "Super" as const, min: 101 },
    ], MODS_3_2],
  ] as const) {
    const r = resolveLoadoutTotals(refFive, constraints, {}, mods);
    console.log(label, r?.totals ?? "FAIL", r?.modAllocation ?? "");
  }
}

main().catch(console.error);
