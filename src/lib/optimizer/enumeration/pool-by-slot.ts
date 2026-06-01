import { SLOT_ORDER } from "@/lib/bungie/constants";
import { ARMOR_STAT_NAMES, type ArmorStatName, type DerivedArmorPieceJson } from "@/lib/db/types";
import { getPieceStatCeiling } from "@/lib/inventory/compute-stat-totals";

export function groupPoolBySlot(pool: DerivedArmorPieceJson[]) {
  const bySlot = new Map<
    DerivedArmorPieceJson["slot"],
    DerivedArmorPieceJson[]
  >();
  for (const slot of SLOT_ORDER) {
    bySlot.set(slot, []);
  }
  for (const piece of pool) {
    bySlot.get(piece.slot)?.push(piece);
  }
  return bySlot;
}

export function perSlotMaxima(
  bySlot: Map<DerivedArmorPieceJson["slot"], DerivedArmorPieceJson[]>,
): Record<ArmorStatName, number> {
  const maxima = Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [stat, 0]),
  ) as Record<ArmorStatName, number>;
  for (const slot of SLOT_ORDER) {
    for (const piece of bySlot.get(slot) ?? []) {
      for (const stat of ARMOR_STAT_NAMES) {
        maxima[stat] = Math.max(maxima[stat], getPieceStatCeiling(piece, stat));
      }
    }
  }
  return maxima;
}
