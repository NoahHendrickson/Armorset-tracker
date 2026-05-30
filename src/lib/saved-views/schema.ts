import {
  filterPresetFromGridFilters,
  filterPresetSchema,
  filterPresetsEqual,
  parseFilterPreset,
  type FilterPreset,
} from "@/lib/filters/filter-preset";
import type { GridFiltersJson } from "@/lib/workspace/grid-filters-schema";

export const savedFilterViewPayloadSchema = filterPresetSchema;

export type SavedFilterViewPayload = FilterPreset;

export function parseSavedFilterViewPayload(
  raw: unknown,
): SavedFilterViewPayload | null {
  return parseFilterPreset(raw);
}

export function payloadFromGridFilters(
  filters: GridFiltersJson,
): SavedFilterViewPayload {
  return filterPresetFromGridFilters(filters);
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

export function savedViewPayloadMatchesFilters(
  filters: GridFiltersJson,
  payload: SavedFilterViewPayload,
): boolean {
  return filterPresetsEqual(
    filterPresetFromGridFilters(filters),
    payload,
  );
}

export function buildSavedFilterViewShareUrl(
  origin: string,
  slug: string,
): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/saved-views/${encodeURIComponent(slug)}`;
}
