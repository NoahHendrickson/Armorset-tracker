/**
 * Verify a DIM loadout by instance id against cached inventory (no browser cookie).
 * Run: npx tsx --tsconfig tsconfig.json scripts/verify-dim-loadout.ts
 */
import { loadEnvConfig } from "@next/env";
import type { DerivedArmorPieceJson } from "../src/lib/db/types";

loadEnvConfig(process.cwd());

const DIM_IDS = [
  "6917530125283917710",
  "6917530167771126356",
  "6917530146795020473",
  "6917530159911796935",
  "6917530147186685296",
];

/** Screenshot targets: Weapons 200, Class 50, Grenade 100, Super 70; Health/Melee unset. */
const SCREENSHOT_CONSTRAINTS = [
  { stat: "Weapons" as const, min: 200 },
  { stat: "Class" as const, min: 50 },
  { stat: "Grenade" as const, min: 100 },
  { stat: "Super" as const, min: 70 },
];

const ASSUMED_MODS_SCREENSHOT = {
  majorCount: 5,
  slotFill: true,
  artifice: true,
};

async function main(): Promise<void> {
  const { getServiceRoleClient } = await import("../src/lib/db/server");
  const { getManifestLookups } = await import("../src/lib/manifest/lookups");
  const { buildOptimizerLookupPayload } = await import(
    "../src/lib/views/optimizer-lookup-payload.server"
  );
  const { enrichPieceWithExoticBudget } = await import(
    "../src/lib/inventory/exotic-stat-fallback"
  );
  const { verifyLoadout } = await import("../src/lib/optimizer/verify-loadout");
  const { totalsFromPieces } = await import("../src/lib/optimizer/constraints");
  const { totalAssumedModBudget } = await import("../src/lib/optimizer/mod-offset");
  const { countPiecesBySetHash } = await import("../src/lib/optimizer/set-bonus");
  const { searchLoadouts } = await import("../src/lib/optimizer/search");
  const { resolveLoadoutTotals } = await import(
    "../src/lib/optimizer/resolve-loadout-totals"
  );
  const { filterOptimizerPool } = await import("../src/lib/optimizer/pool");
  const { estimateFilteredComboCount } = await import(
    "../src/lib/optimizer/combo-count"
  );
  const { computeStatBounds } = await import("../src/lib/optimizer/bounds");
  const sb = getServiceRoleClient();
  const { data: rows, error } = await sb.from("inventory_cache").select("*");
  if (error) throw error;

  const idSet = new Set(DIM_IDS);
  let ownerUserId: string | null = null;
  const pieces: DerivedArmorPieceJson[] = [];

  for (const row of rows ?? []) {
    const items = row.items as unknown as DerivedArmorPieceJson[];
    if (!Array.isArray(items)) continue;
    const matched = items.filter((p) => idSet.has(p.itemInstanceId));
    if (matched.length === 0) continue;
    if (ownerUserId != null && row.user_id !== ownerUserId) {
      console.warn(
        "Warning: ids found under multiple users; using first match set.",
      );
    }
    ownerUserId ??= row.user_id;
    for (const id of DIM_IDS) {
      const p = items.find((x) => x.itemInstanceId === id);
      if (p) pieces.push(p);
    }
  }

  const missing = DIM_IDS.filter(
    (id) => !pieces.some((p) => p.itemInstanceId === id),
  );

  const report: Record<string, unknown> = {
    cacheRows: rows?.length ?? 0,
    ownerUserId: ownerUserId?.slice(0, 8) ?? null,
    requestedIds: DIM_IDS,
    missingIds: missing,
    found: pieces.length,
    assumedModBudget: totalAssumedModBudget(ASSUMED_MODS_SCREENSHOT),
    pieces: pieces.map((p) => ({
      itemInstanceId: p.itemInstanceId,
      slot: p.slot,
      displayName: p.displayName ?? p.setName,
      isExotic: p.isExotic === true,
      setHash: p.setHash,
      setName: p.setName,
      classType: p.classType,
      tier: p.tier ?? null,
      tuningCommitted: p.tuningCommitted ?? null,
      tuningName: p.tuningName,
      statTotals: p.statTotals ?? null,
      hasStatTotals:
        p.statTotals != null && Object.keys(p.statTotals).length > 0,
      tuningVariantCount: p.tuningVariants?.length ?? 0,
    })),
  };

  if (pieces.length > 0) {
    report.armorTotals = totalsFromPieces(pieces);
  }

  const setCounts = Object.fromEntries(countPiecesBySetHash(pieces).entries());
  report.setPieceCounts = setCounts;

  const lookups = await getManifestLookups();
  const optimizerLookup = buildOptimizerLookupPayload(lookups);
  const enrichedPieces = pieces.map((p) =>
    enrichPieceWithExoticBudget(p, optimizerLookup.exoticStatBudget),
  );
  const helmet = pieces.find((p) => p.slot === "helmet");
  if (helmet?.isExotic) {
    report.speakersSightItemHash = helmet.itemHash;
    report.speakersSightEnrichedTotals = enrichedPieces.find(
      (p) => p.slot === "helmet",
    )?.statTotals;
    report.exoticBudgetByHash =
      optimizerLookup.exoticStatBudget.byItemHash[String(helmet.itemHash)] ??
      null;
  }

  if (pieces.length === 5 && missing.length === 0) {
    report.verifyRawCache = verifyLoadout(pieces, {
      constraints: SCREENSHOT_CONSTRAINTS,
      assumedMods: ASSUMED_MODS_SCREENSHOT,
    });

    report.armorTotalsEnriched = totalsFromPieces(enrichedPieces);
    report.verifyEnriched = verifyLoadout(enrichedPieces, {
      constraints: SCREENSHOT_CONSTRAINTS,
      assumedMods: ASSUMED_MODS_SCREENSHOT,
    });

    const setHashes = [...countPiecesBySetHash(pieces).entries()].filter(
      ([, n]) => n >= 2,
    );
    const setBonusSelections = setHashes.map(([setHash]) => ({
      setHash,
      requiredCount: 2,
      perkHash: setHash,
    }));

    report.setBonusSelectionsTried = setBonusSelections;

    const exotic = pieces.find((p) => p.isExotic);

    report.searchLockedExoticRaw = searchLoadouts({
      pool: pieces,
      constraints: SCREENSHOT_CONSTRAINTS,
      assumedStatMods: ASSUMED_MODS_SCREENSHOT,
      setBonusSelections,
      exoticLock:
        exotic != null
          ? {
              mode: "locked" as const,
              itemInstanceId: exotic.itemInstanceId,
              slot: exotic.slot,
            }
          : { mode: "none" as const },
    }).length;

    report.searchLockedExoticEnriched = searchLoadouts({
      pool: enrichedPieces,
      constraints: SCREENSHOT_CONSTRAINTS,
      assumedStatMods: ASSUMED_MODS_SCREENSHOT,
      setBonusSelections,
      exoticLock:
        exotic != null
          ? {
              mode: "locked" as const,
              itemInstanceId: exotic.itemInstanceId,
              slot: exotic.slot,
            }
          : { mode: "none" as const },
    }).length;

    report.searchNoExoticEnriched = searchLoadouts({
      pool: enrichedPieces,
      constraints: SCREENSHOT_CONSTRAINTS,
      assumedStatMods: ASSUMED_MODS_SCREENSHOT,
      setBonusSelections,
      exoticLock: { mode: "none" },
    }).length;

    report.searchNoExoticRaw = searchLoadouts({
      pool: pieces,
      constraints: SCREENSHOT_CONSTRAINTS,
      assumedStatMods: ASSUMED_MODS_SCREENSHOT,
      setBonusSelections,
      exoticLock: { mode: "none" },
    }).length;

    const resolved = resolveLoadoutTotals(
      enrichedPieces,
      SCREENSHOT_CONSTRAINTS,
      {},
      ASSUMED_MODS_SCREENSHOT,
    );
    report.resolveTotalsEnriched = resolved?.totals ?? null;
    report.modAllocationEnriched = resolved?.modAllocation ?? null;
  }

  const classType = 2;
  const ferro = 3734029045;
  const smoke = 2751989785;
  const setBonuses = [
    { setHash: ferro, requiredCount: 2, perkHash: ferro },
    { setHash: smoke, requiredCount: 2, perkHash: smoke },
  ];
  let warlockInventory: DerivedArmorPieceJson[] = [];
  for (const row of rows ?? []) {
    if (ownerUserId != null && row.user_id !== ownerUserId) continue;
    const items = row.items as unknown as DerivedArmorPieceJson[];
    if (!Array.isArray(items)) continue;
    warlockInventory.push(...items.filter((p) => p.classType === classType));
  }
  const poolNone = filterOptimizerPool(warlockInventory, classType, {
    exoticLock: { mode: "none" },
    exoticStatBudget: optimizerLookup.exoticStatBudget,
  });
  const poolAny = filterOptimizerPool(warlockInventory, classType, {
    exoticLock: { mode: "any" },
    exoticStatBudget: optimizerLookup.exoticStatBudget,
  });
  const exotic = pieces.find((p) => p.isExotic);
  const poolLocked =
    exotic != null
      ? filterOptimizerPool(warlockInventory, classType, {
          exoticLock: {
            mode: "locked",
            itemInstanceId: exotic.itemInstanceId,
            slot: exotic.slot,
          },
          exoticStatBudget: optimizerLookup.exoticStatBudget,
        })
      : [];

  report.warlockVault = {
    pieces: warlockInventory.length,
    poolNone: poolNone.length,
    poolAny: poolAny.length,
    poolLocked: poolLocked.length,
    boundsLegendaryOnly: computeStatBounds(
      poolNone,
      {},
      { mode: "none" },
      SCREENSHOT_CONSTRAINTS,
      ASSUMED_MODS_SCREENSHOT,
    ),
    boundsAnyExotic: computeStatBounds(
      poolAny,
      {},
      { mode: "any" },
      SCREENSHOT_CONSTRAINTS,
      ASSUMED_MODS_SCREENSHOT,
    ),
    combosNone: estimateFilteredComboCount(poolNone, { mode: "none" }, {
      constraints: SCREENSHOT_CONSTRAINTS,
      setBonusSelections: setBonuses,
      assumedMods: ASSUMED_MODS_SCREENSHOT,
      cap: 5,
    }),
    combosAny: estimateFilteredComboCount(poolAny, { mode: "any" }, {
      constraints: SCREENSHOT_CONSTRAINTS,
      setBonusSelections: setBonuses,
      assumedMods: ASSUMED_MODS_SCREENSHOT,
      cap: 5,
    }),
    combosLocked:
      poolLocked.length > 0
        ? estimateFilteredComboCount(
            poolLocked,
            {
              mode: "locked",
              itemInstanceId: exotic!.itemInstanceId,
              slot: exotic!.slot,
            },
            {
              constraints: SCREENSHOT_CONSTRAINTS,
              setBonusSelections: setBonuses,
              assumedMods: ASSUMED_MODS_SCREENSHOT,
              cap: 5,
            },
          )
        : null,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
