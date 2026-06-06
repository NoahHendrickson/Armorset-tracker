import "server-only";
import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";
import { parseSubclassKeyFromPlugCategory } from "@/lib/optimizer/subclass-key";
import type { ManifestInventoryItemDefinition, ManifestStatDefinition } from "./types";

/**
 * Choosable armor stat mods (general minor/major + artifice +3). Masterwork is
 * excluded — base stats should keep masterwork baked in (matches D2AP/DIM).
 *
 * Discovered via scripts/discover-stat-mod-plugs.ts (public manifest A0).
 */
export const STAT_MOD_PLUG_CATEGORY_IDS = new Set([
  "enhancements.v2_general",
  "enhancements.artifice",
]);

export function categorizePlug(
  plug: ManifestInventoryItemDefinition,
): "archetype" | "tuning" | "stat" | "statmod" | null {
  const id = plug.plug?.plugCategoryIdentifier?.toLowerCase() ?? "";
  if (!id) return null;
  if (id.includes("masterwork")) return null;
  if (id.includes("archetype")) return "archetype";
  if (id.includes("tuning") || id.includes("tertiary")) return "tuning";
  if (id.includes("armor_stats")) return "stat";
  const rawId = plug.plug?.plugCategoryIdentifier ?? "";
  if (STAT_MOD_PLUG_CATEGORY_IDS.has(rawId)) return "statmod";
  return null;
}

function isSubclassFragmentPlug(item: ManifestInventoryItemDefinition): boolean {
  const id = item.plug?.plugCategoryIdentifier?.toLowerCase() ?? "";
  if (!id) return false;
  return (
    id.includes(".fragments") ||
    id.endsWith("fragments") ||
    id.includes(".trinkets")
  );
}

const ARCHETYPE_DESC_RE =
  /Primary Stat:\s*([A-Za-z]+)[\s\S]*?Secondary Stat:\s*([A-Za-z]+)/i;

function parseArchetypePair(
  description: string | undefined,
): { primary: ArmorStatName; secondary: ArmorStatName } | null {
  if (!description) return null;
  const m = ARCHETYPE_DESC_RE.exec(description);
  if (!m) return null;
  const allowed = new Set<string>(ARMOR_STAT_NAMES);
  if (!allowed.has(m[1]) || !allowed.has(m[2])) return null;
  return { primary: m[1] as ArmorStatName, secondary: m[2] as ArmorStatName };
}

const POSITIVE_STAT_RE = /^\+(\w+)/;

function extractPositiveStat(name: string | undefined): string | null {
  if (!name) return null;
  const m = POSITIVE_STAT_RE.exec(name.trim());
  if (!m) return null;
  return m[1];
}

export function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export type SubclassFragmentPlugMeta = {
  name: string;
  icon_path: string;
  subclass_key: string;
  deltas: Array<{ stat: ArmorStatName; value: number }>;
};

export type DerivedPlugLookups = {
  archetypes: Map<number, string>;
  archetypeStatPairs: Map<
    number,
    { primary: ArmorStatName; secondary: ArmorStatName }
  >;
  tuningBucketByStat: Map<string, { hash: number; name: string }>;
  plugToArchetype: Map<number, number>;
  plugToTuning: Map<number, number>;
  tuningPlugStats: Map<number, Array<{ stat: ArmorStatName; value: number }>>;
  statModPlugStats: Map<number, Array<{ stat: ArmorStatName; value: number }>>;
  statPlugs: Map<number, { stat: ArmorStatName; value: number }>;
  subclassFragmentPlugs: Map<number, SubclassFragmentPlugMeta>;
};

function pickStatIconPath(
  dp: ManifestStatDefinition["displayProperties"],
): string {
  if (!dp) return "";
  const a = dp.icon?.trim();
  if (a) return a;
  const b = dp.highResIcon?.trim();
  if (b) return b;
  return "";
}

/**
 * Walk DestinyInventoryItemDefinition plugs and build archetype/tuning/stat/
 * stat-mod/fragment lookup maps used by manifest sync and inventory derive.
 */
