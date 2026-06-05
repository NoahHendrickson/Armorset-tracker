import { TIER5_DISPLAY_BASE_STAT } from "@/lib/inventory/armor-tuning-stats";
import { TUNING_PLUG_STAT_MAGNITUDE } from "@/lib/inventory/compute-stat-totals";
import type { ArmorStatName } from "@/lib/db/types";
import type { ArchetypePair } from "@/lib/plan/archetype-pair";

const PRIMARY_INTRINSIC = 30;
const SECONDARY_INTRINSIC = 25;
const TERTIARY_INTRINSIC = 20;

/**
 * Armor 3.0 full masterwork: +5 on each of the three stats that are not the
 * piece's primary, secondary, or tertiary intrinsics (15 total per piece).
 * Matches Tier 5 display filler used in the inventory optimizer path.
 */
export const FULLY_MASTERWORKED_OFF_STAT_BONUS = TIER5_DISPLAY_BASE_STAT;

function isIntrinsicStatOnPiece(
  pair: ArchetypePair,
  stat: ArmorStatName,
  tertiary: ArmorStatName,
): boolean {
  return (
    stat === pair.primary || stat === pair.secondary || stat === tertiary
  );
}

/** Tier-5 intrinsics + full masterwork + tuning on one synthetic legendary piece. */
export function pieceStatCeiling(
  pair: ArchetypePair,
  stat: ArmorStatName,
  tertiary: ArmorStatName,
  tuningPositive: ArmorStatName,
  tuningNegative: ArmorStatName,
): number {
  let total = 0;
  if (stat === pair.primary) total += PRIMARY_INTRINSIC;
  if (stat === pair.secondary) total += SECONDARY_INTRINSIC;
  if (stat === tertiary) total += TERTIARY_INTRINSIC;
  if (!isIntrinsicStatOnPiece(pair, stat, tertiary)) {
    total += FULLY_MASTERWORKED_OFF_STAT_BONUS;
  }
  if (stat === tuningPositive) total += TUNING_PLUG_STAT_MAGNITUDE;
  if (stat === tuningNegative) total -= TUNING_PLUG_STAT_MAGNITUDE;
  return total;
}

export const SYNTHETIC_INTRINSIC_MAGNITUDES = {
  primary: PRIMARY_INTRINSIC,
  secondary: SECONDARY_INTRINSIC,
  tertiary: TERTIARY_INTRINSIC,
} as const;
