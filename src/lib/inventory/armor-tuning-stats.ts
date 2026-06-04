import {
  ARMOR_STAT_NAMES,
  type ArmorStatName,
  type DerivedArmorPieceJson,
} from "@/lib/db/types";
import {
  buildStatTotals,
  type StatDelta,
  TUNING_PLUG_STAT_MAGNITUDE,
  tuningDeltasFromDisplayName,
} from "@/lib/inventory/compute-stat-totals";
import { tuningPositiveArmorStat } from "@/lib/views/tuning-positive-stat";

/** Non-intrinsic stats on Tier 5 legendaries display at +5 in D2ArmorPicker. */
export const TIER5_DISPLAY_BASE_STAT = 5;

/**
 * D2AP-style per-piece stats: intrinsics (+ Tier 5 base filler), tuning applied
 * separately in the optimizer armor tuning row — not baked into `statTotals`.
 */
export function expandTier5DisplayTotals(
  totals: Partial<Record<ArmorStatName, number>>,
  tier: number | null | undefined,
): Partial<Record<ArmorStatName, number>> {
  if (tier !== 5) return { ...totals };
  const out = { ...totals };
  for (const stat of ARMOR_STAT_NAMES) {
    const current = out[stat];
    if (current === undefined || current <= 0) {
      out[stat] = TIER5_DISPLAY_BASE_STAT;
    }
  }
  return out;
}

export function resolvePieceTuningDeltas(
  piece: DerivedArmorPieceJson,
): StatDelta[] {
  if (piece.tuningDeltas != null && piece.tuningDeltas.length > 0) {
    return piece.tuningDeltas;
  }
  if (!piece.tuningName || piece.tuningCommitted === false) {
    return [];
  }
  const fromPair = tuningDeltasFromDisplayName(
    piece.tuningName,
    TUNING_PLUG_STAT_MAGNITUDE,
  );
  if (fromPair) {
    return fromPair;
  }
  const positive = tuningPositiveArmorStat(piece.tuningName);
  if (!positive) {
    return [];
  }
  const deltas: StatDelta[] = [
    { stat: positive, value: TUNING_PLUG_STAT_MAGNITUDE },
  ];
  for (const stat of ARMOR_STAT_NAMES) {
    const value = piece.statTotals?.[stat];
    if (value !== undefined && value < 0) {
      deltas.push({ stat, value });
      break;
    }
  }
  return deltas;
}

/** Infer +/- tuning from a full variant map (legacy cached rows). */
export function tuningDeltasFromVariantMap(
  piece: DerivedArmorPieceJson,
  variant: Partial<Record<ArmorStatName, number>>,
): StatDelta[] {
  const positive = tuningPositiveArmorStat(piece.tuningName ?? "");
  if (!positive) {
    return tuningDeltasFromDisplayName(piece.tuningName ?? "") ?? [];
  }
  const deltas: StatDelta[] = [
    { stat: positive, value: TUNING_PLUG_STAT_MAGNITUDE },
  ];
  for (const stat of ARMOR_STAT_NAMES) {
    const value = variant[stat];
    if (value !== undefined && value < 0) {
      deltas.push({ stat, value });
      return deltas;
    }
  }
  return (
    tuningDeltasFromDisplayName(piece.tuningName ?? "", TUNING_PLUG_STAT_MAGNITUDE) ??
    deltas
  );
}

export function stripTuningFromTotals(
  totals: Partial<Record<ArmorStatName, number>>,
  deltas: StatDelta[],
): Partial<Record<ArmorStatName, number>> {
  if (deltas.length === 0) return { ...totals };
  const out = { ...totals };
  for (const { stat, value } of deltas) {
    out[stat] = (out[stat] ?? 0) - value;
  }
  return out;
}

/**
 * Per-piece display stats for optimizer sums (D2AP piece rows).
 * Legacy rows with tuning baked in are stripped; Tier 5 filler stats expanded.
 */
export function pieceDisplayStatTotals(
  piece: DerivedArmorPieceJson,
  branch?: Partial<Record<ArmorStatName, number>>,
): Partial<Record<ArmorStatName, number>> {
  const source = branch ?? piece.statTotals ?? {};
  if (Object.keys(source).length === 0) {
    return {};
  }

  let display: Partial<Record<ArmorStatName, number>>;
  if (piece.tuningDeltas != null && piece.tuningDeltas.length > 0 && !branch) {
    display = { ...source };
  } else if (branch) {
    const deltas = tuningDeltasFromVariantMap(piece, branch);
    display = stripTuningFromTotals(branch, deltas);
  } else if (piece.tuningCommitted !== false && resolvePieceTuningDeltas(piece).length > 0) {
    display = stripTuningFromTotals(source, resolvePieceTuningDeltas(piece));
  } else {
    display = { ...source };
  }

  return expandTier5DisplayTotals(display, piece.tier);
}

export function sumArmorTuningOffset(
  deltasList: StatDelta[][],
): Partial<Record<ArmorStatName, number>> {
  const out: Partial<Record<ArmorStatName, number>> = {};
  for (const deltas of deltasList) {
    for (const { stat, value } of deltas) {
      out[stat] = (out[stat] ?? 0) + value;
    }
  }
  return out;
}

export function tuningDeltasForPieceBranch(
  piece: DerivedArmorPieceJson,
  branch?: Partial<Record<ArmorStatName, number>>,
): StatDelta[] {
  if (piece.tuningCommitted === false && branch) {
    return tuningDeltasFromVariantMap(piece, branch);
  }
  return resolvePieceTuningDeltas(piece);
}

/** Build display totals + stored tuning deltas at derive time. */
export function buildPieceDisplayAndTuning(
  statPlugs: StatDelta[],
  tuningDeltas: StatDelta[],
  tier: number | null,
): {
  statTotals: Partial<Record<ArmorStatName, number>>;
  tuningDeltas?: StatDelta[];
} {
  const display = expandTier5DisplayTotals(
    buildStatTotals(statPlugs),
    tier,
  );
  if (tuningDeltas.length === 0) {
    return { statTotals: display };
  }
  return { statTotals: display, tuningDeltas };
}

/** Legacy uncommitted variants: full maps → display maps (one per debuff branch). */
export function legacyTuningVariantDisplays(
  piece: DerivedArmorPieceJson,
): Partial<Record<ArmorStatName, number>>[] {
  if (!piece.tuningVariants?.length) {
    return [pieceDisplayStatTotals(piece)];
  }
  return piece.tuningVariants.map((variant) =>
    pieceDisplayStatTotals(piece, variant),
  );
}
