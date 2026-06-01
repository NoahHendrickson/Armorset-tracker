import type { ArmorSlot } from "@/lib/bungie/constants";
import type { DerivedArmorPieceJson } from "@/lib/db/types";

export type SetBonusSelection = {
  setHash: number;
  requiredCount: number;
  perkHash: number;
};

export function countPiecesBySetHash(
  pieces: DerivedArmorPieceJson[],
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const piece of pieces) {
    if (piece.isExotic) continue;
    const setHash = piece.setHash;
    if (setHash == null) continue;
    counts.set(setHash, (counts.get(setHash) ?? 0) + 1);
  }
  return counts;
}

export function satisfiesSetBonuses(
  pieces: DerivedArmorPieceJson[],
  selections: SetBonusSelection[],
): boolean {
  if (selections.length === 0) return true;
  const counts = countPiecesBySetHash(pieces);
  return selections.every(
    (sel) => (counts.get(sel.setHash) ?? 0) >= sel.requiredCount,
  );
}

export function partialCanSatisfySetBonuses(
  chosen: DerivedArmorPieceJson[],
  remainingSlots: ArmorSlot[],
  slotCandidates: Map<ArmorSlot, DerivedArmorPieceJson[]>,
  selections: SetBonusSelection[],
): boolean {
  if (selections.length === 0) return true;
  const counts = countPiecesBySetHash(chosen);
  for (const sel of selections) {
    const have = counts.get(sel.setHash) ?? 0;
    const need = sel.requiredCount - have;
    if (need <= 0) continue;
    if (need > remainingSlots.length) return false;
    let availableSlots = 0;
    for (const slot of remainingSlots) {
      const candidates = slotCandidates.get(slot) ?? [];
      if (
        candidates.some(
          (p) => !p.isExotic && p.setHash === sel.setHash,
        )
      ) {
        availableSlots += 1;
      }
    }
    if (availableSlots < need) return false;
  }
  return true;
}

/** Warn when selected perks need more armor slots than a five-piece loadout allows. */
export function setBonusSelectionConflict(
  selections: SetBonusSelection[],
): string | null {
  if (selections.length === 0) return null;
  const fourPieceSets = selections.filter((s) => s.requiredCount >= 4);
  if (fourPieceSets.length > 1) {
    return "Only one 4-piece set bonus can fit in a five-piece loadout.";
  }
  const totalRequired = selections.reduce((sum, s) => sum + s.requiredCount, 0);
  if (totalRequired > 5) {
    return "Selected set bonuses need more than five armor pieces.";
  }
  return null;
}

export type SetPerkOption = {
  setHash: number;
  setName: string;
  requiredSetCount: number;
  perkHash: number;
  name: string;
  description: string;
  iconPath: string;
};

export function achievableSetPerks(
  pool: DerivedArmorPieceJson[],
  perks: SetPerkOption[],
): SetPerkOption[] {
  const counts = countPiecesBySetHash(pool);
  return perks.filter(
    (p) => (counts.get(p.setHash) ?? 0) >= p.requiredSetCount,
  );
}
