import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { type BungieConfig, MANIFEST_CACHE_DIR } from "./config.js";
import { getDestinyManifest } from "./bungie.js";

const TABLES_OF_INTEREST = [
  "DestinyInventoryItemDefinition",
  "DestinySocketCategoryDefinition",
  "DestinySocketTypeDefinition",
  "DestinyCollectibleDefinition",
  "DestinyInventoryBucketDefinition",
  "DestinyClassDefinition",
] as const;

export type ManifestTableName = (typeof TABLES_OF_INTEREST)[number];

export interface DisplayProperties {
  name?: string;
  description?: string;
  icon?: string;
  hasIcon?: boolean;
}

export interface InventoryItemDefinition {
  hash: number;
  displayProperties?: DisplayProperties;
  itemTypeDisplayName?: string;
  itemTypeAndTierDisplayName?: string;
  itemCategoryHashes?: number[];
  inventory?: { bucketTypeHash: number; tierType: number };
  collectibleHash?: number;
  classType?: number;
  sockets?: {
    socketEntries: Array<{
      socketTypeHash: number;
      singleInitialItemHash?: number;
      reusablePlugSetHash?: number;
      randomizedPlugSetHash?: number;
      defaultVisible?: boolean;
    }>;
    socketCategories?: Array<{ socketCategoryHash: number; socketIndexes: number[] }>;
  };
  plug?: {
    plugCategoryHash?: number;
    plugCategoryIdentifier?: string;
  };
}

export interface SocketCategoryDefinition {
  hash: number;
  displayProperties?: DisplayProperties;
  category?: number;
}

export interface SocketTypeDefinition {
  hash: number;
  displayProperties?: DisplayProperties;
  socketCategoryHash: number;
  plugWhitelist?: Array<{ categoryHash: number; categoryIdentifier?: string }>;
}

export interface CollectibleDefinition {
  hash: number;
  displayProperties?: DisplayProperties;
  itemHash?: number;
  parentNodeHashes?: number[];
}

export interface InventoryBucketDefinition {
  hash: number;
  displayProperties?: DisplayProperties;
  category?: number;
  scope?: number;
}

export interface ClassDefinition {
  hash: number;
  classType: number;
  displayProperties?: DisplayProperties;
}

export interface ManifestSlices {
  version: string;
  items: Record<string, InventoryItemDefinition>;
  socketCategories: Record<string, SocketCategoryDefinition>;
  socketTypes: Record<string, SocketTypeDefinition>;
  collectibles: Record<string, CollectibleDefinition>;
  buckets: Record<string, InventoryBucketDefinition>;
  classes: Record<string, ClassDefinition>;
}

const tablePathToProperty: Record<ManifestTableName, keyof Omit<ManifestSlices, "version">> = {
  DestinyInventoryItemDefinition: "items",
  DestinySocketCategoryDefinition: "socketCategories",
  DestinySocketTypeDefinition: "socketTypes",
  DestinyCollectibleDefinition: "collectibles",
  DestinyInventoryBucketDefinition: "buckets",
  DestinyClassDefinition: "classes",
};

function ensureCacheDir() {
  if (!existsSync(MANIFEST_CACHE_DIR)) mkdirSync(MANIFEST_CACHE_DIR, { recursive: true });
}

function cachePath(version: string, table: ManifestTableName) {
  return resolve(MANIFEST_CACHE_DIR, `${version}__${table}.json`);
}

export async function syncManifest(config: BungieConfig, locale = "en"): Promise<ManifestSlices> {
  ensureCacheDir();
  console.log("[manifest] fetching index...");
  const index = await getDestinyManifest(config);
  const version = index.version;
  console.log(`[manifest] version: ${version}`);

  const componentPaths = index.jsonWorldComponentContentPaths[locale];
  if (!componentPaths) {
    throw new Error(`No manifest paths for locale '${locale}'`);
  }

  const result: ManifestSlices = {
    version,
    items: {},
    socketCategories: {},
    socketTypes: {},
    collectibles: {},
    buckets: {},
    classes: {},
  };

  for (const table of TABLES_OF_INTEREST) {
    const cache = cachePath(version, table);
    let raw: string;
    if (existsSync(cache)) {
      console.log(`[manifest] cached ${table}`);
      raw = readFileSync(cache, "utf8");
    } else {
      const path = componentPaths[table];
      if (!path) {
        console.warn(`[manifest] WARNING: no path for ${table} in manifest index — skipping`);
        continue;
      }
      const url = `https://www.bungie.net${path}`;
      console.log(`[manifest] downloading ${table}...`);
      const res = await fetch(url, { headers: { "X-API-Key": config.apiKey } });
      if (!res.ok) {
        throw new Error(`Manifest fetch failed for ${table}: ${res.status} ${res.statusText}`);
      }
      raw = await res.text();
      writeFileSync(cache, raw);
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const propName = tablePathToProperty[table];
    (result[propName] as Record<string, unknown>) = parsed;
  }

  return result;
}
