import {
  ARMOR_STAT_NAMES,
  type ArmorStatName,
} from "@/lib/db/types";

/**
 * Bungie `DestinyStatDefinition` hashes for Armor 3.0 stat names.
 * Used when `armor_stat_icons.destiny_stat_hash` is missing (pre-sync DBs) so
 * profile ItemStats (component 304) can still map instance stat blocks.
 */
export const ARMOR_STAT_DESTINY_HASH: Record<ArmorStatName, number> = {
  Weapons: 2_996_146_975,
  Health: 392_767_087,
  Class: 2_135_857_333,
  Grenade: 1_735_777_505,
  Melee: 4_244_567_218,
  Super: 144_602_215,
};

/** Build hash → stat map, optionally overridden by manifest-synced rows. */
export function buildDestinyStatHashToArmorStat(
  fromDb?: Iterable<readonly [number, ArmorStatName]>,
): Map<number, ArmorStatName> {
  const map = new Map<number, ArmorStatName>();
  for (const stat of ARMOR_STAT_NAMES) {
    map.set(ARMOR_STAT_DESTINY_HASH[stat], stat);
  }
  if (fromDb) {
    for (const [hash, stat] of fromDb) {
      if (Number.isFinite(hash)) {
        map.set(hash, stat);
      }
    }
  }
  return map;
}