export function derivePlugLookups(
  items: Record<string, ManifestInventoryItemDefinition>,
  statNameByHash: Map<number, ArmorStatName>,
): DerivedPlugLookups {
  const archetypes = new Map<number, string>();
  const archetypeStatPairs = new Map<
    number,
    { primary: ArmorStatName; secondary: ArmorStatName }
  >();
  const tuningBucketByStat = new Map<string, { hash: number; name: string }>();
  const plugToArchetype = new Map<number, number>();
  const plugToTuning = new Map<number, number>();
  const tuningPlugStats = new Map<
    number,
    Array<{ stat: ArmorStatName; value: number }>
  >();
  const statModPlugStats = new Map<
    number,
    Array<{ stat: ArmorStatName; value: number }>
  >();
  const statPlugs = new Map<number, { stat: ArmorStatName; value: number }>();
  const subclassFragmentPlugs = new Map<number, SubclassFragmentPlugMeta>();

  for (const item of Object.values(items)) {
    if (item.redacted || item.blacklisted) continue;
    const category = categorizePlug(item);
    if (!category) continue;
    const name = item.displayProperties?.name;
    if (category === "archetype") {
      if (!name) continue;
      archetypes.set(item.hash, name);
      plugToArchetype.set(item.hash, item.hash);
      const pair = parseArchetypePair(item.displayProperties?.description);
      if (pair) archetypeStatPairs.set(item.hash, pair);
      continue;
    }
    if (category === "stat") {
      const inv = item.investmentStats?.find(
        (s) => !s.isConditionallyActive && (s.value ?? 0) > 0,
      );
      if (!inv) continue;
      const statName = statNameByHash.get(inv.statTypeHash);
      if (!statName) continue;
      statPlugs.set(item.hash, { stat: statName, value: inv.value });
      continue;
    }
    if (category === "statmod") {
      const deltas: Array<{ stat: ArmorStatName; value: number }> = [];
      for (const inv of item.investmentStats ?? []) {
        if (inv.isConditionallyActive) continue;
        const statName = statNameByHash.get(inv.statTypeHash);
        if (!statName || (inv.value ?? 0) <= 0) continue;
        deltas.push({ stat: statName, value: inv.value });
      }
      if (deltas.length > 0) {
        statModPlugStats.set(item.hash, deltas);
      }
      continue;
    }
    if (!name) continue;
    const positive = extractPositiveStat(name);
    if (!positive) continue;
    let bucket = tuningBucketByStat.get(positive);
    if (!bucket) {
      bucket = { hash: djb2(`tuning:${positive}`), name: `+${positive}` };
      tuningBucketByStat.set(positive, bucket);
    }
    plugToTuning.set(item.hash, bucket.hash);
    const deltas: Array<{ stat: ArmorStatName; value: number }> = [];
    for (const inv of item.investmentStats ?? []) {
      if (inv.isConditionallyActive) continue;
      const statName = statNameByHash.get(inv.statTypeHash);
      if (!statName || inv.value === 0) continue;
      deltas.push({ stat: statName, value: inv.value });
    }
    if (deltas.length > 0) {
      tuningPlugStats.set(item.hash, deltas);
    }
  }

  for (const item of Object.values(items)) {
    if (item.redacted || item.blacklisted) continue;
    if (!isSubclassFragmentPlug(item)) continue;
    const name = item.displayProperties?.name?.trim();
    if (!name) continue;
    const deltas: Array<{ stat: ArmorStatName; value: number }> = [];
    for (const inv of item.investmentStats ?? []) {
      const statName = statNameByHash.get(inv.statTypeHash);
      if (!statName || inv.value === 0) continue;
      deltas.push({ stat: statName, value: inv.value });
    }
    if (deltas.length === 0) continue;
    subclassFragmentPlugs.set(item.hash, {
      name,
      icon_path: pickStatIconPath(item.displayProperties),
      subclass_key: parseSubclassKeyFromPlugCategory(
        item.plug?.plugCategoryIdentifier ?? "",
      ),
      deltas,
    });
  }

  return {
    archetypes,
    archetypeStatPairs,
    tuningBucketByStat,
    plugToArchetype,
    plugToTuning,
    tuningPlugStats,
    statModPlugStats,
    statPlugs,
    subclassFragmentPlugs,
  };
}
