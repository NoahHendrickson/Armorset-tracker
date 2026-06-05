import type { ArmorStatName } from "@/lib/db/types";

/** Armor 3.0 stat point cap used by the loadout optimizer UI. */
export const OPTIMIZER_STAT_MIN = 0;
export const OPTIMIZER_STAT_MAX = 200;

/**
 * Stat target list order in the optimizer UI.
 * Matches D2ArmorPicker `ARMORSTAT_ORDER` (Health → Melee → Grenade → Super → Class → Weapons).
 */
export const OPTIMIZER_STAT_DISPLAY_ORDER: readonly ArmorStatName[] = [
  "Health",
  "Melee",
  "Grenade",
  "Super",
  "Class",
  "Weapons",
];

/** Tier milestone ticks on the 0–200 stat track (D2ArmorPicker-style). */
export const OPTIMIZER_STAT_TIER_MARKS = [50, 100, 150, 200] as const;

/** Clickable min-target presets on the stat slider track. */
export const OPTIMIZER_STAT_SEGMENTS = [0, 50, 100, 200] as const;

/** Tick marks and labels shown on the 0–200 stat track (Figma parity). */
export const OPTIMIZER_STAT_TICKS = [0, 50, 100, 150, 200] as const;

export function isOptimizerStatTick(value: number): boolean {
  return (OPTIMIZER_STAT_TICKS as readonly number[]).includes(value);
}

export function clampOptimizerStat(value: number): number {
  return Math.round(
    Math.min(OPTIMIZER_STAT_MAX, Math.max(OPTIMIZER_STAT_MIN, value)),
  );
}

export function pctOnOptimizerTrack(value: number): number {
  const span = OPTIMIZER_STAT_MAX - OPTIMIZER_STAT_MIN;
  if (span <= 0) return 0;
  return (
    ((clampOptimizerStat(value) - OPTIMIZER_STAT_MIN) / span) * 100
  );
}

/** Normalized position on the inset stat track (0 = min, 1 = max). */
export function trackRatioFromValue(value: number): number {
  return pctOnOptimizerTrack(value) / 100;
}

/** Map a normalized inset-track ratio back to a stat value. */
export function valueFromTrackRatio(ratio: number): number {
  const span = OPTIMIZER_STAT_MAX - OPTIMIZER_STAT_MIN;
  const clampedRatio = Math.min(1, Math.max(0, ratio));
  return clampOptimizerStat(OPTIMIZER_STAT_MIN + clampedRatio * span);
}

/** Snap to a preset anchor when within `snapThreshold` stat points. */
export function snapOptimizerStat(
  value: number,
  snapThreshold = 8,
): number {
  const clamped = clampOptimizerStat(value);
  let nearest: (typeof OPTIMIZER_STAT_SEGMENTS)[number] =
    OPTIMIZER_STAT_SEGMENTS[0];
  let minDist = Infinity;
  for (const segment of OPTIMIZER_STAT_SEGMENTS) {
    const dist = Math.abs(clamped - segment);
    if (dist < minDist) {
      minDist = dist;
      nearest = segment;
    }
  }
  if (minDist <= snapThreshold) return nearest;
  return clamped;
}

/** Horizontal inset (px) so thumb/anchor centers align with track ends. */
export const OPTIMIZER_TRACK_INSET = {
  compact: 8,
  default: 10,
} as const;
