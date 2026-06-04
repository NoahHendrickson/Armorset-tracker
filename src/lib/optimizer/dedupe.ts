import { ARMOR_STAT_NAMES, type DerivedArmorPieceJson } from "@/lib/db/types";
import { getPieceStatValue } from "@/lib/inventory/compute-stat-totals";
import { resolvePieceTuningDeltas } from "@/lib/inventory/armor-tuning-stats";

function tuningDuplicateKey(piece: DerivedArmorPieceJson): string {
  const deltas =
    piece.tuningDeltas != null && piece.tuningDeltas.length > 0
      ? piece.tuningDeltas
      : resolvePieceTuningDeltas(piece);
  if (deltas.length === 0) {
    return piece.tuningCommitted === false ? "uncommitted" : "none";
  }
  return deltas.map((d) => `${d.stat}:${d.value}`).join(";");
}

/**
 * Two pieces in the same slot are interchangeable for the search when they have
 * identical display stats, the same tuning row, set membership, and exotic-ness.
 * Display-only dedupe was collapsing +Weapons vs +Grenade Ferropotent arms with
 * the same intrinsic roll — verify then picked the wrong tuning branch.
 */
export function pieceDuplicateKey(piece: DerivedArmorPieceJson): string {
  const stats = ARMOR_STAT_NAMES.map((stat) =>
    getPieceStatValue(piece, stat),
  ).join(",");
  return `${piece.isExotic ? "E" : "L"}|${piece.setHash ?? "none"}|${stats}|${tuningDuplicateKey(piece)}`;
}

export interface DedupedSlotPieces {
  representatives: DerivedArmorPieceJson[];
  /** Representative itemInstanceId -> every interchangeable instance id. */
  membersByRepresentative: Map<string, string[]>;
}

export function dedupeSlotPieces(
  pieces: DerivedArmorPieceJson[],
): DedupedSlotPieces {
  const byKey = new Map<string, DerivedArmorPieceJson[]>();
  const order: string[] = [];
  for (const piece of pieces) {
    const key = pieceDuplicateKey(piece);
    const existing = byKey.get(key);
    if (existing) {
      existing.push(piece);
    } else {
      byKey.set(key, [piece]);
      order.push(key);
    }
  }

  const representatives: DerivedArmorPieceJson[] = [];
  const membersByRepresentative = new Map<string, string[]>();
  for (const key of order) {
    const group = byKey.get(key)!;
    const representative = group[0]!;
    representatives.push(representative);
    membersByRepresentative.set(
      representative.itemInstanceId,
      group.map((p) => p.itemInstanceId),
    );
  }
  return { representatives, membersByRepresentative };
}
