import { ARMOR_STAT_NAMES, type DerivedArmorPieceJson } from "@/lib/db/types";
import { getPieceStatValue } from "@/lib/inventory/compute-stat-totals";

/**
 * Two pieces in the same slot are interchangeable for the search when they have
 * identical stat contributions, the same set membership (set-bonus counting),
 * and the same exotic-ness. Collapsing these before enumeration is the single
 * biggest lever on large-vault search time — a slot with 40 pieces often has
 * only a handful of distinct stat rolls.
 */
export function pieceDuplicateKey(piece: DerivedArmorPieceJson): string {
  const stats = ARMOR_STAT_NAMES.map((stat) =>
    getPieceStatValue(piece, stat),
  ).join(",");
  return `${piece.isExotic ? "E" : "L"}|${piece.setHash ?? "none"}|${stats}`;
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
