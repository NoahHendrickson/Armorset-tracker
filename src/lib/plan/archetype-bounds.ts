import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";
import {
  applyModBudgetToBounds,
  emptyBounds,
} from "@/lib/optimizer/bounds-independent";
import {
  DEFAULT_ASSUMED_STAT_MODS,
  type AssumedStatMods,
} from "@/lib/optimizer/mod-offset";
import type { StatBounds } from "@/lib/optimizer/types";
import type { ArchetypePair } from "@/lib/plan/archetype-pair";
import { pieceStatCeiling } from "@/lib/plan/synthetic-piece";
import { LOADOUT_PIECE_COUNT } from "@/lib/plan/constants";
import {
  defaultTuningNegative,
  defaultTuningPositive,
  isValidTuningPair,
} from "@/lib/plan/tuning";
import { addStatOffsets } from "@/lib/optimizer/fragment-offset";
import { allocatePlanMods } from "@/lib/plan/allocate-plan-mods";
import {
  coercePlanStatGoals,
  type PlanStatGoals,
} from "@/lib/plan/plan-stat-goals";
import { tertiaryStatsForArchetype } from "@/lib/views/progress";

export type PlanArchetypeRow = {
  id: string;
  name: string;
  pair: ArchetypePair;
  isCustom?: boolean;
};

export type PlanArchetypeSelection = {
  tertiary: ArmorStatName;
  tuningPositive: ArmorStatName;
  tuningNegative: ArmorStatName;
  pieceCount: number;
};

export function resolvePlanSelection(
  pair: ArchetypePair,
  selection: PlanArchetypeSelection | undefined,
): PlanArchetypeSelection {
  const tertiary =
    selection?.tertiary != null && isTertiaryValidForPair(pair, selection.tertiary)
      ? selection.tertiary
      : defaultTertiaryForPair(pair);
  const tuningPositive = selection?.tuningPositive ?? defaultTuningPositive(pair);
  let tuningNegative =
    selection?.tuningNegative ?? defaultTuningNegative(tuningPositive, tertiary);
  if (!isValidTuningPair(tuningPositive, tuningNegative)) {
    tuningNegative = defaultTuningNegative(tuningPositive, tertiary);
  }
  return {
    tertiary,
    tuningPositive,
    tuningNegative,
    pieceCount: selection?.pieceCount ?? 0,
  };
}

/** Per-piece total for one stat with fixed tertiary and tuning branch. */
export function pieceStatWithPlanSelection(
  pair: ArchetypePair,
  stat: ArmorStatName,
  selection: Pick<
    PlanArchetypeSelection,
    "tertiary" | "tuningPositive" | "tuningNegative"
  >,
): number {
  const resolved = resolvePlanSelection(pair, {
    ...selection,
    pieceCount: 0,
  });
  return pieceStatCeiling(
    pair,
    stat,
    resolved.tertiary,
    resolved.tuningPositive,
    resolved.tuningNegative,
  );
}

export function defaultTertiaryForPair(pair: ArchetypePair): ArmorStatName {
  const options = tertiaryStatsForArchetype(pair);
  return options[0] ?? "Health";
}

export function isTertiaryValidForPair(
  pair: ArchetypePair,
  tertiary: ArmorStatName,
): boolean {
  return tertiaryStatsForArchetype(pair).includes(tertiary);
}

export type SyntheticPieceConfig = {
  tertiary: ArmorStatName;
  tuningPositive: ArmorStatName;
  tuningNegative: ArmorStatName;
};

/** Best tertiary + tuning on one Tier-5 slot for a single stat. */
export function bestSyntheticPieceConfig(
  pair: ArchetypePair,
  stat: ArmorStatName,
): { value: number; config: SyntheticPieceConfig } {
  const tertiaries = tertiaryStatsForArchetype(pair);
  let bestValue = 0;
  let bestConfig: SyntheticPieceConfig = {
    tertiary: tertiaries[0] ?? "Health",
    tuningPositive: stat,
    tuningNegative: tertiaries[0] ?? "Health",
  };

  for (const tertiary of tertiaries) {
    for (const tuningPositive of ARMOR_STAT_NAMES) {
      for (const tuningNegative of ARMOR_STAT_NAMES) {
        if (tuningNegative === stat && tuningPositive !== stat) continue;
        const value = pieceStatCeiling(
          pair,
          stat,
          tertiary,
          tuningPositive,
          tuningNegative,
        );
        if (value > bestValue) {
          bestValue = value;
          bestConfig = { tertiary, tuningPositive, tuningNegative };
        }
      }
    }
  }

  return { value: bestValue, config: bestConfig };
}

export function maxStatOnSyntheticSlot(
  pair: ArchetypePair,
  stat: ArmorStatName,
): number {
  return bestSyntheticPieceConfig(pair, stat).value;
}

/** Best per-piece ceiling when tertiary is fixed (tuning still optimized per stat). */
export function maxStatOnSyntheticPieceWithTertiary(
  pair: ArchetypePair,
  stat: ArmorStatName,
  tertiary: ArmorStatName,
): number {
  if (!isTertiaryValidForPair(pair, tertiary)) {
    return 0;
  }
  let best = 0;
  for (const tuningPositive of ARMOR_STAT_NAMES) {
    for (const tuningNegative of ARMOR_STAT_NAMES) {
      if (tuningNegative === stat && tuningPositive !== stat) continue;
      best = Math.max(
        best,
        pieceStatCeiling(
          pair,
          stat,
          tertiary,
          tuningPositive,
          tuningNegative,
        ),
      );
    }
  }
  return best;
}

