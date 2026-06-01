import {
  ARMOR_STAT_NAMES,
  type ArmorStatName,
} from "@/lib/db/types";

/** Standard Armor 3.0 general stat mod (+10). */
export const MAJOR_ARMOR_STAT_MOD = 10;
/** Standard Armor 3.0 minor stat mod (+5). */
export const MINOR_ARMOR_STAT_MOD = 5;
/** Artifice armor extra +3 stat mod (separate socket, not a major/minor slot). */
export const ARTIFICE_ARMOR_STAT_MOD = 3;

export type AssumedStatMods = {
  /** How many major (+10) stat mods to assume (0–5, one per armor piece). */
  majorCount: number;
  /**
   * When true (default), each remaining armor piece assumes a minor (+5) mod.
   * Set false only for tests or “no assumed mods” (e.g. majorCount 0 → zero budget).
   */
  slotFill?: boolean;
  /**
   * When true (default), assume one +3 artifice mod toward an active minimum
   * (does not consume major/minor slots — matches a single artifice +3 in DIM).
   */
  artifice?: boolean;
};

export const DEFAULT_ASSUMED_STAT_MODS: AssumedStatMods = {
  majorCount: 5,
  slotFill: true,
  artifice: true,
};

/** Zero assumed mod budget — for bounds/search tests without mod inflation. */
export const NO_ASSUMED_STAT_MODS: AssumedStatMods = {
  majorCount: 0,
  slotFill: false,
};

const MAX_MAJOR_MODS = 5;

export type AssumedModBudget = {
  majorCount: number;
  majorTotal: number;
  minorCount: number;
  minorTotal: number;
  /** Combined +10/+5 mod points available across the whole loadout. */
  total: number;
};

/**
 * Shared mod pool for the loadout — not duplicated per target stat.
 * Each armor piece has one stat mod slot: major (+10) or minor (+5), not both.
 */
export function totalAssumedModBudget(
  options: AssumedStatMods,
  pieceCount = 5,
): AssumedModBudget {
  const majorCount = Math.min(
    MAX_MAJOR_MODS,
    Math.min(pieceCount, Math.max(0, Math.round(options.majorCount))),
  );
  const majorTotal = majorCount * MAJOR_ARMOR_STAT_MOD;
  const slotFill = options.slotFill !== false;
  const minorCount = slotFill ? Math.max(0, pieceCount - majorCount) : 0;
  const minorTotal = minorCount * MINOR_ARMOR_STAT_MOD;
  return {
    majorCount,
    majorTotal,
    minorCount,
    minorTotal,
    total: majorTotal + minorTotal,
  };
}

/**
 * @deprecated Use `totalAssumedModBudget` + `resolveLoadoutTotals` instead.
 * Returns all zeros — mod budget is no longer folded into per-stat offsets.
 */
export function computeAssumedModStatOffset(
  _options: AssumedStatMods,
  _pieceCount = 5,
  _targetStats?: readonly ArmorStatName[],
): Record<ArmorStatName, number> {
  return Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [stat, 0]),
  ) as Record<ArmorStatName, number>;
}
