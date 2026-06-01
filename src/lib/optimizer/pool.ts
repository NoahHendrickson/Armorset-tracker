import { SLOT_ORDER } from "@/lib/bungie/constants";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import {
  isTier5Piece,
  pieceHasStatTotals,
} from "@/lib/inventory/compute-stat-totals";
import {
  enrichPieceWithExoticBudget,
  enrichPoolWithExoticBudgets,
  type ExoticStatBudgetLookup,
} from "@/lib/inventory/exotic-stat-fallback";
import {
  applyExoticLockToPool,
  DEFAULT_EXOTIC_LOCK,
  mergeLockedExoticCopiesIntoPool,
  type ExoticLock,
} from "@/lib/optimizer/exotic-lock";

export function poolCoversAllSlots(pool: DerivedArmorPieceJson[]): boolean {
  const slots = new Set(pool.map((piece) => piece.slot));
  return SLOT_ORDER.every((slot) => slots.has(slot));
}

/** All armor for a class that the optimizer is allowed to consider as candidates. */
export function optimizerEligiblePieces(
  inventory: DerivedArmorPieceJson[],
  classType: number,
): DerivedArmorPieceJson[] {
  // Optimizer searches Tier-5 legendaries for the chosen class. Exotics aren't
  // tier-gated and are only ever included via an explicit exotic lock below.
  return inventory.filter(
    (p) =>
      p.classType === classType &&
      pieceHasStatTotals(p) &&
      (p.isExotic || isTier5Piece(p)),
  );
}

export function filterOptimizerPool(
  inventory: DerivedArmorPieceJson[],
  classType: number,
  options: {
    pinnedInstanceIds?: string[];
    excludedInstanceIds?: string[];
    exoticLock?: ExoticLock;
    exoticStatBudget?: ExoticStatBudgetLookup;
  } = {},
): DerivedArmorPieceJson[] {
  const lock = options.exoticLock ?? DEFAULT_EXOTIC_LOCK;
  const budget = options.exoticStatBudget;
  const enrichedInventory = budget
    ? inventory.map((piece) => enrichPieceWithExoticBudget(piece, budget))
    : inventory;
  let pool = optimizerEligiblePieces(enrichedInventory, classType);
  pool = mergeLockedExoticCopiesIntoPool(
    pool,
    enrichedInventory,
    classType,
    lock,
  );
  pool = enrichPoolWithExoticBudgets(pool, budget);
  pool = applyExoticLockToPool(pool, lock, enrichedInventory);
  const excluded = new Set(options.excludedInstanceIds ?? []);
  if (excluded.size > 0) {
    pool = pool.filter((p) => !excluded.has(p.itemInstanceId));
  }
  const pinned = new Set(options.pinnedInstanceIds ?? []);
  if (pinned.size > 0) {
    const pinnedPieces = pool.filter((p) => pinned.has(p.itemInstanceId));
    pool = [...pinnedPieces, ...pool.filter((p) => !pinned.has(p.itemInstanceId))];
  }
  return pool;
}
