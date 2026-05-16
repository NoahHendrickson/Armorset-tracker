import { z } from "zod";
import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";

/** Single-class scope: 0 = Titan, 1 = Hunter, 2 = Warlock. */
export const GRID_FILTER_CLASS_VALUES = [0, 1, 2] as const;
export type GridFilterClass = (typeof GRID_FILTER_CLASS_VALUES)[number];

const HASH_LIST_MAX = 256;
const SEARCH_MAX = 128;

export const gridFiltersSchema = z.object({
  version: z.literal(1),
  class: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  setHashes: z.array(z.number().int().nonnegative()).max(HASH_LIST_MAX),
  archetypeHashes: z.array(z.number().int().nonnegative()).max(HASH_LIST_MAX),
  tuningHashes: z.array(z.number().int().nonnegative()).max(HASH_LIST_MAX),
  tertiaryStats: z
    .array(z.enum(ARMOR_STAT_NAMES as unknown as [ArmorStatName, ...ArmorStatName[]]))
    .max(ARMOR_STAT_NAMES.length),
  search: z.string().max(SEARCH_MAX),
});

export type GridFiltersJson = z.infer<typeof gridFiltersSchema>;

export function defaultGridFilters(): GridFiltersJson {
  return {
    version: 1,
    class: 0,
    setHashes: [],
    archetypeHashes: [],
    tuningHashes: [],
    tertiaryStats: [],
    search: "",
  };
}

/** Tolerant parser — returns defaults on any structural failure. */
export function parseGridFilters(raw: unknown): GridFiltersJson {
  if (raw === null || typeof raw !== "object") {
    return defaultGridFilters();
  }
  const parsed = gridFiltersSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return defaultGridFilters();
}

/**
 * Does at least one of the unblocking filters (set / archetype / tuning) have a
 * selection? Tertiary stats and search alone do NOT unblock — they narrow once
 * a primary axis is picked.
 */
export function gridFiltersHaveUnblockingSelection(
  filters: GridFiltersJson,
): boolean {
  return (
    filters.setHashes.length > 0 ||
    filters.archetypeHashes.length > 0 ||
    filters.tuningHashes.length > 0
  );
}
