import "server-only";
import {
  ARMOR_BUCKET_TO_SLOT,
  SOCKET_CATEGORY_KEYWORDS,
  type ArmorSlot,
} from "@/lib/bungie/constants";
import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";
import type {
  DerivedManifestData,
  ManifestCollectibleDefinition,
  ManifestInventoryItemDefinition,
  ManifestSocketCategoryDefinition,
  ManifestSocketTypeDefinition,
  ManifestStatDefinition,
} from "./types";

export interface DeriveInputs {
  version: string;
  items: Record<string, ManifestInventoryItemDefinition>;
  socketCategories: Record<string, ManifestSocketCategoryDefinition>;
  socketTypes: Record<string, ManifestSocketTypeDefinition>;
  collectibles: Record<string, ManifestCollectibleDefinition>;
  stats: Record<string, ManifestStatDefinition>;
}

const SLOT_SUFFIX_PATTERNS: Array<{ slot: ArmorSlot; patterns: RegExp[] }> = [
  {
    slot: "helmet",
    patterns: [
      /\s+(helm|helmet|head|cover|hood|mask)$/i,
      /\s+(crown|tiara|coif|circlet|cowl)$/i,
    ],
  },
  {
    slot: "arms",
    patterns: [
      /\s+(gauntlets|gloves|grips|wraps|gauntlet|gripper|sleeves|cuffs)$/i,
    ],
  },
  {
    slot: "chest",
    patterns: [/\s+(plate|vest|robes|chest|cuirass|breastplate|harness)$/i],
  },
  {
    slot: "legs",
    patterns: [/\s+(greaves|strides|legs|boots|leggings|trousers|pants)$/i],
  },
  {
    slot: "classItem",
    patterns: [/\s+(mark|bond|cloak)$/i],
  },
];

function nameMatchesAny(name: string | undefined, keywords: readonly string[]): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

export function findCategoryHashes(
  socketCategories: Record<string, ManifestSocketCategoryDefinition>,
): { archetype: Set<number>; tuning: Set<number> } {
  const archetype = new Set<number>();
  const tuning = new Set<number>();
  for (const def of Object.values(socketCategories)) {
    if (nameMatchesAny(def.displayProperties?.name, SOCKET_CATEGORY_KEYWORDS.archetype)) {
      archetype.add(def.hash);
    }
    if (nameMatchesAny(def.displayProperties?.name, SOCKET_CATEGORY_KEYWORDS.tuning)) {
      tuning.add(def.hash);
    }
  }
  return { archetype, tuning };
}

function categorizePlug(plug: ManifestInventoryItemDefinition): "archetype" | "tuning" | "stat" | null {
  const id = plug.plug?.plugCategoryIdentifier?.toLowerCase() ?? "";
  if (!id) return null;
  if (id.includes("archetype")) return "archetype";
  if (id.includes("tuning") || id.includes("tertiary")) return "tuning";
  // Be permissive for stat plugs: match exact "armor_stats" and any namespaced
  // form (e.g. "enhancements.armor_stats"). Fall back to investment-stat shape
  // if the identifier is missing entirely.
  if (id.includes("armor_stats")) return "stat";
  return null;
}

// Build a stat-hash -> canonical ArmorStatName map from DestinyStatDefinition.
// Multiple stat hashes may resolve to the same name (the manifest has dupes
// for "Class" and "Melee") — we accept all of them since we only care about
// the resulting name.
function buildStatNameByHash(
  stats: Record<string, ManifestStatDefinition>,
): Map<number, ArmorStatName> {
  const allowed = new Set<string>(ARMOR_STAT_NAMES);
  const out = new Map<number, ArmorStatName>();
  for (const def of Object.values(stats)) {
    const name = def.displayProperties?.name?.trim();
    if (!name) continue;
    if (allowed.has(name)) {
      out.set(def.hash, name as ArmorStatName);
    }
  }
  return out;
}

// Archetype plug descriptions look like:
//   "Armor configured for ... | | Primary Stat: Weapons | Secondary Stat: Grenade"
// We pull out the two stat names so we know which 4 stats are valid tertiary
// rolls for that archetype.
const ARCHETYPE_DESC_RE = /Primary Stat:\s*([A-Za-z]+)[\s\S]*?Secondary Stat:\s*([A-Za-z]+)/i;

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

// Extract the positive stat from a tuning name, e.g.
//   "+Weapons / -Health"        -> "Weapons"
//   "+Class / -Super"           -> "Class"
//   "Balanced Tuning"           -> null
//   "Empty Tuning Mod Socket"   -> null
//
// We deliberately ignore the negative side of the tuning. From a tracker
// perspective, a "+Weapons" view should match a piece with any "+Weapons / -X"
// roll — collapsing 30 paired tunings down to 6 positive-stat groups.
const POSITIVE_STAT_RE = /^\+(\w+)/;

function extractPositiveStat(name: string | undefined): string | null {
  if (!name) return null;
  const m = POSITIVE_STAT_RE.exec(name.trim());
  if (!m) return null;
  return m[1];
}

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function stripSlotSuffix(name: string, slot: ArmorSlot): string {
  const config = SLOT_SUFFIX_PATTERNS.find((s) => s.slot === slot);
  if (!config) return name;
  for (const pattern of config.patterns) {
    const stripped = name.replace(pattern, "").trim();
    if (stripped !== name) return stripped;
  }
  return name;
}

