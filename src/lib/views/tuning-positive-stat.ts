import type { ArmorStatName } from "@/lib/db/types";
import { ARMOR_STAT_NAMES } from "@/lib/db/types";

/**
 * Tuning buckets use display names like `+Weapons`; parse the boosted stat slug.
 */
export function tuningPositiveArmorStat(
  tuningDisplayName: string,
): ArmorStatName | null {
  const m = /^\+(\w+)/.exec(tuningDisplayName.trim());
  if (!m) return null;
  const raw = m[1];
  return (ARMOR_STAT_NAMES as readonly string[]).includes(raw)
    ? (raw as ArmorStatName)
    : null;
}
