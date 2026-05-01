import "server-only";
import { getServiceRoleClient } from "@/lib/db/server";
import type { ArmorSlot } from "@/lib/bungie/constants";
import type { ArmorStatName } from "@/lib/db/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ManifestLookups {
  version: string | null;
  archetypeNameByHash: Map<number, string>;
  tuningNameByHash: Map<number, string>;
  setNameByHash: Map<number, string>;
  archetypeByPlug: Map<number, number>;
  tuningByPlug: Map<number, number>;
  armorItemByHash: Map<number, { setHash: number; slot: ArmorSlot; classType: number }>;
  archetypeStatPair: Map<
    number,
    { primary: ArmorStatName; secondary: ArmorStatName }
  >;
  statPlug: Map<number, { stat: ArmorStatName; value: number }>;
}

let cached: { at: number; data: ManifestLookups } | null = null;
const TTL_MS = 60 * 1000;

const PAGE_SIZE = 1000;

// Supabase REST caps responses at 1000 rows by default. `armor_items` and
// `armor_sets` can exceed that, so paginate via `.range(start, end)`.
async function paginatedSelect<T>(
  builder: () => ReturnType<SupabaseClient["from"]>["select"] extends (...a: never[]) => infer R ? R : never,
  /* eslint-disable @typescript-eslint/no-explicit-any */
): Promise<T[]> {
  const out: T[] = [];
  let start = 0;
  // We don't know the row count up front; loop until we get a short page.
  for (;;) {
    const { data, error } = await (builder() as any).range(start, start + PAGE_SIZE - 1);
    if (error) throw new Error(`paginated select failed: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    start += PAGE_SIZE;
  }
  return out;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export async function getManifestLookups(force = false): Promise<ManifestLookups> {
  if (!force && cached && Date.now() - cached.at < TTL_MS) {
    return cached.data;
  }

  const sb = getServiceRoleClient();

  const [
    versionRes,
    armorSets,
    armorItems,
    archetypes,
    tunings,
    plugToArchetype,
    plugToTuning,
    archetypeStatPairs,
    armorStatPlugs,
  ] = await Promise.all([
    sb
      .from("manifest_versions")
      .select("version")
      .eq("is_active", true)
      .maybeSingle(),
    paginatedSelect<{ set_hash: number | string; name: string }>(
      () => sb.from("armor_sets").select("set_hash, name"),
    ),
    paginatedSelect<{ item_hash: number | string; set_hash: number | string; slot: string; class_type: number }>(
      () => sb.from("armor_items").select("item_hash, set_hash, slot, class_type"),
    ),
    paginatedSelect<{ archetype_hash: number | string; name: string }>(
      () => sb.from("archetypes").select("archetype_hash, name"),
    ),
    paginatedSelect<{ tuning_hash: number | string; name: string }>(
      () => sb.from("tunings").select("tuning_hash, name"),
    ),
    paginatedSelect<{ plug_hash: number | string; archetype_hash: number | string }>(
      () => sb.from("plug_to_archetype").select("plug_hash, archetype_hash"),
    ),
    paginatedSelect<{ plug_hash: number | string; tuning_hash: number | string }>(
      () => sb.from("plug_to_tuning").select("plug_hash, tuning_hash"),
    ),
    paginatedSelect<{
      archetype_hash: number | string;
      primary_stat: ArmorStatName;
      secondary_stat: ArmorStatName;
    }>(() =>
      sb
        .from("archetype_stat_pairs")
        .select("archetype_hash, primary_stat, secondary_stat"),
    ),
    paginatedSelect<{ plug_hash: number | string; stat: ArmorStatName; value: number }>(
      () => sb.from("armor_stat_plugs").select("plug_hash, stat, value"),
    ),
  ]);

  const data: ManifestLookups = {
    version: versionRes.data?.version ?? null,
    setNameByHash: new Map(armorSets.map((r) => [Number(r.set_hash), r.name])),
    armorItemByHash: new Map(
      armorItems.map((r) => [
        Number(r.item_hash),
        {
          setHash: Number(r.set_hash),
          slot: r.slot as ArmorSlot,
          classType: Number(r.class_type),
        },
      ]),
    ),
    archetypeNameByHash: new Map(
      archetypes.map((r) => [Number(r.archetype_hash), r.name]),
    ),
    tuningNameByHash: new Map(
      tunings.map((r) => [Number(r.tuning_hash), r.name]),
    ),
    archetypeByPlug: new Map(
      plugToArchetype.map((r) => [
        Number(r.plug_hash),
        Number(r.archetype_hash),
      ]),
    ),
    tuningByPlug: new Map(
      plugToTuning.map((r) => [Number(r.plug_hash), Number(r.tuning_hash)]),
    ),
    archetypeStatPair: new Map(
      archetypeStatPairs.map((r) => [
        Number(r.archetype_hash),
        { primary: r.primary_stat, secondary: r.secondary_stat },
      ]),
    ),
    statPlug: new Map(
      armorStatPlugs.map((r) => [
        Number(r.plug_hash),
        { stat: r.stat, value: r.value },
      ]),
    ),
  };

  cached = { at: Date.now(), data };
  return data;
}

export function invalidateManifestLookups() {
  cached = null;
}
