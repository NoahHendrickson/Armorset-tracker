import type { ArmorStatName, DerivedArmorPieceJson } from "@/lib/db/types";
import { pieceHasStatTotals } from "@/lib/inventory/compute-stat-totals";
import { exoticPieceIdentityKey } from "@/lib/optimizer/exotic-lock";

/** Client-safe manifest budgets for exotics missing cached `statTotals`. */
export type ExoticStatBudgetLookup = {
  byItemHash: Record<string, Partial<Record<ArmorStatName, number>>>;
  /** Slot + display name — covers reissued hashes with the same exotic identity. */
  byIdentity: Record<string, Partial<Record<ArmorStatName, number>>>;
};

export const EMPTY_EXOTIC_STAT_BUDGET: ExoticStatBudgetLookup = {
  byItemHash: {},
  byIdentity: {},
};

function rankedStatLabels(
  totals: Partial<Record<ArmorStatName, number>>,
): Pick<
  DerivedArmorPieceJson,
  "primaryStat" | "secondaryStat" | "tertiaryStat"
> {
  const ranked = (
    Object.entries(totals) as Array<[ArmorStatName, number]>
  )
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);
  return {
    primaryStat: ranked[0]?.[0] ?? null,
    secondaryStat: ranked[1]?.[0] ?? null,
    tertiaryStat: ranked[2]?.[0] ?? null,
  };
}

export function resolveExoticManifestBudget(
  piece: DerivedArmorPieceJson,
  lookup?: ExoticStatBudgetLookup | null,
): Partial<Record<ArmorStatName, number>> | null {
  if (!lookup || !piece.isExotic) return null;

  const byHash = lookup.byItemHash[String(piece.itemHash)];
  if (byHash != null && Object.keys(byHash).length > 0) return byHash;

  const byIdentity = lookup.byIdentity[exoticPieceIdentityKey(piece)];
  if (byIdentity != null && Object.keys(byIdentity).length > 0) {
    return byIdentity;
  }

  return null;
}

/**
 * Fill exotic `statTotals` from a manifest budget only when the piece has no
 * instance stats (optimizer + bounds fallback). Exotic armor rolls its stats
 * per-instance, so real ItemStats (304) / plug-walk totals are authoritative
 * and are returned untouched.
 */
export function enrichPieceWithExoticBudget(
  piece: DerivedArmorPieceJson,
  lookup?: ExoticStatBudgetLookup | null,
): DerivedArmorPieceJson {
  if (!piece.isExotic) return piece;
  if (pieceHasStatTotals(piece)) return piece;

  const budget = resolveExoticManifestBudget(piece, lookup);
  if (budget == null) return piece;
  return {
    ...piece,
    statTotals: budget,
    ...rankedStatLabels(budget),
  };
}

export function enrichPoolWithExoticBudgets(
  pool: DerivedArmorPieceJson[],
  lookup?: ExoticStatBudgetLookup | null,
): DerivedArmorPieceJson[] {
  if (lookup == null) return pool;
  return pool.map((piece) => enrichPieceWithExoticBudget(piece, lookup));
}
