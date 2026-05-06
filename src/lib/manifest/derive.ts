import "server-only";
import { ARMOR_BUCKET_TO_SLOT, DESTINY_TIER_EXOTIC, type ArmorSlot } from "@/lib/bungie/constants";
import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";
import type {
  DerivedManifestData,
  ManifestCollectibleDefinition,
  ManifestEquipableItemSetDefinition,
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
  equipableItemSets: Record<string, ManifestEquipableItemSetDefinition>;
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

/**
 * Armor 3.0 categories on items are keyed by `socketCategoryHash`. Bungie
 * often labels those rows "ARMOR PERKS" / "ARMOR MODS" — not "Archetype" /
 * "Tuning" — so we derive hashes from `DestinySocketTypeDefinition` plug
 * whitelist identifiers instead of category display names.
 */
export function findCategoryHashes(
  socketTypes: Record<string, ManifestSocketTypeDefinition>,
): { archetype: Set<number>; tuning: Set<number> } {
  const archetype = new Set<number>();
  const tuning = new Set<number>();
  for (const def of Object.values(socketTypes)) {
    const whitelist = def.plugWhitelist;
    if (!whitelist?.length) continue;
    for (const w of whitelist) {
      const id = w.categoryIdentifier?.toLowerCase() ?? "";
      if (id.includes("armor_archetypes") || id.includes("archetype")) {
        archetype.add(def.socketCategoryHash);
      }
      if (
        id.includes("tuning") ||
        id.includes("tertiary") ||
        id.includes("armor_tiering.plugs.tuning")
      ) {
        tuning.add(def.socketCategoryHash);
      }
    }
  }
  return { archetype, tuning };
}

function equipableSetHasBonusPerks(
  setHash: number,
  sets: Record<string, ManifestEquipableItemSetDefinition>,
): boolean {
  const def = sets[String(setHash)];
  if (!def || def.redacted) return false;
  return Array.isArray(def.setPerks) && def.setPerks.length > 0;
}

/** Armor 3.0: both archetype and tuning / tertiary socket categories on the item. */
function itemHasArmor30SocketCategories(
  item: ManifestInventoryItemDefinition,
  archetypeCategoryHashes: Set<number>,
  tuningCategoryHashes: Set<number>,
): boolean {
  const categories = item.sockets?.socketCategories;
  if (!categories?.length) return false;
  let hasArchetype = false;
  let hasTuning = false;
  for (const cat of categories) {
    const h = cat.socketCategoryHash;
    if (archetypeCategoryHashes.has(h)) hasArchetype = true;
    if (tuningCategoryHashes.has(h)) hasTuning = true;
  }
  return hasArchetype && hasTuning;
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

function pickStatIconPath(dp: ManifestStatDefinition["displayProperties"]): string {
  if (!dp) return "";
  const a = dp.icon?.trim();
  if (a) return a;
  const b = dp.highResIcon?.trim();
  if (b) return b;
  return "";
}

function buildArmorStatIcons(
  stats: Record<string, ManifestStatDefinition>,
  statNameByHash: Map<number, ArmorStatName>,
): Array<{ stat: ArmorStatName; icon_path: string }> {
  const byStat = new Map<ArmorStatName, string>();

  for (const def of Object.values(stats)) {
    if (def.redacted) continue;
    const statName = statNameByHash.get(def.hash);
    if (!statName) continue;
    const path = pickStatIconPath(def.displayProperties);
    if (path && !byStat.has(statName)) byStat.set(statName, path);
  }

  for (const statName of ARMOR_STAT_NAMES) {
    if (byStat.has(statName)) continue;
    const def = Object.values(stats).find((d) => {
      if (d.redacted) return false;
      const n = d.displayProperties?.name?.trim();
      return n === statName && Boolean(pickStatIconPath(d.displayProperties));
    });
    const path = pickStatIconPath(def?.displayProperties);
    if (path) byStat.set(statName, path);
  }

  return ARMOR_STAT_NAMES.filter((s) => byStat.has(s)).map((stat) => ({
    stat,
    icon_path: byStat.get(stat)!,
  }));
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
  const {
    version,
    items,
    socketTypes,
    collectibles,
    stats,
    equipableItemSets,
  } = inputs;

  const { archetype: archetypeCategoryHashes, tuning: tuningCategoryHashes } =
    findCategoryHashes(socketTypes);

  const statNameByHash = buildStatNameByHash(stats);
  const armorStatIcons = buildArmorStatIcons(stats, statNameByHash);

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

  // Group armor by manifest equipable set hash (avoids merging unrelated rows that share a display name).
  const armorSetByEqHash = new Map<
    number,
    {
      season_id: number | null;
      pieces: number;
      name: string;
      /** Every `djb2(legacyLabel)` seen for this equipable set (matches any older `views.set_hash`). */
      legacyDjbs: Set<number>;
    }
  >();
  const armorItems: Array<{
    item_hash: number;
    set_hash: number;
    slot: ArmorSlot;
    class_type: number;
    icon_path: string;
  }> = [];

  for (const item of Object.values(items)) {
    if (item.redacted || item.blacklisted) continue;
    const slot = classifyArmorPiece(item);
    if (!slot) continue;
    // Legendary (etc.) armor sets only — exotics are one-offs and clutter the set picker.
    if (item.inventory?.tierType === DESTINY_TIER_EXOTIC) continue;
    // Formal armor set bonus (2/4 pieces) from EquipableItemSets + Armor 3.0 sockets.
    const eqSetHash = item.equippingBlock?.equipableItemSetHash;
    if (!eqSetHash) continue;
    if (!equipableSetHasBonusPerks(eqSetHash, equipableItemSets)) continue;
    const eqDef = equipableItemSets[String(eqSetHash)];
    // Do not filter by `setItems`: the list is not reliably complete for every
    // item variant that still references this hash via `equipableItemSetHash`.
    if (
      !itemHasArmor30SocketCategories(
        item,
        archetypeCategoryHashes,
        tuningCategoryHashes,
      )
    ) {
      continue;
    }
    const name = item.displayProperties?.name;
    if (!name) continue;

    let fallbackSetName = stripSlotSuffix(name, slot);
    const collectible = item.collectibleHash
      ? collectibles[String(item.collectibleHash)]
      : undefined;
    if (collectible?.displayProperties?.name) {
      fallbackSetName = stripSlotSuffix(collectible.displayProperties.name, slot);
    }
    fallbackSetName = fallbackSetName.trim();
    const setName =
      eqDef?.displayProperties?.name?.trim() || fallbackSetName;
    if (!setName) continue;

    const legacyLabel = (fallbackSetName || setName).trim();
    const fp = djb2(legacyLabel);

    let setEntry = armorSetByEqHash.get(eqSetHash);
    if (!setEntry) {
      setEntry = {
        season_id: item.seasonHash ?? null,
        pieces: 0,
        name: setName,
        legacyDjbs: new Set([fp]),
      };
      armorSetByEqHash.set(eqSetHash, setEntry);
    } else {
      setEntry.legacyDjbs.add(fp);
    }
    setEntry.pieces++;

    armorItems.push({
      item_hash: item.hash,
      set_hash: eqSetHash,
      slot,
      class_type: item.classType ?? 3,
      icon_path:
        pickStatIconPath(item.displayProperties) ||
        pickStatIconPath(collectible?.displayProperties),
    });
  }

  // Filter: only keep sets that have at least 2 pieces (drop noise)
  const keptSetHashes = new Set<number>();
  const armorSets: Array<{
    set_hash: number;
    name: string;
    season_id: number | null;
    /** Smallest legacy fingerprint; indexed for one-off lookups. */
    legacy_set_hash: number;
    /** All legacy fingerprints for this equipable set (viewer may have any of these in `views.set_hash`). */
    legacy_set_hashes: number[];
  }> = [];
  for (const [set_hash, entry] of armorSetByEqHash.entries()) {
    if (entry.pieces < 2) continue;
    keptSetHashes.add(set_hash);
    const legacyArr = [...entry.legacyDjbs].sort((a, b) => a - b);
    const legacyMin = legacyArr[0] ?? 0;
    armorSets.push({
      set_hash,
      name: entry.name,
      season_id: entry.season_id,
      legacy_set_hash: legacyMin,
      legacy_set_hashes: legacyArr,
    });
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
    armorStatIcons,
  };
}
