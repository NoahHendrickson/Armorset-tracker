/**
 * Compare Health/Melee achievable max vs D2AP (8 / 24).
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const SET = [
  { setHash: 3_734_029_045, requiredCount: 2, perkHash: 3_734_029_045 },
  { setHash: 2_751_989_785, requiredCount: 2, perkHash: 2_751_989_785 },
];

/** D2AP screenshot pinned targets. */
const D2AP_TARGETS = [
  { stat: "Weapons" as const, min: 200 },
  { stat: "Health" as const, min: 8 },
  { stat: "Class" as const, min: 42 },
  { stat: "Grenade" as const, min: 104 },
  { stat: "Melee" as const, min: 24 },
  { stat: "Super" as const, min: 101 },
];

const MODS_3_2 = { majorCount: 3, slotFill: true, artifice: true };

async function main(): Promise<void> {
  const { getServiceRoleClient } = await import("../src/lib/db/server");
  const { filterOptimizerPool } = await import("../src/lib/optimizer/pool");
  const { buildOptimizerLookupPayload } = await import(
    "../src/lib/views/optimizer-lookup-payload.server"
  );
  const { getManifestLookups } = await import("../src/lib/manifest/lookups");
  const { computeStatBounds } = await import("../src/lib/optimizer/bounds");
  const {
    maxFeasibleStatTarget,
    maxAchievableUntargetedStat,
    maxAchievableUntargetedStatBounded,
  } = await import("../src/lib/optimizer/combo-count");
  const { resolveLoadoutStatExtremum } = await import(
    "../src/lib/optimizer/resolve-loadout-totals"
  );
  const { searchLoadouts } = await import("../src/lib/optimizer/search");
  const { independentStatBounds } = await import(
    "../src/lib/optimizer/bounds-independent"
  );

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

  const bounds = computeStatBounds(
    pool,
    {},
    lock,
    D2AP_TARGETS,
    MODS_3_2,
    SET,
  );

  console.log("=== Slider bounds (D2AP targets + sets + 3+2 mods) ===");
  console.log("Health:", bounds.Health);
  console.log("Melee:", bounds.Melee);
  console.log("bounds Grenade", bounds.Grenade);
  console.log("maxFeasible Grenade", maxFeasibleStatTarget(pool, lock, D2AP_TARGETS, "Grenade", { setBonusSelections: SET, assumedMods: MODS_3_2 }));

  console.log("\n=== maxFeasibleStatTarget (pinned stat max) ===");
  console.log("Health max:", maxFeasibleStatTarget(pool, lock, D2AP_TARGETS, "Health", { setBonusSelections: SET, assumedMods: MODS_3_2 }));
  console.log("Melee max:", maxFeasibleStatTarget(pool, lock, D2AP_TARGETS, "Melee", { setBonusSelections: SET, assumedMods: MODS_3_2 }));

  console.log("\n=== maxAchievableUntargetedStat (other stats constrained) ===");
  console.log("Health max while meeting other mins:", maxAchievableUntargetedStat(pool, lock, D2AP_TARGETS, "Health", { setBonusSelections: SET, assumedMods: MODS_3_2 }));
  console.log("Melee max while meeting other mins:", maxAchievableUntargetedStat(pool, lock, D2AP_TARGETS, "Melee", { setBonusSelections: SET, assumedMods: MODS_3_2 }));

  console.log("\n=== resolveLoadoutStatExtremum on best search build ===");
  const sol = searchLoadouts(
    { pool, constraints: D2AP_TARGETS, setBonusSelections: SET, assumedStatMods: MODS_3_2, exoticLock: lock, topN: 1 },
    undefined,
    () => false,
  )[0];
  if (sol) {
    const pieces = Object.values(sol.slots).map((id) => inv.find((p) => p.itemInstanceId === id)!);
    console.log("build totals:", sol.totals);
    console.log("Health min/max on this loadout:", resolveLoadoutStatExtremum(pieces, D2AP_TARGETS, {}, MODS_3_2, "Health", "min"), resolveLoadoutStatExtremum(pieces, D2AP_TARGETS, {}, MODS_3_2, "Health", "max"));
    console.log("Melee min/max on this loadout:", resolveLoadoutStatExtremum(pieces, D2AP_TARGETS, {}, MODS_3_2, "Melee", "min"), resolveLoadoutStatExtremum(pieces, D2AP_TARGETS, {}, MODS_3_2, "Melee", "max"));
  }

  console.log("\n=== Independent bounds (no cross-stat constraints) ===");
  const bySlot = (await import("../src/lib/optimizer/enumeration/pool-by-slot")).groupPoolBySlot(pool);
  const indep = (await import("../src/lib/optimizer/bounds-independent")).independentStatBounds(bySlot, lock);
  if (indep) {
    console.log("Health:", indep.Health);
    console.log("Melee:", indep.Melee);
  }

  const { computeHeuristicConstrainedStatBounds } = await import(
    "../src/lib/optimizer/bounds-heuristic"
  );
  for (const [label, mods] of [
    ["heuristic 3+2", MODS_3_2],
    ["heuristic 5 major", { majorCount: 5, slotFill: true, artifice: true }],
  ] as const) {
    const h = computeHeuristicConstrainedStatBounds(
      pool,
      D2AP_TARGETS,
      {},
      lock,
      mods,
      SET,
    );
    console.log(`\n${label} gray band max — Health:`, h.Health.max, "Melee:", h.Melee.max);
    const g = computeHeuristicConstrainedStatBounds(
      pool,
      D2AP_TARGETS,
      {},
      lock,
      mods,
      SET,
      { greedyOnly: true },
    );
    console.log(`${label} greedyOnly — Health:`, g.Health.max, "Melee:", g.Melee.max);
  }
}

main().catch(console.error);
