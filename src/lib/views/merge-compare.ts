import type { ArmorSlot } from "@/lib/bungie/constants";
import { SLOT_ORDER } from "@/lib/bungie/constants";
import type { ArmorStatName } from "@/lib/db/types";
import { orderTertiaryStatsForDisplay } from "@/lib/views/progress";
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
  return orderTertiaryStatsForDisplay([...set]);
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

/** Slots where this tracker has at least one inventory match for `tertiary`. */
export function slotsWithMatches(
  payload: SerializableTrackerPayload,
  tertiary: ArmorStatName,
): ArmorSlot[] {
  if (!tertiaryApplicable(payload, tertiary)) return [];
  return SLOT_ORDER.filter((slot) => cellOwnedCount(payload, slot, tertiary) > 0);
}

/**
 * True if this armor slot is a reasonable exotic seat for tertiary column
 * `tertiary`: neither applicable tracker already has a matching piece in this
 * slot for this stat, and each applicable tracker still has ≥2 matching slots
 * elsewhere (inventory flexibility hint).
 */
export function isMergedExoticSlotCandidate(
  greenPayload: SerializableTrackerPayload,
  bluePayload: SerializableTrackerPayload,
  tertiary: ArmorStatName,
  slot: ArmorSlot,
  opts: { hasInventory: boolean },
): boolean {
  if (!opts.hasInventory) return false;
  const gApp = tertiaryApplicable(greenPayload, tertiary);
  const bApp = tertiaryApplicable(bluePayload, tertiary);
  if (!gApp && !bApp) return false;

  if (gApp && cellOwnedCount(greenPayload, slot, tertiary) > 0) return false;
  if (bApp && cellOwnedCount(bluePayload, slot, tertiary) > 0) return false;

  const sg = slotsWithMatches(greenPayload, tertiary);
  const sb = slotsWithMatches(bluePayload, tertiary);

  const greenOk = !gApp || sg.length >= 2;
  const blueOk = !bApp || sb.length >= 2;
  return greenOk && blueOk;
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
