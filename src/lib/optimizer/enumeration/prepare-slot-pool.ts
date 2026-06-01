import { SLOT_ORDER } from "@/lib/bungie/constants";
import type { ArmorStatName, DerivedArmorPieceJson } from "@/lib/db/types";
import { dedupeSlotPieces } from "@/lib/optimizer/dedupe";
import {
  applyExoticLockToSlotGroups,
  resolveLockedExoticIdentityKey,
  type ExoticLock,
} from "@/lib/optimizer/exotic-lock";
import { groupPoolBySlot, perSlotMaxima } from "@/lib/optimizer/enumeration/pool-by-slot";

export type PrepareDedupedSlotPoolOptions = {
  pool: DerivedArmorPieceJson[];
  exoticLock: ExoticLock;
  pinnedInstanceIds?: ReadonlySet<string>;
  excludedInstanceIds?: ReadonlySet<string>;
};

export type PreparedDedupedSlotPool = {
  bySlot: Map<DerivedArmorPieceJson["slot"], DerivedArmorPieceJson[]>;
  slotPieces: DerivedArmorPieceJson[][];
  perSlotMax: Record<ArmorStatName, number>;
  lockedIdentityKey: string | null;
  membersByInstanceId: Map<string, string[]>;
};

/**
 * Groups pool by slot, applies exotic lock, optional pin/exclude filters, and
 * dedupes interchangeable pieces per slot — same shaping as search / combo count.
 */
export function prepareDedupedSlotPool(
  options: PrepareDedupedSlotPoolOptions,
): PreparedDedupedSlotPool | null {
  const { pool, exoticLock, pinnedInstanceIds, excludedInstanceIds } = options;
  const bySlot = groupPoolBySlot(pool);
  const lockedIdentityKey = resolveLockedExoticIdentityKey(exoticLock, pool);
  applyExoticLockToSlotGroups(bySlot, exoticLock, pool);

  for (const slot of SLOT_ORDER) {
    if ((bySlot.get(slot)?.length ?? 0) === 0) {
      return null;
    }
    if (excludedInstanceIds && excludedInstanceIds.size > 0) {
      bySlot.set(
        slot,
        (bySlot.get(slot) ?? []).filter(
          (piece) => !excludedInstanceIds.has(piece.itemInstanceId),
        ),
      );
    }
    if (pinnedInstanceIds && pinnedInstanceIds.size > 0) {
      const pinnedForSlot = (bySlot.get(slot) ?? []).filter((piece) =>
        pinnedInstanceIds.has(piece.itemInstanceId),
      );
      if (pinnedForSlot.length > 1) {
        return null;
      }
      if (pinnedForSlot.length === 1) {
        bySlot.set(slot, pinnedForSlot);
      }
    }
    if ((bySlot.get(slot)?.length ?? 0) === 0) {
      return null;
    }
  }

  const membersByInstanceId = new Map<string, string[]>();
  for (const slot of SLOT_ORDER) {
    const { representatives, membersByRepresentative } = dedupeSlotPieces(
      bySlot.get(slot) ?? [],
    );
    bySlot.set(slot, representatives);
    for (const [repId, members] of membersByRepresentative) {
      membersByInstanceId.set(repId, members);
    }
  }

  return {
    bySlot,
    slotPieces: SLOT_ORDER.map((slot) => bySlot.get(slot) ?? []),
    perSlotMax: perSlotMaxima(bySlot),
    lockedIdentityKey,
    membersByInstanceId,
  };
}
