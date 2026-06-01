import {
  ARMOR_STAT_NAMES,
  type ArmorStatName,
  type DerivedArmorPieceJson,
} from "@/lib/db/types";
import { tuningPositiveArmorStat } from "@/lib/views/tuning-positive-stat";

export type StatDelta = { stat: ArmorStatName; value: number };

/** Tier-5 intrinsic plug magnitudes (primary / secondary / tertiary). */
const INTRINSIC_STAT_MAGNITUDES = [30, 25, 20] as const;
const DEFAULT_TUNING_MAGNITUDE = 10;

/** Sum intrinsic armor_stats plugs plus optional tuning deltas. */
export function buildStatTotals(
  statPlugs: StatDelta[],
  tuningDeltas: StatDelta[] = [],
): Partial<Record<ArmorStatName, number>> {
  const totals: Partial<Record<ArmorStatName, number>> = {};
  for (const { stat, value } of statPlugs) {
    totals[stat] = (totals[stat] ?? 0) + value;
  }
  for (const { stat, value } of tuningDeltas) {
    totals[stat] = (totals[stat] ?? 0) + value;
  }
  return totals;
}

const TUNING_PAIR_RE = /\+(\w+)\s*\/\s*-(\w+)/;

/** Parse "+Weapons / -Grenade" from a tuning plug display name. */
export function parseTuningPairFromName(
  name: string,
): { positive: ArmorStatName; negative: ArmorStatName } | null {
  const m = TUNING_PAIR_RE.exec(name.trim());
  if (!m) return null;
  const allowed = new Set<string>(ARMOR_STAT_NAMES);
  if (!allowed.has(m[1]!) || !allowed.has(m[2]!)) return null;
  return {
    positive: m[1] as ArmorStatName,
    negative: m[2] as ArmorStatName,
  };
}

/** Fallback when manifest rows are missing — assumes symmetric +/- magnitudes. */
export function tuningDeltasFromDisplayName(
  name: string,
  magnitude = 10,
): StatDelta[] | null {
  const pair = parseTuningPairFromName(name);
  if (!pair) return null;
  return [
    { stat: pair.positive, value: magnitude },
    { stat: pair.negative, value: -magnitude },
  ];
}

/**
 * Estimate totals from ranked stat labels when cached rows predate `statTotals`.
 * Uses standard Tier-5 magnitudes and tuning name parsing (+/- pair or +stat only).
 */
export function estimateStatTotalsFromLabels(
  piece: DerivedArmorPieceJson,
): Partial<Record<ArmorStatName, number>> | null {
  const ranked = [piece.primaryStat, piece.secondaryStat, piece.tertiaryStat];
  if (ranked.some((stat) => stat == null)) return null;

  const totals: Partial<Record<ArmorStatName, number>> = {};
  ranked.forEach((stat, index) => {
    if (!stat) return;
    totals[stat] =
      (totals[stat] ?? 0) + INTRINSIC_STAT_MAGNITUDES[index]!;
  });

  const tuningDeltas = tuningDeltasFromDisplayName(
    piece.tuningName ?? "",
    DEFAULT_TUNING_MAGNITUDE,
  );
  if (tuningDeltas) {
    for (const delta of tuningDeltas) {
      totals[delta.stat] = (totals[delta.stat] ?? 0) + delta.value;
    }
  } else {
    const positive = tuningPositiveArmorStat(piece.tuningName ?? "");
    if (positive) {
      totals[positive] =
        (totals[positive] ?? 0) + DEFAULT_TUNING_MAGNITUDE;
    }
  }

  return Object.keys(totals).length > 0 ? totals : null;
}

export function resolvePieceStatTotals(
  piece: DerivedArmorPieceJson,
): Partial<Record<ArmorStatName, number>> {
  if (piece.statTotals != null && Object.keys(piece.statTotals).length > 0) {
    return piece.statTotals;
  }
  return estimateStatTotalsFromLabels(piece) ?? {};
}

export function getPieceStatTotals(
  piece: DerivedArmorPieceJson,
): Partial<Record<ArmorStatName, number>> {
  return resolvePieceStatTotals(piece);
}

export function getPieceStatValue(
  piece: DerivedArmorPieceJson,
  stat: ArmorStatName,
): number {
  return getPieceStatTotals(piece)[stat] ?? 0;
}

/** Highest value a stat can reach on this piece (committed roll or any tuning branch). */
export function getPieceStatCeiling(
  piece: DerivedArmorPieceJson,
  stat: ArmorStatName,
): number {
  let max = getPieceStatValue(piece, stat);
  for (const variant of piece.tuningVariants ?? []) {
    max = Math.max(max, variant[stat] ?? 0);
  }
  return max;
}

export function pieceHasStatTotals(piece: DerivedArmorPieceJson): boolean {
  return Object.keys(resolvePieceStatTotals(piece)).length > 0;
}

/** Gear tier (1–5) inferred from a piece's intrinsic stat-plug magnitudes. */
const TIER5_INTRINSICS = [30, 25, 20] as const;

/**
 * Map the three intrinsic `armor_stats` plug magnitudes to an Armor 3.0 gear
 * tier. Per Bungie's Armor 3.0 reveal, Tier 5 is the only tier guaranteed a
 * perfect 30 / 25 / 20 primary / secondary / tertiary roll; lower tiers carry
 * smaller, ranged stat budgets. Returns `null` when no intrinsic plugs are
 * known (e.g. exotics, whose stats aren't tier-gated).
 */
export function armorTierFromIntrinsicMagnitudes(
  magnitudes: number[],
): number | null {
  if (magnitudes.length === 0) return null;
  const ranked = [...magnitudes].sort((a, b) => b - a);
  if (
    ranked.length >= 3 &&
    ranked[0] === TIER5_INTRINSICS[0] &&
    ranked[1] === TIER5_INTRINSICS[1] &&
    ranked[2] === TIER5_INTRINSICS[2]
  ) {
    return 5;
  }
  const total = ranked.reduce((sum, value) => sum + value, 0);
  if (total >= 70) return 4;
  if (total >= 64) return 3;
  if (total >= 58) return 2;
  return 1;
}

/**
 * True when a piece is Tier 5 armor. Prefers the stored `tier` (computed from
 * intrinsic plugs at derive time); for older cached rows lacking it, falls back
 * to the ~75 total-stat signature of a Tier 5 roll.
 */
export function isTier5Piece(piece: DerivedArmorPieceJson): boolean {
  if (piece.tier != null) return piece.tier === 5;
  const totals = resolvePieceStatTotals(piece);
  const sum = Object.values(totals).reduce<number>(
    (acc, value) => acc + (value ?? 0),
    0,
  );
  return sum >= 73 && sum <= 80;
}
