import "server-only";
import { fetchManifestSlice, getDestinyManifest } from "@/lib/bungie/client";
import { getServiceRoleClient } from "@/lib/db/server";
import { deriveManifestData } from "./derive";
import type {
  ManifestCollectibleDefinition,
  ManifestInventoryItemDefinition,
  ManifestSocketCategoryDefinition,
  ManifestSocketTypeDefinition,
  ManifestStatDefinition,
} from "./types";

const TABLES_OF_INTEREST = [
  "DestinyInventoryItemDefinition",
  "DestinySocketCategoryDefinition",
  "DestinySocketTypeDefinition",
  "DestinyCollectibleDefinition",
  "DestinyInventoryBucketDefinition",
  "DestinyStatDefinition",
] as const;

export interface SyncResult {
  version: string;
  changed: boolean;
  counts: {
    armor_sets: number;
    armor_items: number;
    archetypes: number;
    tunings: number;
    plug_to_archetype: number;
    plug_to_tuning: number;
    archetype_stat_pairs: number;
    armor_stat_plugs: number;
  };
}

export async function syncManifest({
  force = false,
  locale = "en",
}: { force?: boolean; locale?: string } = {}): Promise<SyncResult> {
  const sb = getServiceRoleClient();

  const indexResp = await getDestinyManifest();
  const version = indexResp.version;

  if (!force) {
    const { data: active } = await sb
      .from("manifest_versions")
      .select("version")
      .eq("is_active", true)
      .maybeSingle();
    if (active?.version === version) {
      return {
        version,
        changed: false,
        counts: await currentCounts(sb),
      };
    }
  }

  const componentPaths = indexResp.jsonWorldComponentContentPaths[locale];
  if (!componentPaths) {
    throw new Error(`No manifest paths for locale '${locale}'`);
  }

  const slices: Record<string, Record<string, unknown>> = {};
  for (const table of TABLES_OF_INTEREST) {
    const path = componentPaths[table];
    if (!path) {
      throw new Error(`Manifest index missing path for ${table}`);
    }
    slices[table] = await fetchManifestSlice(path);
  }

  const derived = deriveManifestData({
    version,
    items: slices.DestinyInventoryItemDefinition as Record<string, ManifestInventoryItemDefinition>,
    socketCategories: slices.DestinySocketCategoryDefinition as Record<string, ManifestSocketCategoryDefinition>,
    socketTypes: slices.DestinySocketTypeDefinition as Record<string, ManifestSocketTypeDefinition>,
    collectibles: slices.DestinyCollectibleDefinition as Record<string, ManifestCollectibleDefinition>,
    stats: slices.DestinyStatDefinition as Record<string, ManifestStatDefinition>,
  });

  await replaceDerivedTables(derived);
  await markVersionActive(version);

  return {
    version,
    changed: true,
    counts: {
      armor_sets: derived.armorSets.length,
      armor_items: derived.armorItems.length,
      archetypes: derived.archetypes.length,
      tunings: derived.tunings.length,
      plug_to_archetype: derived.plugToArchetype.length,
      plug_to_tuning: derived.plugToTuning.length,
      archetype_stat_pairs: derived.archetypeStatPairs.length,
      armor_stat_plugs: derived.armorStatPlugs.length,
    },
  };
}

type DerivedTable =
  | "armor_sets"
  | "armor_items"
  | "archetypes"
  | "tunings"
  | "plug_to_archetype"
  | "plug_to_tuning"
  | "archetype_stat_pairs"
  | "armor_stat_plugs";

async function currentCounts(sb: ReturnType<typeof getServiceRoleClient>) {
  const [
    armor_sets,
    armor_items,
    archetypes,
    tunings,
    plug_to_archetype,
    plug_to_tuning,
    archetype_stat_pairs,
    armor_stat_plugs,
  ] = await Promise.all([
    countTable(sb, "armor_sets"),
    countTable(sb, "armor_items"),
    countTable(sb, "archetypes"),
    countTable(sb, "tunings"),
    countTable(sb, "plug_to_archetype"),
    countTable(sb, "plug_to_tuning"),
    countTable(sb, "archetype_stat_pairs"),
    countTable(sb, "armor_stat_plugs"),
  ]);
  return {
    armor_sets,
    armor_items,
    archetypes,
    tunings,
    plug_to_archetype,
    plug_to_tuning,
    archetype_stat_pairs,
    armor_stat_plugs,
  };
}

async function countTable(
  sb: ReturnType<typeof getServiceRoleClient>,
  table: DerivedTable,
): Promise<number> {
  const { count } = await sb.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

async function replaceDerivedTables(derived: ReturnType<typeof deriveManifestData>) {
  const sb = getServiceRoleClient();

  // Order matters: dependents go first so we don't violate FKs.
  await sb.from("armor_items").delete().not("item_hash", "is", null);
  await sb.from("plug_to_archetype").delete().not("plug_hash", "is", null);
  await sb.from("plug_to_tuning").delete().not("plug_hash", "is", null);
  await sb.from("archetype_stat_pairs").delete().not("archetype_hash", "is", null);
  await sb.from("armor_stat_plugs").delete().not("plug_hash", "is", null);
  await sb.from("archetypes").delete().not("archetype_hash", "is", null);
  await sb.from("tunings").delete().not("tuning_hash", "is", null);
  await sb.from("armor_sets").delete().not("set_hash", "is", null);

  await chunkInsert(sb, "armor_sets", derived.armorSets);
  await chunkInsert(sb, "archetypes", derived.archetypes);
  await chunkInsert(sb, "tunings", derived.tunings);
  await chunkInsert(sb, "armor_items", derived.armorItems);
  await chunkInsert(sb, "plug_to_archetype", derived.plugToArchetype);
  await chunkInsert(sb, "plug_to_tuning", derived.plugToTuning);
  await chunkInsert(sb, "archetype_stat_pairs", derived.archetypeStatPairs);
  await chunkInsert(sb, "armor_stat_plugs", derived.armorStatPlugs);
}

async function chunkInsert<T extends Record<string, unknown>>(
  sb: ReturnType<typeof getServiceRoleClient>,
  table: DerivedTable,
  rows: T[],
  chunkSize = 1000,
) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    if (slice.length === 0) continue;
    // @ts-expect-error generic chunk insert across multiple tables; data shape is verified at the call site
    const { error } = await sb.from(table).insert(slice);
    if (error) throw new Error(`insert ${table} failed: ${error.message}`);
  }
}

async function markVersionActive(version: string) {
  const sb = getServiceRoleClient();
  await sb.from("manifest_versions").update({ is_active: false }).eq("is_active", true);
  await sb
    .from("manifest_versions")
    .upsert({ version, fetched_at: new Date().toISOString(), is_active: true });
}