function classifyArmorPiece(item: ManifestInventoryItemDefinition): ArmorSlot | null {
  const bucket = item.inventory?.bucketTypeHash;
  if (!bucket) return null;
  return ARMOR_BUCKET_TO_SLOT[bucket] ?? null;
}

export function deriveManifestData(inputs: DeriveInputs): DerivedManifestData {
  const { version, items, socketCategories, collectibles, stats } = inputs;

  const { archetype: archetypeCategoryHashes, tuning: tuningCategoryHashes } =
    findCategoryHashes(socketCategories);

  const statNameByHash = buildStatNameByHash(stats);

  const archetypes = new Map<number, string>();
  const archetypeStatPairs = new Map<
    number,
    { primary: ArmorStatName; secondary: ArmorStatName }
  >();
  // Tunings are bucketed by positive stat (Weapons, Health, Grenade, Melee,
  // Class, Super). Each bucket gets a synthetic hash via djb2 of the stat name
  // so it fits the bigint primary-key schema.
  const tuningBucketByStat = new Map<string, { hash: number; name: string }>();
  const plugToArchetype = new Map<number, number>();
  const plugToTuning = new Map<number, number>();
  // armor_stats plug -> (stat name, magnitude). The manifest has 180 of these
  // (6 stats x 30 magnitudes). We use them at inventory time to label each
  // piece's primary/secondary/tertiary stat by ranking the 3 plugs by magnitude.
  const statPlugs = new Map<number, { stat: ArmorStatName; value: number }>();

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
      // armor_stats plugs are intrinsic/hidden and have no displayProperties.name —
      // we identify them by plugCategoryIdentifier + a positive investmentStat.
      const inv = item.investmentStats?.find(
        (s) => !s.isConditionallyActive && (s.value ?? 0) > 0,
      );
      if (!inv) continue;
      const statName = statNameByHash.get(inv.statTypeHash);
      if (!statName) continue;
      statPlugs.set(item.hash, { stat: statName, value: inv.value });
      continue;
    }
    if (!name) continue;
    const positive = extractPositiveStat(name);
    if (!positive) continue; // skip "Balanced Tuning", "Empty Tuning Mod Socket", etc.
    let bucket = tuningBucketByStat.get(positive);
    if (!bucket) {
      bucket = { hash: djb2(`tuning:${positive}`), name: `+${positive}` };
      tuningBucketByStat.set(positive, bucket);
    }
    plugToTuning.set(item.hash, bucket.hash);
  }

  // Group armor pieces by inferred set name (strip slot suffix)
  const armorSetByName = new Map<
    string,
    { set_hash: number; season_id: number | null; pieces: number }
  >();
  const armorItems: Array<{
    item_hash: number;
    set_hash: number;
    slot: ArmorSlot;
    class_type: number;
  }> = [];

  for (const item of Object.values(items)) {
    if (item.redacted || item.blacklisted) continue;
    const slot = classifyArmorPiece(item);
    if (!slot) continue;
    const name = item.displayProperties?.name;
    if (!name) continue;

    let setName = stripSlotSuffix(name, slot);
    if (item.collectibleHash) {
      const collectible = collectibles[String(item.collectibleHash)];
      const collectibleName = collectible?.displayProperties?.name;
      if (collectibleName) {
        setName = stripSlotSuffix(collectibleName, slot);
      }
    }
    setName = setName.trim();
    if (!setName) continue;

    let setEntry = armorSetByName.get(setName);
    if (!setEntry) {
      setEntry = {
        set_hash: djb2(setName),
        season_id: item.seasonHash ?? null,
        pieces: 0,
      };
      armorSetByName.set(setName, setEntry);
    }
    setEntry.pieces++;

    armorItems.push({
      item_hash: item.hash,
      set_hash: setEntry.set_hash,
      slot,
      class_type: item.classType ?? 3,
    });
  }

  // Filter: only keep sets that have at least 2 pieces (drop noise)
  const keptSetHashes = new Set<number>();
  const armorSets: Array<{ set_hash: number; name: string; season_id: number | null }> = [];
  for (const [name, entry] of armorSetByName.entries()) {
    if (entry.pieces < 2) continue;
    keptSetHashes.add(entry.set_hash);
    armorSets.push({ set_hash: entry.set_hash, name, season_id: entry.season_id });
  }

  const filteredArmorItems = armorItems.filter((it) => keptSetHashes.has(it.set_hash));

  return {
    version,
    archetypeCategoryHashes: [...archetypeCategoryHashes],
    tuningCategoryHashes: [...tuningCategoryHashes],
    armorSets,
    armorItems: filteredArmorItems,
    archetypes: [...archetypes.entries()].map(([archetype_hash, name]) => ({
      archetype_hash,
      name,
    })),
    tunings: [...tuningBucketByStat.values()].map((b) => ({
      tuning_hash: b.hash,
      name: b.name,
    })),
    plugToArchetype: [...plugToArchetype.entries()].map(
      ([plug_hash, archetype_hash]) => ({ plug_hash, archetype_hash }),
    ),
    plugToTuning: [...plugToTuning.entries()].map(([plug_hash, tuning_hash]) => ({
      plug_hash,
      tuning_hash,
    })),
    archetypeStatPairs: [...archetypeStatPairs.entries()].map(
      ([archetype_hash, { primary, secondary }]) => ({
        archetype_hash,
        primary_stat: primary,
        secondary_stat: secondary,
      }),
    ),
    armorStatPlugs: [...statPlugs.entries()].map(([plug_hash, { stat, value }]) => ({
      plug_hash,
      stat,
      value,
    })),
  };
}
