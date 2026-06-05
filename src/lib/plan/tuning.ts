import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";
import type { ArchetypePair } from "@/lib/plan/archetype-pair";

export function tuningNegativeOptions(
  tuningPositive: ArmorStatName,
): ArmorStatName[] {
  return ARMOR_STAT_NAMES.filter((s) => s !== tuningPositive);
}

export function formatTuningLabel(
  positive: ArmorStatName,
  negative: ArmorStatName,
): string {
  return `+${positive} / −${negative}`;
}

/** Default +5 toward primary (matches common roll focus). */
export function defaultTuningPositive(pair: ArchetypePair): ArmorStatName {
  return pair.primary;
}

/** Default −5 on first stat that is not the tuning buff. */
export function defaultTuningNegative(
  tuningPositive: ArmorStatName,
  avoid?: ArmorStatName,
): ArmorStatName {
  for (const stat of ARMOR_STAT_NAMES) {
    if (stat === tuningPositive) continue;
    if (avoid != null && stat === avoid) continue;
    return stat;
  }
  return tuningNegativeOptions(tuningPositive)[0] ?? "Health";
}

export function isValidTuningPair(
  tuningPositive: ArmorStatName,
  tuningNegative: ArmorStatName,
): boolean {
  return (
    tuningPositive !== tuningNegative &&
    ARMOR_STAT_NAMES.includes(tuningPositive) &&
    ARMOR_STAT_NAMES.includes(tuningNegative)
  );
}
