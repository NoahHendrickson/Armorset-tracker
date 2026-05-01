import type { ArmorSlot } from "@/lib/bungie/constants";
import { SLOT_ORDER } from "@/lib/bungie/constants";
import type { ArmorStatName } from "@/lib/db/types";
import type { SerializableTrackerPayload } from "@/lib/workspace/types";

/** Figma merge accents: primary green, secondary blue. */
export const MERGE_ACCENT_GREEN = "#00FF85";
export const MERGE_ACCENT_BLUE = "#38bdf8";

/** Lower view id = green (A), higher = blue (B) — stable across both panels. */
export function mergeColorOrder(idA: string, idB: string): {
  greenId: string;
  blueId: string;
} {
  return idA.localeCompare(idB) <= 0
    ? { greenId: idA, blueId: idB }
    : { greenId: idB, blueId: idA };
}

export function unionTertiaryStats(
  a: SerializableTrackerPayload,
  b: SerializableTrackerPayload,
): ArmorStatName[] {
  const set = new Set<ArmorStatName>([
    ...(a.progress.tertiaryStats as ArmorStatName[]),
    ...(b.progress.tertiaryStats as ArmorStatName[]),
  ]);
  return [...set].sort((x, y) => x.localeCompare(y));
}

export interface MergeCompareCellState {
  greenOwned: boolean;
  blueOwned: boolean;
  greenApplicable: boolean;
  blueApplicable: boolean;
  greenCount: number;
  blueCount: number;
}

function cellOwnedCount(
  payload: SerializableTrackerPayload,
  slot: ArmorSlot,
  tertiary: ArmorStatName,
): number {
  return payload.progress.cells[slot]?.[tertiary]?.length ?? 0;
}

function tertiaryApplicable(
  payload: SerializableTrackerPayload,
  tertiary: ArmorStatName,
): boolean {
  return (payload.progress.tertiaryStats as ArmorStatName[]).includes(tertiary);
}

/**
 * Per-cell state for merged compare grid: green / blue are ordered by
 * `mergeColorOrder(payloadA.view.id, payloadB.view.id)`.
 */
export function mergeCompareCellState(
  greenPayload: SerializableTrackerPayload,
  bluePayload: SerializableTrackerPayload,
  slot: ArmorSlot,
  tertiary: ArmorStatName,
): MergeCompareCellState {
  const gA = tertiaryApplicable(greenPayload, tertiary);
  const gB = tertiaryApplicable(bluePayload, tertiary);
  const cG = cellOwnedCount(greenPayload, slot, tertiary);
  const cB = cellOwnedCount(bluePayload, slot, tertiary);
  return {
    greenApplicable: gA,
    blueApplicable: gB,
    greenOwned: gA && cG > 0,
    blueOwned: gB && cB > 0,
    greenCount: cG,
    blueCount: cB,
  };
}

/** True when every cell with at least one applicable side is covered by union ownership. */
export function isUnionGridComplete(
  greenPayload: SerializableTrackerPayload,
  bluePayload: SerializableTrackerPayload,
): boolean {
  const tertiaries = unionTertiaryStats(greenPayload, bluePayload);
  for (const slot of SLOT_ORDER) {
    for (const t of tertiaries) {
      const s = mergeCompareCellState(greenPayload, bluePayload, slot, t);
      if (!s.greenApplicable && !s.blueApplicable) continue;
      if (!(s.greenOwned || s.blueOwned)) return false;
    }
  }
  return tertiaries.length > 0;
}
