import { z } from "zod";
import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";
import type { GridFiltersJson } from "@/lib/workspace/grid-filters-schema";

const HASH_LIST_MAX = 256;

export const savedFilterViewPayloadSchema = z.object({
  version: z.literal(1),
  setHashes: z.array(z.number().int().nonnegative()).max(HASH_LIST_MAX),
  archetypeHashes: z.array(z.number().int().nonnegative()).max(HASH_LIST_MAX),
  tuningHashes: z.array(z.number().int().nonnegative()).max(HASH_LIST_MAX),
  tertiaryStats: z
    .array(
      z.enum(
        ARMOR_STAT_NAMES as unknown as [ArmorStatName, ...ArmorStatName[]],
      ),
    )
    .max(ARMOR_STAT_NAMES.length),
});

export type SavedFilterViewPayload = z.infer<typeof savedFilterViewPayloadSchema>;

export function parseSavedFilterViewPayload(
  raw: unknown,
): SavedFilterViewPayload | null {
  const parsed = savedFilterViewPayloadSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function payloadFromGridFilters(
  filters: GridFiltersJson,
): SavedFilterViewPayload {
  return {
    version: 1,
    setHashes: [...filters.setHashes],
    archetypeHashes: [...filters.archetypeHashes],
    tuningHashes: [...filters.tuningHashes],
    tertiaryStats: [...filters.tertiaryStats],
  };
}

export function applyPayloadToGridFilters(
  current: GridFiltersJson,
  payload: SavedFilterViewPayload,
): GridFiltersJson {
  return {
    ...current,
    version: 1,
    setHashes: [...payload.setHashes],
    archetypeHashes: [...payload.archetypeHashes],
    tuningHashes: [...payload.tuningHashes],
    tertiaryStats: [...payload.tertiaryStats],
  };
}

function sortedNumbers(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

function sortedStrings(values: readonly string[]): string[] {
  return [...values].sort();
}

export function savedViewPayloadMatchesFilters(
  filters: GridFiltersJson,
  payload: SavedFilterViewPayload,
): boolean {
  const aSets = sortedNumbers(filters.setHashes);
  const bSets = sortedNumbers(payload.setHashes);
  if (aSets.length !== bSets.length || aSets.some((v, i) => v !== bSets[i])) {
    return false;
  }

  const aArchetypes = sortedNumbers(filters.archetypeHashes);
  const bArchetypes = sortedNumbers(payload.archetypeHashes);
  if (
    aArchetypes.length !== bArchetypes.length ||
    aArchetypes.some((v, i) => v !== bArchetypes[i])
  ) {
    return false;
  }

  const aTunings = sortedNumbers(filters.tuningHashes);
  const bTunings = sortedNumbers(payload.tuningHashes);
  if (aTunings.length !== bTunings.length || aTunings.some((v, i) => v !== bTunings[i])) {
    return false;
  }

  const aStats = sortedStrings(filters.tertiaryStats);
  const bStats = sortedStrings(payload.tertiaryStats);
  return (
    aStats.length === bStats.length && aStats.every((v, i) => v === bStats[i])
  );
}

export function buildSavedFilterViewShareUrl(
  origin: string,
  slug: string,
): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/saved-views/${encodeURIComponent(slug)}`;
}
