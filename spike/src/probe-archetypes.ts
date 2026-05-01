/**
 * Dump all 6 archetype plug definitions with descriptions, and DestinyStatDefinition
 * for the 6 armor stats. We need both to build the (archetype -> primary, secondary)
 * map and the stat-name resolver.
 *
 *   cd spike && npx tsx src/probe-archetypes.ts
 */

import { config as dotenv } from "dotenv";
import { resolve } from "node:path";

dotenv({ path: resolve(process.cwd(), ".env.local") });
dotenv({ path: resolve(process.cwd(), "..", ".env.local") });

const API_KEY = process.env.BUNGIE_API_KEY ?? "";
if (!API_KEY) {
  console.error("Missing BUNGIE_API_KEY");
  process.exit(1);
}

interface ItemDef {
  hash: number;
  displayProperties?: { name?: string; description?: string };
  plug?: { plugCategoryIdentifier?: string };
  investmentStats?: Array<{ statTypeHash: number; value: number }>;
}

interface StatDef {
  hash: number;
  displayProperties?: { name?: string; description?: string };
}

async function main() {
  const idxRes = await fetch("https://www.bungie.net/Platform/Destiny2/Manifest/", {
    headers: { "X-API-Key": API_KEY },
  });
  const idx = ((await idxRes.json()) as { Response: { jsonWorldComponentContentPaths: Record<string, Record<string, string>> } }).Response;

  const itemsRes = await fetch(
    `https://www.bungie.net${idx.jsonWorldComponentContentPaths.en.DestinyInventoryItemDefinition}`,
  );
  const items = (await itemsRes.json()) as Record<string, ItemDef>;

  const statsRes = await fetch(
    `https://www.bungie.net${idx.jsonWorldComponentContentPaths.en.DestinyStatDefinition}`,
  );
  const stats = (await statsRes.json()) as Record<string, StatDef>;

  console.log("=== All 6 archetypes ===");
  const archs = Object.values(items).filter(
    (it) => it.plug?.plugCategoryIdentifier === "armor_archetypes",
  );
  for (const a of archs) {
    console.log(`\n  ${a.hash}\t"${a.displayProperties?.name}"`);
    console.log(`  desc: ${(a.displayProperties?.description ?? "").replace(/\n/g, " | ")}`);
    if (a.investmentStats?.length) {
      for (const inv of a.investmentStats) {
        const sd = stats[String(inv.statTypeHash)];
        console.log(`    investmentStat: ${sd?.displayProperties?.name ?? "(?)"} +${inv.value}`);
      }
    }
  }

  console.log("\n=== Armor stat plugs (sample) ===");
  const statPlugs = Object.values(items).filter(
    (it) => it.plug?.plugCategoryIdentifier === "armor_stats" && (it.investmentStats?.length ?? 0) > 0,
  );
  console.log(`  total armor_stats plugs with investmentStats: ${statPlugs.length}`);
  console.log("  first 12:");
  for (const p of statPlugs.slice(0, 12)) {
    const stat = p.investmentStats?.[0];
    const sd = stat ? stats[String(stat.statTypeHash)] : null;
    console.log(
      `    ${p.hash}\t${sd?.displayProperties?.name ?? "(?)"}: +${stat?.value ?? "?"}`,
    );
  }

  console.log("\n=== Distribution of stat plug magnitudes ===");
  const dist = new Map<number, number>();
  for (const p of statPlugs) {
    const v = p.investmentStats?.[0]?.value ?? 0;
    dist.set(v, (dist.get(v) ?? 0) + 1);
  }
  for (const [v, c] of [...dist.entries()].sort((a, b) => b[0] - a[0])) {
    console.log(`    +${v}: ${c} plugs`);
  }

  console.log("\n=== 6 armor stat definitions ===");
  const armorStatNames = new Set([
    "Weapons", "Health", "Grenade", "Melee", "Class", "Super",
  ]);
  for (const s of Object.values(stats)) {
    const name = s.displayProperties?.name ?? "";
    if (armorStatNames.has(name)) {
      console.log(`  ${s.hash}\t${name}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
