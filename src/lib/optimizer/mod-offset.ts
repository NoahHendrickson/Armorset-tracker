import {
  ARMOR_STAT_NAMES,
  type ArmorStatName,
} from "@/lib/db/types";

/** Standard Armor 3.0 general stat mod (+10). */
export const MAJOR_ARMOR_STAT_MOD = 10;
/** Standard Armor 3.0 minor stat mod (+5). */
export const MINOR_ARMOR_STAT_MOD = 5;

export type AssumedStatMods = {
  major: boolean;
  minor: boolean;
};

export const DEFAULT_ASSUMED_STAT_MODS: AssumedStatMods = {
  major: true,
  minor: false,
};

/**
 * Optimistic mod budget when each armor piece can slot one major and/or minor
 * stat mod toward a single stat (+10 / +5). Five pieces → up to +50 / +75 on
 * one stat. Used for achievable-range bars and search feasibility.
 */
export function computeAssumedModStatOffset(
  options: AssumedStatMods,
  pieceCount = 5,
  /** When set, mod budget applies only to these stats (one mod focus per build). */
  targetStats?: readonly ArmorStatName[],
): Record<ArmorStatName, number> {
  const perPiece =
    (options.major ? MAJOR_ARMOR_STAT_MOD : 0) +
    (options.minor ? MINOR_ARMOR_STAT_MOD : 0);
  const total = perPiece * pieceCount;
  const applyTo =
    targetStats && targetStats.length > 0 ? targetStats : ARMOR_STAT_NAMES;
  return Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [
      stat,
      applyTo.includes(stat) ? total : 0,
    ]),
  ) as Record<ArmorStatName, number>;
}
