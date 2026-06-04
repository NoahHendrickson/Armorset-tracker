/**
 * Reproduce exact user scenario: Ferropotent + Smoke Jumper sets, locked Speaker's Sight,
 * D2AP six-stat targets, 3 major + 2 minor + artifice mods.
 *
 * Run: NODE_OPTIONS='--require ./scripts/stub-server-only.cjs' \
 *   npx tsx --tsconfig tsconfig.json scripts/diagnose-user-scenario.ts
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const KNOWN_IDS = [
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

const D2AP_TARGETS = [
  { stat: "Weapons" as const, min: 200 },
  { stat: "Health" as const, min: 13 },
  { stat: "Class" as const, min: 42 },
  { stat: "Grenade" as const, min: 104 },
  { stat: "Melee" as const, min: 19 },
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
  const { verifyLoadout } = await import("../src/lib/optimizer/verify-loadout");
  const { searchLoadouts } = await import("../src/lib/optimizer/search");
  const { estimateFilteredComboCount } = await import(
    "../src/lib/optimizer/combo-count"
  );
  const { totalsFromPieces } = await import("../src/lib/optimizer/constraints");
  const { resolveLoadoutTotals } = await import(
    "../src/lib/optimizer/resolve-loadout-totals"
  );
  type DerivedArmorPieceJson =
    import("../src/lib/db/types").DerivedArmorPieceJson;

  const sb = getServiceRoleClient();
  const { data: rows } = await sb.from("inventory_cache").select("items");
  let inv: DerivedArmorPieceJson[] = [];
  for (const row of rows ?? []) {
    const items = row.items as DerivedArmorPieceJson[] | null;
    if (Array.isArray(items)) {
      inv.push(...items.filter((p) => p.classType === 2));
    }
  }

  const lookups = await getManifestLookups();
  const opt = buildOptimizerLookupPayload(lookups);
  const helmet = inv.find((p) => p.itemInstanceId === KNOWN_IDS[0]);
  if (!helmet) {
    console.log("Speaker's Sight not in cache");
    return;
  }

  const lock = {
    mode: "locked" as const,
    itemInstanceId: helmet.itemInstanceId,
    slot: helmet.slot,
  };
  const pool = filterOptimizerPool(inv, 2, {
    exoticLock: lock,
    exoticStatBudget: opt.exoticStatBudget,
  });

  const knownFive = KNOWN_IDS.map((id) => inv.find((p) => p.itemInstanceId === id)).filter(
    Boolean,
  ) as DerivedArmorPieceJson[];

  console.log("=== Inventory state ===");
  console.log("helmet statTotals:", helmet.statTotals);
  console.log("helmet tuningDeltas:", helmet.tuningDeltas ?? null);
  console.log("pool size:", pool.length);
  console.log("known five in pool:", knownFive.every((p) => pool.some((x) => x.itemInstanceId === p.itemInstanceId)));

  for (const p of knownFive) {
    console.log(
      `${p.slot} ${p.displayName ?? p.setName}: display sum contrib`,
      totalsFromPieces([p]),
    );
  }

  console.log("\n=== Known five verify ===");
  const v = verifyLoadout(knownFive, {
    constraints: D2AP_TARGETS,
    assumedMods: MODS_3_2,
    setBonusSelections: SET,
  });
  console.log("verify:", v.ok);
  if (v.ok) {
    console.log("totals:", v.resolved.totals);
    console.log("mods:", v.resolved.modAllocation);
  } else {
    console.log("reason:", v.reason.slice(0, 500));
  }

  const resolved = resolveLoadoutTotals(knownFive, D2AP_TARGETS, {}, MODS_3_2);
  console.log("resolveLoadoutTotals:", resolved?.totals ?? null);

  console.log("\n=== Vault combo estimate (cap 1) ===");
  const est = estimateFilteredComboCount(pool, lock, {
    constraints: D2AP_TARGETS,
    setBonusSelections: SET,
    assumedMods: MODS_3_2,
    cap: 1,
  });
  console.log("feasible count:", est);

  const D2AP_3 = [
    { stat: "Weapons" as const, min: 200 },
    { stat: "Grenade" as const, min: 100 },
    { stat: "Super" as const, min: 100 },
  ];
  const fiveOnly = knownFive;

  console.log("\n=== Search matrix ===");
  for (const [label, searchPool, constraints, sets] of [
    ["full vault 6-stat+sets", pool, D2AP_TARGETS, SET],
    ["full vault 3-stat+sets", pool, D2AP_3, SET],
    ["full vault 6-stat no sets", pool, D2AP_TARGETS, []],
    ["five only 6-stat+sets", fiveOnly, D2AP_TARGETS, SET],
  ] as const) {
    const est = estimateFilteredComboCount(searchPool, lock, {
      constraints,
      setBonusSelections: sets,
      assumedMods: MODS_3_2,
      cap: 1,
    });
    const t0 = Date.now();
    const solutions = searchLoadouts(
      {
        pool: searchPool,
        constraints,
        setBonusSelections: sets,
        assumedStatMods: MODS_3_2,
        exoticLock: lock,
        topN: 3,
      },
      undefined,
      () => false,
    );
    console.log(
      label,
      "| combo:",
      est.count,
      "| search:",
      solutions.length,
      `(${Date.now() - t0}ms)`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
