import { SLOT_ORDER } from "@/lib/bungie/constants";
import { ARMOR_STAT_NAMES, type ArmorStatName, type DerivedArmorPieceJson } from "@/lib/db/types";
import {
  getPieceStatCeiling,
  getPieceStatValue,
} from "@/lib/inventory/compute-stat-totals";
import { addStatOffsets } from "@/lib/optimizer/fragment-offset";
import {
  pieceMatchesLockedExotic,
  resolveLockedExoticIdentityKey,
  type ExoticLock,
} from "@/lib/optimizer/exotic-lock";
import {
  DEFAULT_ASSUMED_STAT_MODS,
  totalAssumedModBudget,
  type AssumedStatMods,
} from "@/lib/optimizer/mod-offset";
import type { StatBounds } from "@/lib/optimizer/types";

export function emptyBounds(): StatBounds {
  return Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [stat, { min: 0, max: 0 }]),
  ) as StatBounds;
}

/** Best stat in a slot; prefers legendaries, falls back to exotics when alone in slot. */
function slotStatExtremum(
  pieces: DerivedArmorPieceJson[],
  stat: ArmorStatName,
  mode: "min" | "max",
): number | null {
  const legendaries = pieces.filter((piece) => !piece.isExotic);
  const candidates = legendaries.length > 0 ? legendaries : pieces;
  let result = mode === "min" ? Infinity : -Infinity;
  for (const piece of candidates) {
    const value =
      mode === "min"
        ? getPieceStatValue(piece, stat)
        : getPieceStatCeiling(piece, stat);
    result = mode === "min" ? Math.min(result, value) : Math.max(result, value);
  }
  return Number.isFinite(result) ? result : null;
}

function sumSlotExtrema(
  bySlot: Map<DerivedArmorPieceJson["slot"], DerivedArmorPieceJson[]>,
  stat: ArmorStatName,
  mode: "min" | "max",
): number | null {
  let total = 0;
  for (const slot of SLOT_ORDER) {
    const value = slotStatExtremum(bySlot.get(slot) ?? [], stat, mode);
    if (value == null) return null;
    total += value;
  }
  return total;
}

function maxTotalForStat(
  bySlot: Map<DerivedArmorPieceJson["slot"], DerivedArmorPieceJson[]>,
  stat: ArmorStatName,
  exoticLock: ExoticLock,
): number | null {
  if (exoticLock.mode === "none") {
    return sumSlotExtrema(bySlot, stat, "max");
  }

  if (exoticLock.mode === "locked") {
    const flat = [...bySlot.values()].flat();
    const identityKey = resolveLockedExoticIdentityKey(exoticLock, flat);
    const lockedPieces = (bySlot.get(exoticLock.slot) ?? []).filter((piece) =>
      identityKey
        ? pieceMatchesLockedExotic(piece, exoticLock, identityKey)
        : piece.itemInstanceId === exoticLock.itemInstanceId,
    );
    if (lockedPieces.length === 0) return null;

    let total = Math.max(
      ...lockedPieces.map((piece) => getPieceStatCeiling(piece, stat)),
    );
    for (const slot of SLOT_ORDER) {
      if (slot === exoticLock.slot) continue;
      const slotMax = slotStatExtremum(bySlot.get(slot) ?? [], stat, "max");
      if (slotMax == null) return null;
      total += slotMax;
    }
    return total;
  }

  let best = sumSlotExtrema(bySlot, stat, "max");
  if (best == null) return null;

  for (const slot of SLOT_ORDER) {
    for (const piece of bySlot.get(slot) ?? []) {
      if (!piece.isExotic) continue;
      let total = getPieceStatCeiling(piece, stat);
      for (const otherSlot of SLOT_ORDER) {
        if (otherSlot === slot) continue;
        const slotMax = slotStatExtremum(bySlot.get(otherSlot) ?? [], stat, "max");
        if (slotMax == null) return null;
        total += slotMax;
      }
      best = Math.max(best, total);
    }
  }
  return best;
}

function minTotalForStat(
  bySlot: Map<DerivedArmorPieceJson["slot"], DerivedArmorPieceJson[]>,
  stat: ArmorStatName,
  exoticLock: ExoticLock,
): number | null {
  if (exoticLock.mode === "locked") {
    const flat = [...bySlot.values()].flat();
    const identityKey = resolveLockedExoticIdentityKey(exoticLock, flat);
    const lockedPieces = (bySlot.get(exoticLock.slot) ?? []).filter((piece) =>
      identityKey
        ? pieceMatchesLockedExotic(piece, exoticLock, identityKey)
        : piece.itemInstanceId === exoticLock.itemInstanceId,
    );
    if (lockedPieces.length === 0) return null;

    let total = Math.min(
      ...lockedPieces.map((piece) => getPieceStatValue(piece, stat)),
    );
    for (const slot of SLOT_ORDER) {
      if (slot === exoticLock.slot) continue;
      const slotMin = slotStatExtremum(bySlot.get(slot) ?? [], stat, "min");
      if (slotMin == null) return null;
      total += slotMin;
    }
    return total;
  }

  return sumSlotExtrema(bySlot, stat, "min");
}

export function applyFragmentOffsetToBounds(
  bounds: StatBounds,
  statOffset?: Partial<Record<ArmorStatName, number>>,
): StatBounds {
  if (!statOffset || Object.keys(statOffset).length === 0) {
    return bounds;
  }
  const zero = Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [stat, 0]),
  ) as Record<ArmorStatName, number>;
  const offset = addStatOffsets(
    zero,
    statOffset as Record<ArmorStatName, number>,
  );
  for (const stat of ARMOR_STAT_NAMES) {
    bounds[stat] = {
      min: bounds[stat].min + (offset[stat] ?? 0),
      max: bounds[stat].max + (offset[stat] ?? 0),
    };
  }
  return bounds;
}

/** Adds the shared mod pool to each stat's max (mods can stack on one stat). */
export function applyModBudgetToBounds(
  bounds: StatBounds,
  assumedMods: AssumedStatMods = DEFAULT_ASSUMED_STAT_MODS,
): StatBounds {
  const modTotal = totalAssumedModBudget(assumedMods).total;
  if (modTotal === 0) {
    return bounds;
  }
  for (const stat of ARMOR_STAT_NAMES) {
    bounds[stat] = {
      min: bounds[stat].min,
      max: bounds[stat].max + modTotal,
    };
  }
  return bounds;
}

export function independentStatBounds(
  bySlot: Map<DerivedArmorPieceJson["slot"], DerivedArmorPieceJson[]>,
  exoticLock: ExoticLock,
): StatBounds | null {
  const bounds = emptyBounds();
  for (const stat of ARMOR_STAT_NAMES) {
    const minTotal = minTotalForStat(bySlot, stat, exoticLock);
    const maxTotal = maxTotalForStat(bySlot, stat, exoticLock);
    if (minTotal == null || maxTotal == null) {
      return null;
    }
    bounds[stat] = { min: minTotal, max: maxTotal };
  }
  return bounds;
}
