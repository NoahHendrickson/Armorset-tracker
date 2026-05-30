import { z } from "zod";
import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";

const HASH_LIST_MAX = 256;

/** Hash/stat dimensions shared by grid filters, saved views, and share links. */
export const filterPresetSchema = z.object({
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

export type FilterPreset = z.infer<typeof filterPresetSchema>;

export function parseFilterPreset(raw: unknown): FilterPreset | null {
  const parsed = filterPresetSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function sortedNumbers(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

function sortedStrings(values: readonly string[]): string[] {
  return [...values].sort();
}

export function filterPresetsEqual(
  a: FilterPreset,
  b: FilterPreset,
): boolean {
  const aSets = sortedNumbers(a.setHashes);
  const bSets = sortedNumbers(b.setHashes);
  if (aSets.length !== bSets.length || aSets.some((v, i) => v !== bSets[i])) {
    return false;
  }

  const aArchetypes = sortedNumbers(a.archetypeHashes);
  const bArchetypes = sortedNumbers(b.archetypeHashes);
  if (
    aArchetypes.length !== bArchetypes.length ||
    aArchetypes.some((v, i) => v !== bArchetypes[i])
  ) {
    return false;
  }

  const aTunings = sortedNumbers(a.tuningHashes);
  const bTunings = sortedNumbers(b.tuningHashes);
  if (
    aTunings.length !== bTunings.length ||
    aTunings.some((v, i) => v !== bTunings[i])
  ) {
    return false;
  }

  const aStats = sortedStrings(a.tertiaryStats);
  const bStats = sortedStrings(b.tertiaryStats);
  return (
    aStats.length === bStats.length && aStats.every((v, i) => v === bStats[i])
  );
}

export function filterPresetFromGridFilters(
  filters: Pick<
    FilterPreset,
    "setHashes" | "archetypeHashes" | "tuningHashes" | "tertiaryStats"
  > & { version?: 1 },
): FilterPreset {
  return {
    version: 1,
    setHashes: [...filters.setHashes],
    archetypeHashes: [...filters.archetypeHashes],
    tuningHashes: [...filters.tuningHashes],
    tertiaryStats: [...filters.tertiaryStats],
  };
}
