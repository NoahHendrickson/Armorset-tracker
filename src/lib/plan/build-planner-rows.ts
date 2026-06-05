import type { GridLookupPayload } from "@/lib/views/grid-lookup-payload";
import {
  CUSTOM_ARCHETYPE_DISPLAY_NAME,
  CUSTOM_ARCHETYPE_ID,
  CUSTOM_ARCHETYPE_PAIR,
} from "@/lib/plan/constants";
import {
  defaultTertiaryForPair,
  type PlanArchetypeRow,
  type PlanArchetypeSelection,
} from "@/lib/plan/archetype-bounds";
import type { ArchetypePair } from "@/lib/plan/archetype-pair";
import {
  defaultTuningNegative,
  defaultTuningPositive,
} from "@/lib/plan/tuning";

function defaultSelectionForPair(pair: ArchetypePair): Omit<
  PlanArchetypeSelection,
  "pieceCount"
> {
  const tertiary = defaultTertiaryForPair(pair);
  const tuningPositive = defaultTuningPositive(pair);
  return {
    tertiary,
    tuningPositive,
    tuningNegative: defaultTuningNegative(tuningPositive, tertiary),
  };
}

export function buildPlanArchetypeRows(
  lookupPayload: GridLookupPayload,
): PlanArchetypeRow[] {
  const manifest: PlanArchetypeRow[] = Object.entries(
    lookupPayload.archetypeStatPair,
  )
    .map(([hash, pair]) => ({
      id: hash,
      name: lookupPayload.archetypeNameByHash[hash] ?? `Archetype ${hash}`,
      pair: pair as ArchetypePair,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return [
    ...manifest,
    {
      id: CUSTOM_ARCHETYPE_ID,
      name: CUSTOM_ARCHETYPE_DISPLAY_NAME,
      pair: CUSTOM_ARCHETYPE_PAIR,
      isCustom: true,
    },
  ];
}

export function defaultPlanSelections(
  rows: readonly PlanArchetypeRow[],
): Record<string, PlanArchetypeSelection> {
  const out: Record<string, PlanArchetypeSelection> = {};
  for (const row of rows) {
    out[row.id] = {
      ...defaultSelectionForPair(row.pair),
      pieceCount: 0,
    };
  }
  return out;
}

/** Default: all five pieces on the first manifest archetype (e.g. Bulwark / Gunner). */
export function initialPlanSelections(
  rows: readonly PlanArchetypeRow[],
): Record<string, PlanArchetypeSelection> {
  const out = defaultPlanSelections(rows);
  const firstManifest = rows.find((r) => !r.isCustom);
  if (firstManifest) {
    out[firstManifest.id] = {
      ...defaultSelectionForPair(firstManifest.pair),
      pieceCount: 5,
    };
  }
  return out;
}
