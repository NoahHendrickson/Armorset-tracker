/**
 * One-off probe: figure out what plug category identifiers Bungie's manifest
 * uses for armor 3.0 archetype/tuning sockets so we can fix our keyword
 * matching.
 *
 *   cd spike && npx tsx src/probe-plugs.ts
 */

import { config as dotenv } from "dotenv";
import { resolve } from "node:path";
dotenv({ path: resolve(process.cwd(), ".env.local") });
dotenv({ path: resolve(process.cwd(), ".env") });

const API_BASE = "https://www.bungie.net/Platform";
const API_KEY = process.env.BUNGIE_API_KEY ?? "";
if (!API_KEY) {
  console.error("Set BUNGIE_API_KEY in spike/.env or in this shell.");
  process.exit(1);
}

interface ManifestIndex {
  Response: {
    version: string;
    jsonWorldComponentContentPaths: Record<string, Record<string, string>>;
  };
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "X-API-Key": API_KEY },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

async function fetchSlice<T>(relPath: string): Promise<T> {
  const res = await fetch(`https://www.bungie.net${relPath}`);
  if (!res.ok) throw new Error(`${relPath}: ${res.status}`);
  return (await res.json()) as T;
}

interface ItemDef {
  hash: number;
  displayProperties?: { name?: string };
  itemTypeDisplayName?: string;
  inventory?: { bucketTypeHash: number };
  sockets?: {
    socketEntries: Array<{
      socketTypeHash: number;
      singleInitialItemHash?: number;
      reusablePlugSetHash?: number;
      randomizedPlugSetHash?: number;
    }>;
    socketCategories?: Array<{ socketCategoryHash: number; socketIndexes: number[] }>;
  };
  plug?: {
    plugCategoryHash?: number;
    plugCategoryIdentifier?: string;
  };
  redacted?: boolean;
  blacklisted?: boolean;
}

interface SocketCategoryDef {
  hash: number;
  displayProperties?: { name?: string };
}

interface SocketTypeDef {
  hash: number;
  socketCategoryHash: number;
  plugWhitelist?: Array<{ categoryHash: number; categoryIdentifier?: string }>;
}

const ARMOR_BUCKETS = new Set([
  3448274439, 3551918588, 14239492, 20886954, 1585787867,
]);

