/**
 * Verify the reference five-piece from inventory_cache with D2AP six-stat targets.
 * Run: NODE_OPTIONS='--require ./scripts/stub-server-only.cjs' npx tsx --tsconfig tsconfig.json scripts/verify-d2ap-six-stat-cache.ts
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

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

const D2AP_6 = [
  { stat: "Weapons" as const, min: 200 },
  { stat: "Health" as const, min: 13 },
  { stat: "Class" as const, min: 42 },
  { stat: "Grenade" as const, min: 104 },
  { stat: "Melee" as const, min: 19 },
  { stat: "Super" as const, min: 101 },
];

const MODS = { majorCount: 3, slotFill: true, artifice: true };

async function main(): Promise<void> {
  const { getServiceRoleClient } = await import("../src/lib/db/server");
  const { verifyLoadout } = await import("../src/lib/optimizer/verify-loadout");
  const { searchLoadouts } = await import("../src/lib/optimizer/search");
  const { filterOptimizerPool } = await import("../src/lib/optimizer/pool");
  const { getManifestLookups } = await import("../src/lib/manifest/lookups");
  const { buildOptimizerLookupPayload } = await import(
    "../src/lib/views/optimizer-lookup-payload.server"
  );

  const sb = getServiceRoleClient();
  const { data: rows } = await sb.from("inventory_cache").select("items");

  let inv: import("../src/lib/db/types").DerivedArmorPieceJson[] = [];
  for (const row of rows ?? []) {
    const items = row.items as import("../src/lib/db/types").DerivedArmorPieceJson[];
    if (Array.isArray(items)) {
      inv.push(...items.filter((p) => p.classType === 2));
    }
  }

  const pieces = IDS.map((id) => inv.find((p) => p.itemInstanceId === id)).filter(
    (p): p is NonNullable<typeof p> => p != null,
  );

  console.log("found pieces:", pieces.length);
  console.log("helmet statTotals:", pieces[0]?.statTotals);

  const v = verifyLoadout(pieces, {
    constraints: D2AP_6,
    assumedMods: MODS,
    setBonusSelections: SET,
  });
  console.log("verify D2AP 6-stat:", v.ok);
  if (v.ok) {
    console.log("totals:", v.resolved.totals);
    console.log("mods:", v.resolved.modAllocation);
  } else {
    console.log("reason:", v.reason.slice(0, 400));
  }

  const lookups = await getManifestLookups();
  const opt = buildOptimizerLookupPayload(lookups);
  const exotic = pieces[0]!;
  const lock = {
    mode: "locked" as const,
    itemInstanceId: exotic.itemInstanceId,
    slot: exotic.slot,
  };
  const pool = filterOptimizerPool(inv, 2, {
    exoticLock: lock,
    exoticStatBudget: opt.exoticStatBudget,
  });

  console.log("\nRunning vault search (6-stat, 3 majors, ~30s)...");
  const t0 = Date.now();
  const solutions = searchLoadouts(
    {
      pool,
      constraints: D2AP_6,
      setBonusSelections: SET,
      assumedStatMods: MODS,
      exoticLock: lock,
      topN: 5,
    },
    undefined,
    () => false,
  );
  console.log("search ms:", Date.now() - t0, "solutions:", solutions.length);
  const knownSet = new Set(IDS);
  for (let i = 0; i < Math.min(solutions.length, 3); i++) {
    const sol = solutions[i]!;
    const ids = Object.values(sol.slots);
    const usesAll = [...knownSet].every((id) => ids.includes(id));
    console.log(`solution[${i}] uses all 5 known ids:`, usesAll, "totals:", sol.totals);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
