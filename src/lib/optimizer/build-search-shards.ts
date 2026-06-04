import type { DerivedArmorPieceJson } from "@/lib/db/types";
import {
  SEARCH_SHARD_MIN_COMBO,
  SEARCH_SHARD_MIN_SLOT_PIECES,
} from "@/lib/optimizer/constants";
import { estimateOptimizerComboCount } from "@/lib/optimizer/combo-count";
import { prepareDedupedSlotPool } from "@/lib/optimizer/enumeration/prepare-slot-pool";
import {
  DEFAULT_EXOTIC_LOCK,
  type ExoticLock,
} from "@/lib/optimizer/exotic-lock";
import type { OptimizerSearchShard } from "@/lib/optimizer/types";

export function buildSearchShards(
  pool: DerivedArmorPieceJson[],
  exoticLock: ExoticLock = DEFAULT_EXOTIC_LOCK,
): OptimizerSearchShard[] {
  const comboCount = estimateOptimizerComboCount(pool, exoticLock);
  if (comboCount < SEARCH_SHARD_MIN_COMBO) {
    return [];
  }

  const prepared = prepareDedupedSlotPool({ pool, exoticLock });
  if (prepared == null) {
    return [];
  }

  let longestIndex = 0;
  let longestCount = prepared.slotPieces[0]?.length ?? 0;
  for (let i = 1; i < prepared.slotPieces.length; i++) {
    const count = prepared.slotPieces[i]?.length ?? 0;
    if (count > longestCount) {
      longestCount = count;
      longestIndex = i;
    }
  }

  if (longestCount < SEARCH_SHARD_MIN_SLOT_PIECES) {
    return [];
  }

  const reportedCores =
    typeof navigator !== "undefined"
      ? navigator.hardwareConcurrency ?? 2
      : 4;
  const cores = Math.max(2, Math.min(reportedCores, 8));
  const shardCount = Math.min(cores, longestCount);
  const baseSize = Math.floor(longestCount / shardCount);
  const remainder = longestCount % shardCount;

  const shards: OptimizerSearchShard[] = [];
  let start = 0;
  for (let i = 0; i < shardCount; i++) {
    const size = baseSize + (i < remainder ? 1 : 0);
    const end = start + size;
    if (size > 0) {
      shards.push({
        slotIndex: longestIndex,
        pieceStart: start,
        pieceEnd: end,
      });
    }
    start = end;
  }

  return shards.length > 1 ? shards : [];
}
