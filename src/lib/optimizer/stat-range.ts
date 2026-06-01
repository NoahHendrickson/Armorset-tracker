/** Armor 3.0 stat point cap used by the loadout optimizer UI. */
export const OPTIMIZER_STAT_MIN = 0;
export const OPTIMIZER_STAT_MAX = 200;

/** Tier milestone ticks on the 0–200 stat track (D2ArmorPicker-style). */
export const OPTIMIZER_STAT_TIER_MARKS = [50, 100, 150, 200] as const;

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