async function main() {
  console.log("Fetching manifest index...");
  const idx = await api<ManifestIndex>("/Destiny2/Manifest/");
  const paths = idx.Response.jsonWorldComponentContentPaths.en;
  console.log("Manifest version:", idx.Response.version);

  console.log("Fetching DestinySocketCategoryDefinition...");
  const categories = await fetchSlice<Record<string, SocketCategoryDef>>(
    paths.DestinySocketCategoryDefinition,
  );

  console.log("Fetching DestinySocketTypeDefinition...");
  const socketTypes = await fetchSlice<Record<string, SocketTypeDef>>(
    paths.DestinySocketTypeDefinition,
  );

  console.log("Fetching DestinyInventoryItemDefinition (this is large)...");
  const items = await fetchSlice<Record<string, ItemDef>>(
    paths.DestinyInventoryItemDefinition,
  );

  // ===== 1. Socket categories: which ones look like archetype / tuning?
  console.log("\n========== SOCKET CATEGORIES ==========");
  const archCategoryHashes = new Set<number>();
  const tuningCategoryHashes = new Set<number>();
  for (const cat of Object.values(categories)) {
    const name = cat.displayProperties?.name ?? "";
    const lower = name.toLowerCase();
    if (
      lower.includes("archetype") ||
      lower.includes("tuning") ||
      lower.includes("tier") ||
      lower.includes("armor")
    ) {
      console.log(`  ${cat.hash}\t${JSON.stringify(name)}`);
      if (lower.includes("archetype")) archCategoryHashes.add(cat.hash);
      if (lower.includes("tuning")) tuningCategoryHashes.add(cat.hash);
    }
  }
  console.log(
    `\n  Archetype-named categories: ${[...archCategoryHashes].join(", ") || "(none)"}`,
  );
  console.log(
    `  Tuning-named categories: ${[...tuningCategoryHashes].join(", ") || "(none)"}`,
  );

  // ===== 2. Socket types belonging to those categories
  const archSocketTypeHashes = new Set<number>();
  const tuningSocketTypeHashes = new Set<number>();
  for (const st of Object.values(socketTypes)) {
    if (archCategoryHashes.has(st.socketCategoryHash)) {
      archSocketTypeHashes.add(st.hash);
    }
    if (tuningCategoryHashes.has(st.socketCategoryHash)) {
      tuningSocketTypeHashes.add(st.hash);
    }
  }
  console.log(`\n  Archetype socket types: ${archSocketTypeHashes.size}`);
  console.log(`  Tuning socket types: ${tuningSocketTypeHashes.size}`);

  // Sample plugWhitelist categoryIdentifiers from those socket types
  const archWhitelistIds = new Set<string>();
  const tuningWhitelistIds = new Set<string>();
  for (const st of Object.values(socketTypes)) {
    if (archSocketTypeHashes.has(st.hash)) {
      for (const w of st.plugWhitelist ?? []) {
        if (w.categoryIdentifier) archWhitelistIds.add(w.categoryIdentifier);
      }
    }
    if (tuningSocketTypeHashes.has(st.hash)) {
      for (const w of st.plugWhitelist ?? []) {
        if (w.categoryIdentifier) tuningWhitelistIds.add(w.categoryIdentifier);
      }
    }
  }
  console.log(`\n  Archetype plug whitelist identifiers:`);
  for (const id of archWhitelistIds) console.log(`    ${id}`);
  console.log(`\n  Tuning plug whitelist identifiers:`);
  for (const id of tuningWhitelistIds) console.log(`    ${id}`);

  // ===== 3. Distinct plugCategoryIdentifiers (filtered to look interesting)
  console.log("\n========== PLUG CATEGORY IDENTIFIERS ==========");
  const counts = new Map<string, number>();
  let totalPlugs = 0;
  for (const it of Object.values(items)) {
    if (it.redacted || it.blacklisted) continue;
    if (!it.plug?.plugCategoryIdentifier) continue;
    const id = it.plug.plugCategoryIdentifier;
    counts.set(id, (counts.get(id) ?? 0) + 1);
    totalPlugs++;
  }
  console.log(`  Total plug definitions: ${totalPlugs}`);
  const sorted = [...counts.entries()]
    .filter(([id]) => {
      const lower = id.toLowerCase();
      return (
        lower.includes("armor") ||
        lower.includes("archetype") ||
        lower.includes("tuning") ||
        lower.includes("tertiary") ||
        lower.includes("intrinsic") ||
        lower.includes("trait")
      );
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60);
  console.log("\n  Top relevant plug category identifiers:");
  for (const [id, count] of sorted) {
    console.log(`    ${count.toString().padStart(5, " ")}  ${id}`);
  }

  // ===== 4. Find the 6 archetype master plugs and inspect them
  console.log("\n========== ARMOR_ARCHETYPES PLUG DEFINITIONS ==========");
  const archetypePlugs: ItemDef[] = [];
  for (const it of Object.values(items)) {
    if (it.plug?.plugCategoryIdentifier === "armor_archetypes") {
      archetypePlugs.push(it);
    }
  }
  for (const p of archetypePlugs) {
    console.log(
      `  ${p.hash}\t"${p.displayProperties?.name}"\tcatId=${p.plug?.plugCategoryIdentifier}`,
    );
  }

  // Find the tuning master plugs
  console.log("\n========== TUNING PLUG DEFINITIONS ==========");
  const tuningPlugs: ItemDef[] = [];
  for (const it of Object.values(items)) {
    if (
      (it.plug?.plugCategoryIdentifier ?? "")
        .toLowerCase()
        .includes("armor_tiering.plugs.tuning")
    ) {
      tuningPlugs.push(it);
    }
  }
  for (const p of tuningPlugs.slice(0, 12)) {
    console.log(
      `  ${p.hash}\t"${p.displayProperties?.name}"\tcatId=${p.plug?.plugCategoryIdentifier}`,
    );
  }
  console.log(`  ...total tuning plugs: ${tuningPlugs.length}`);

  // ===== 4b. Find a Tier 5 armor item — look at items with the right itemTypeDisplayName
  console.log("\n========== SAMPLE TIER 5 ARMOR ==========");
  let tier5: ItemDef | null = null;
  for (const it of Object.values(items)) {
    if (it.redacted || it.blacklisted) continue;
    if (!ARMOR_BUCKETS.has(it.inventory?.bucketTypeHash ?? -1)) continue;
    if (!it.sockets?.socketEntries) continue;
    const td = (it.itemTypeDisplayName ?? "").toLowerCase();
    if (td.includes("tier 5") || td.includes("featured")) {
      tier5 = it;
      break;
    }
  }
  if (tier5) {
    console.log(
      `  ${tier5.displayProperties?.name} (hash ${tier5.hash}) typeDisplay="${tier5.itemTypeDisplayName}"`,
    );
    for (const [i, entry] of (tier5.sockets?.socketEntries ?? []).entries()) {
      const st = socketTypes[String(entry.socketTypeHash)];
      const cat = st ? categories[String(st.socketCategoryHash)] : null;
      const initDef = entry.singleInitialItemHash
        ? items[String(entry.singleInitialItemHash)]
        : null;
      const plugCatId = initDef?.plug?.plugCategoryIdentifier ?? "-";
      const initName = initDef?.displayProperties?.name ?? "-";
      console.log(
        `    [${i}] type=${entry.socketTypeHash} cat=${cat?.displayProperties?.name ?? "(?)"} init=${entry.singleInitialItemHash ?? "-"} (${initName}) catId=${plugCatId} reuse=${entry.reusablePlugSetHash ?? "-"} random=${entry.randomizedPlugSetHash ?? "-"}`,
      );
    }
  } else {
    console.log("  (no tier 5 armor found)");
  }

  console.log("\n========== DONE ==========");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