export function totalSelectedPieces(
  selections: Record<string, PlanArchetypeSelection>,
): number {
  return Object.values(selections).reduce(
    (sum, row) => sum + row.pieceCount,
    0,
  );
}

/** Intrinsic armor totals for a mixed plan (tertiary + tuning, no mods). */
export function mixedLoadoutArmorTotals(
  archetypes: readonly PlanArchetypeRow[],
  selections: Record<string, PlanArchetypeSelection>,
): Record<ArmorStatName, number> | null {
  if (totalSelectedPieces(selections) !== LOADOUT_PIECE_COUNT) {
    return null;
  }

  const totals = Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [stat, 0]),
  ) as Record<ArmorStatName, number>;

  for (const row of archetypes) {
    const sel = selections[row.id];
    if (!sel || sel.pieceCount <= 0) continue;
    const resolved = resolvePlanSelection(row.pair, sel);
    for (const stat of ARMOR_STAT_NAMES) {
      const perPiece = pieceStatWithPlanSelection(row.pair, stat, resolved);
      totals[stat] += perPiece * sel.pieceCount;
    }
  }
  return totals;
}

/**
 * Mixed loadout maximums: each archetype row contributes `pieceCount` Tier 5
 * pieces with fixed tertiary and tuning (+5 / −5); returns null until five
 * pieces are assigned.
 */
export function mixedLoadoutBounds(
  archetypes: readonly PlanArchetypeRow[],
  selections: Record<string, PlanArchetypeSelection>,
  options: MixedLoadoutBoundsOptions = {},
): StatBounds | null {
  const armorTotals = mixedLoadoutArmorTotals(archetypes, selections);
  if (armorTotals == null) {
    return null;
  }

  const includeMods = options.includeMods ?? true;
  const assumedMods = options.assumedMods ?? DEFAULT_ASSUMED_STAT_MODS;
  const statGoals = coercePlanStatGoals(options.statGoals);
  const fragmentOffset = options.fragmentStatOffset ?? {};
  const totalsWithFragments = addStatOffsets(
    armorTotals,
    fragmentOffset as Record<ArmorStatName, number>,
  );

  const bounds = emptyBounds();
  for (const stat of ARMOR_STAT_NAMES) {
    bounds[stat] = { min: 0, max: totalsWithFragments[stat] };
  }

  if (!includeMods) {
    return bounds;
  }

  if (options.useGoalDirectedMods !== false) {
    const { totals } = allocatePlanMods(
      totalsWithFragments,
      statGoals,
      assumedMods,
    );
    for (const stat of ARMOR_STAT_NAMES) {
      bounds[stat] = { min: 0, max: totals[stat] };
    }
    return bounds;
  }

  return applyModBudgetToBounds(bounds, assumedMods);
}

export type TheoreticalLoadoutBoundsOptions = {
  includeMods?: boolean;
  assumedMods?: AssumedStatMods;
};

export type MixedLoadoutBoundsOptions = TheoreticalLoadoutBoundsOptions & {
  /** Primary / secondary stat goals for mod allocation (defaults Weapons / Super). */
  statGoals?: Partial<PlanStatGoals> | null;
  /** Subclass fragment net offset applied before assumed mods. */
  fragmentStatOffset?: Partial<Record<ArmorStatName, number>>;
  /**
   * When false, adds the full mod pool to every stat (legacy upper bound).
   * Default true: mods go to primary (toward 200) then secondary.
   */
  useGoalDirectedMods?: boolean;
};

/** Independent per-slot maxima × 5 legendary pieces; optional assumed mod pool. */
export function theoreticalLoadoutBounds(
  pair: ArchetypePair,
  options: TheoreticalLoadoutBoundsOptions = {},
): StatBounds {
  const includeMods = options.includeMods ?? true;
  const assumedMods = options.assumedMods ?? DEFAULT_ASSUMED_STAT_MODS;

  const bounds = emptyBounds();
  for (const stat of ARMOR_STAT_NAMES) {
    const perSlot = maxStatOnSyntheticSlot(pair, stat);
    bounds[stat] = {
      min: 0,
      max: perSlot * LOADOUT_PIECE_COUNT,
    };
  }

  if (!includeMods) {
    return bounds;
  }
  return applyModBudgetToBounds(bounds, assumedMods);
}

export type ManifestArchetypeBoundsRow = {
  hash: string;
  name: string;
  pair: ArchetypePair;
  bounds: StatBounds;
};

export function computeBoundsForAllManifestArchetypes(
  archetypeStatPair: Record<string, ArchetypePair>,
  archetypeNameByHash: Record<string, string>,
  options: TheoreticalLoadoutBoundsOptions = {},
): ManifestArchetypeBoundsRow[] {
  const rows: ManifestArchetypeBoundsRow[] = [];
  for (const [hash, pair] of Object.entries(archetypeStatPair)) {
    rows.push({
      hash,
      name: archetypeNameByHash[hash] ?? `Archetype ${hash}`,
      pair,
      bounds: theoreticalLoadoutBounds(pair, options),
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** Per-piece intrinsic breakdown for UI (primary / secondary / best tertiary for stat). */
export function perPieceIntrinsicBreakdown(pair: ArchetypePair): {
  primary: { stat: ArmorStatName; value: number };
  secondary: { stat: ArmorStatName; value: number };
  tertiaryOptions: ArmorStatName[];
} {
  return {
    primary: { stat: pair.primary, value: 30 },
    secondary: { stat: pair.secondary, value: 25 },
    tertiaryOptions: tertiaryStatsForArchetype(pair),
  };
}
