import type { ArmorStatName, DerivedArmorPieceJson } from "@/lib/db/types";
import { ARMOR_STAT_NAMES } from "@/lib/db/types";
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

/** Lower inflated non-Weapons stats to manifest socket budget (D2AP piece rows). */
export function clampExoticStatTotalsToBudget(
  totals: Partial<Record<ArmorStatName, number>>,
  budget: Partial<Record<ArmorStatName, number>>,
): Partial<Record<ArmorStatName, number>> {
  const out = { ...totals };
  for (const stat of ARMOR_STAT_NAMES) {
    if (stat === "Weapons") continue;
    const cap = budget[stat];
    const current = out[stat];
    if (cap === undefined || current === undefined) continue;
    if (current > cap) {
      out[stat] = cap;
    }
  }
  return out;
}

/**
 * Bungie ItemStats sometimes reports Grenade 12 on exotics whose D2AP piece row
 * shows 4 (tertiary matches Class/Melee). Pull inflated values back to peers.
 */
export function capInflatedExoticGrenade(
  totals: Partial<Record<ArmorStatName, number>>,
): Partial<Record<ArmorStatName, number>> {
  const grenade = totals.Grenade;
  if (grenade === undefined) {
    return totals;
  }
  const peer = Math.max(totals.Class ?? 0, totals.Melee ?? 0);
  if (
    peer > 0 &&
    grenade > peer &&
    grenade >= 10 &&
    grenade <= peer + 8
  ) {
    return { ...totals, Grenade: peer };
  }
  return totals;
}

function normalizeExoticStatTotals(
  totals: Partial<Record<ArmorStatName, number>>,
  budget: Partial<Record<ArmorStatName, number>> | null,
): Partial<Record<ArmorStatName, number>> {
  let next = budget ? clampExoticStatTotalsToBudget(totals, budget) : totals;
  next = capInflatedExoticGrenade(next);
  return next;
}

/** Fill missing exotic `statTotals` from manifest budgets (optimizer + bounds). */
export function enrichPieceWithExoticBudget(
  piece: DerivedArmorPieceJson,
  lookup?: ExoticStatBudgetLookup | null,
): DerivedArmorPieceJson {
  if (!piece.isExotic) return piece;

  const budget = resolveExoticManifestBudget(piece, lookup);

  if (!pieceHasStatTotals(piece)) {
    if (budget == null) return piece;
    const totals = normalizeExoticStatTotals(budget, budget);
    return {
      ...piece,
      statTotals: totals,
      ...rankedStatLabels(totals),
    };
  }

  const clamped = normalizeExoticStatTotals(piece.statTotals ?? {}, budget);
  const unchanged =
    JSON.stringify(clamped) === JSON.stringify(piece.statTotals ?? {});
  if (unchanged) {
    return piece;
  }

  return {
    ...piece,
    statTotals: clamped,
    ...rankedStatLabels(clamped),
  };
}

export function enrichPoolWithExoticBudgets(
  pool: DerivedArmorPieceJson[],
  lookup?: ExoticStatBudgetLookup | null,
): DerivedArmorPieceJson[] {
  if (lookup == null) return pool;
  return pool.map((piece) => enrichPieceWithExoticBudget(piece, lookup));
}
