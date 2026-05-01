/**
 * Look up every manifest armor item with a given substring in its name and
 * report what slot suffix our derivation should be stripping.
 *
 *   cd spike && SET=Ferropotent npx tsx src/probe-set.ts
 */

import { config as dotenv } from "dotenv";
import { resolve } from "node:path";

dotenv({ path: resolve(process.cwd(), ".env.local") });
dotenv({ path: resolve(process.cwd(), "..", ".env.local") });

const API_KEY = process.env.BUNGIE_API_KEY ?? "";
const NEEDLE = (process.env.SET ?? "Ferropotent").toLowerCase();

if (!API_KEY) {
  console.error("Set BUNGIE_API_KEY in env");
  process.exit(1);
}

const ARMOR_BUCKETS = new Set([
  3448274439, 3551918588, 14239492, 20886954, 1585787867,
]);

const BUCKET_NAMES: Record<number, string> = {
  3448274439: "helmet",
  3551918588: "arms",
  14239492: "chest",
  20886954: "legs",
  1585787867: "classItem",
};

const CLASS_NAMES: Record<number, string> = {
  0: "Titan",
  1: "Hunter",
  2: "Warlock",
  3: "Any",
};

interface ItemDef {
  hash: number;
  redacted?: boolean;
  blacklisted?: boolean;
  displayProperties?: { name?: string };
  itemTypeDisplayName?: string;
  inventory?: { bucketTypeHash: number };
  classType?: number;
  collectibleHash?: number;
}

async function main() {
  const idxRes = await fetch("https://www.bungie.net/Platform/Destiny2/Manifest/", {
    headers: { "X-API-Key": API_KEY },
  });
  const idx = (await idxRes.json()) as {
    Response: { jsonWorldComponentContentPaths: Record<string, Record<string, string>> };
  };
  const itemsPath = idx.Response.jsonWorldComponentContentPaths.en.DestinyInventoryItemDefinition;
  console.log("Loading items...");
  const itemsRes = await fetch(`https://www.bungie.net${itemsPath}`);
  const items = (await itemsRes.json()) as Record<string, ItemDef>;
  console.log(`Loaded ${Object.keys(items).length} items.`);

  const matches: ItemDef[] = [];
  for (const it of Object.values(items)) {
    if (it.redacted || it.blacklisted) continue;
    if (!ARMOR_BUCKETS.has(it.inventory?.bucketTypeHash ?? -1)) continue;
    const name = it.displayProperties?.name?.toLowerCase() ?? "";
    if (!name.includes(NEEDLE)) continue;
    matches.push(it);
  }

  console.log(`\nMatching armor items for "${NEEDLE}": ${matches.length}\n`);
  matches.sort((a, b) => {
    const c = (a.classType ?? 9) - (b.classType ?? 9);
    if (c !== 0) return c;
    return (a.inventory?.bucketTypeHash ?? 0) - (b.inventory?.bucketTypeHash ?? 0);
  });
  for (const m of matches) {
    const slot = BUCKET_NAMES[m.inventory?.bucketTypeHash ?? -1] ?? "?";
    const cls = CLASS_NAMES[m.classType ?? 3] ?? "?";
    console.log(
      `  ${m.hash}\t${cls.padEnd(7)}\t${slot.padEnd(10)}\t"${m.displayProperties?.name}"\ttype="${m.itemTypeDisplayName ?? ""}"`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
