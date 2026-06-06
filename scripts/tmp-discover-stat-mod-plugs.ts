/**
 * Phase A0: discover plugCategoryIdentifier values for armor stat mods (+3/+5/+10).
 * Run: NODE_OPTIONS='--require ./scripts/stub-server-only.cjs' npx tsx --tsconfig tsconfig.json scripts/tmp-discover-stat-mod-plugs.ts
 */
import { loadEnvConfig } from "@next/env";
import type {
  ManifestInventoryItemDefinition,
  ManifestStatDefinition,
} from "../src/lib/manifest/types";

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const { getDestinyManifest, fetchManifestSlice } = await import(
    "../src/lib/bungie/client"
  );
  const { ARMOR_STAT_NAMES } = await import("../src/lib/db/types");

  console.log("fetching manifest index...");
  const index = await getDestinyManifest();
  const en = index.jsonWorldComponentContentPaths.en;
  if (!en) throw new Error("no en locale");

  console.log("fetching DestinyStatDefinition...");
  const stats = (await fetchManifestSlice(
    en.DestinyStatDefinition,
  )) as Record<string, ManifestStatDefinition>;

  const allowed = new Set<string>(ARMOR_STAT_NAMES);
  const statNameByHash = new Map<number, string>();
  for (const def of Object.values(stats)) {
    const name = def.displayProperties?.name?.trim();
    if (name && allowed.has(name)) statNameByHash.set(def.hash, name);
  }
  console.log("armor stat hashes:", statNameByHash.size);

  console.log("fetching DestinyInventoryItemDefinition (large)...");
  const t0 = Date.now();
  const items = (await fetchManifestSlice(
    en.DestinyInventoryItemDefinition,
  )) as Record<string, ManifestInventoryItemDefinition>;
  console.log(
    `items loaded: ${Object.keys(items).length} in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );

  const byCategory = new Map<
    string,
    { count: number; sample: { hash: number; name?: string; vals: unknown } }
  >();

  for (const item of Object.values(items)) {
    if (item.redacted || item.blacklisted) continue;
    const id = item.plug?.plugCategoryIdentifier?.toLowerCase() ?? "";
    if (!id) continue;
    if (id.includes("archetype")) continue;
    if (id.includes("tuning") || id.includes("tertiary")) continue;
    if (id.includes("armor_stats")) continue;

    const armorInvs = (item.investmentStats ?? []).filter(
      (s) =>
        !s.isConditionallyActive &&
        (s.value ?? 0) > 0 &&
        statNameByHash.has(s.statTypeHash),
    );
    if (armorInvs.length === 0) continue;
    if (!armorInvs.some((s) => [3, 5, 10].includes(s.value ?? 0))) continue;

    const key = item.plug!.plugCategoryIdentifier!;
    const entry = byCategory.get(key);
    if (entry) {
      entry.count++;
    } else {
      byCategory.set(key, {
        count: 1,
        sample: {
          hash: item.hash,
          name: item.displayProperties?.name,
          vals: armorInvs.map((s) => ({
            stat: statNameByHash.get(s.statTypeHash),
            value: s.value,
          })),
        },
      });
    }
  }

  console.log(
    "\nDistinct plugCategoryIdentifier (+3/+5/+10 armor stats, excl archetype/tuning/armor_stats):\n",
  );
  for (const [k, { count, sample }] of [...byCategory.entries()].sort(
    (a, b) => b[1].count - a[1].count,
  )) {
    console.log(`${String(count).padStart(4)}  ${k}`);
    console.log(`       sample ${sample.hash} "${sample.name}" ${JSON.stringify(sample.vals)}`);
  }

  for (const cat of ["enhancements.v2_general", "enhancements.artifice"]) {
    console.log(`\n=== all plugs: ${cat} ===`);
    for (const item of Object.values(items)) {
      if (item.plug?.plugCategoryIdentifier !== cat) continue;
      const inv = (item.investmentStats ?? []).find(
        (s) =>
          !s.isConditionallyActive &&
          (s.value ?? 0) > 0 &&
          statNameByHash.has(s.statTypeHash),
      );
      if (!inv) continue;
      console.log(
        item.hash,
        item.displayProperties?.name,
        statNameByHash.get(inv.statTypeHash),
        inv.value,
      );
    }
  }

  console.log("\n=== masterwork categories (exclude from statmod) ===");
  const mw = new Map<string, number>();
  for (const item of Object.values(items)) {
    if (item.redacted || item.blacklisted) continue;
    const id = item.plug?.plugCategoryIdentifier?.toLowerCase() ?? "";
    if (!id.includes("masterwork")) continue;
    const armorInvs = (item.investmentStats ?? []).filter(
      (s) =>
        !s.isConditionallyActive &&
        (s.value ?? 0) > 0 &&
        statNameByHash.has(s.statTypeHash),
    );
    if (armorInvs.length === 0) continue;
    const key = item.plug!.plugCategoryIdentifier!;
    mw.set(key, (mw.get(key) ?? 0) + 1);
  }
  for (const [k, count] of [...mw.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(count, k);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
