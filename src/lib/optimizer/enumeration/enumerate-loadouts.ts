import { SLOT_ORDER } from "@/lib/bungie/constants";
import { ARMOR_STAT_NAMES, type DerivedArmorPieceJson } from "@/lib/db/types";
import { getPieceStatCeiling } from "@/lib/inventory/compute-stat-totals";
import type { PreparedDedupedSlotPool } from "@/lib/optimizer/enumeration/prepare-slot-pool";
import type { OptimizerSearchShard } from "@/lib/optimizer/types";
import { partialCanReachMins } from "@/lib/optimizer/constraints";
import type { StatConstraintRow } from "@/lib/optimizer/types";
import {
  countExoticsInPieces,
  exoticAllowedInPartialCombo,
  type ExoticLock,
} from "@/lib/optimizer/exotic-lock";
import type { AssumedStatMods } from "@/lib/optimizer/mod-offset";
import {
  partialCanSatisfySetBonuses,
  type SetBonusSelection,
} from "@/lib/optimizer/set-bonus";

export type EnumeratePruningContext = {
  slotIndex: number;
  chosen: DerivedArmorPieceJson[];
  piece: DerivedArmorPieceJson;
  nextTotals: Record<(typeof ARMOR_STAT_NAMES)[number], number>;
  /** Slots remaining after picking this piece (excluding current slot). */
  remainingSlots: (typeof SLOT_ORDER)[number][];
};

export type EnumerateLeafResult = "accept" | "reject" | "accept-and-stop";

export type EnumerateLoadoutsOptions = {
  prepared: PreparedDedupedSlotPool;
  exoticLock: ExoticLock;
  startTotals: Record<(typeof ARMOR_STAT_NAMES)[number], number>;
  constraints: StatConstraintRow[];
  assumedMods: AssumedStatMods;
  setBonusSelections: SetBonusSelection[];
  /** Stop after this many accepted leaf visits. */
  cap?: number;
  isCancelled?: () => boolean;
  /** Called every 5000 internal visits (for progress reporting). */
  onVisitBatch?: (visited: number, totalCombos: number) => void;
  /** Override default stat/set-bonus pruning. */
  canExtend?: (ctx: EnumeratePruningContext) => boolean;
  /** When set, only iterate `pieceStart`..`pieceEnd` on `slotIndex` (parallel search shards). */
  shard?: OptimizerSearchShard;
  onLeaf: (chosen: DerivedArmorPieceJson[]) => EnumerateLeafResult;
};

export type EnumerateLoadoutsResult = {
  leafCount: number;
  capped: boolean;
  visited: number;
};

function defaultCanExtend(
  ctx: EnumeratePruningContext,
  prepared: PreparedDedupedSlotPool,
  constraints: StatConstraintRow[],
  assumedMods: AssumedStatMods,
  setBonusSelections: SetBonusSelection[],
): boolean {
  const remainingAfterPick = ctx.remainingSlots.length;
  if (
    !partialCanReachMins(
      ctx.nextTotals,
      remainingAfterPick,
      prepared.perSlotMax,
      constraints,
      assumedMods,
    )
  ) {
    return false;
  }
  return partialCanSatisfySetBonuses(
    [...ctx.chosen, ctx.piece],
    ctx.remainingSlots,
    prepared.bySlot,
    setBonusSelections,
  );
}

/**
 * Depth-first enumeration of five-piece loadouts from a prepared deduped pool.
 * Shared by search and filtered combo counting.
 */
export function enumerateLoadouts(
  options: EnumerateLoadoutsOptions,
): EnumerateLoadoutsResult {
  const {
    prepared,
    exoticLock,
    startTotals,
    constraints,
    assumedMods,
    setBonusSelections,
    cap,
    isCancelled,
    onVisitBatch,
    canExtend,
    shard,
    onLeaf,
  } = options;

  const { slotPieces, lockedIdentityKey } = prepared;
  const totalCombos =
    slotPieces[0]!.length *
    slotPieces[1]!.length *
    slotPieces[2]!.length *
    slotPieces[3]!.length *
    slotPieces[4]!.length;

  let leafCount = 0;
  let capped = false;
  let visited = 0;

  const visit = (
    slotIndex: number,
    chosen: DerivedArmorPieceJson[],
    partialTotals: Record<(typeof ARMOR_STAT_NAMES)[number], number>,
  ): void => {
    if (capped || isCancelled?.()) {
      return;
    }

    if (slotIndex >= SLOT_ORDER.length) {
      if (exoticLock.mode === "any" && countExoticsInPieces(chosen) > 1) {
        return;
      }
      const leafResult = onLeaf(chosen);
      if (leafResult === "reject") {
        return;
      }
      leafCount += 1;
      if (cap != null && leafCount >= cap) {
        capped = true;
      }
      if (leafResult === "accept-and-stop") {
        capped = true;
      }
      return;
    }

    const remainingSlots = SLOT_ORDER.slice(slotIndex + 1);
    const slotList = slotPieces[slotIndex] ?? [];
    const pieces =
      shard != null && shard.slotIndex === slotIndex
        ? slotList.slice(shard.pieceStart, shard.pieceEnd)
        : slotList;
    for (const piece of pieces) {
      if (
        !exoticAllowedInPartialCombo(
          piece,
          chosen,
          exoticLock,
          lockedIdentityKey,
        )
      ) {
        continue;
      }
      visited += 1;
      if (visited % 5000 === 0) {
        onVisitBatch?.(visited, totalCombos);
      }
      const nextTotals = { ...partialTotals };
      for (const stat of ARMOR_STAT_NAMES) {
        nextTotals[stat] += getPieceStatCeiling(piece, stat);
      }
      const pruneCtx: EnumeratePruningContext = {
        slotIndex,
        chosen,
        piece,
        nextTotals,
        remainingSlots,
      };
      const extend =
        canExtend?.(pruneCtx) ??
        defaultCanExtend(
          pruneCtx,
          prepared,
          constraints,
          assumedMods,
          setBonusSelections,
        );
      if (!extend) {
        continue;
      }
      visit(slotIndex + 1, [...chosen, piece], nextTotals);
      if (capped || isCancelled?.()) {
        return;
      }
    }
  };

  visit(0, [], { ...startTotals });
  return { leafCount, capped, visited };
}
