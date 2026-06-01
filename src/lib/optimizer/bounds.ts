import { SLOT_ORDER } from "@/lib/bungie/constants";
import { ARMOR_STAT_NAMES } from "@/lib/db/types";
import {
  getPieceStatCeiling,
  getPieceStatValue,
} from "@/lib/inventory/compute-stat-totals";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import { addStatOffsets } from "@/lib/optimizer/fragment-offset";
import {
  DEFAULT_EXOTIC_LOCK,
  pieceMatchesLockedExotic,
  resolveLockedExoticIdentityKey,
  type ExoticLock,
} from "@/lib/optimizer/exotic-lock";
import type { StatBounds } from "@/lib/optimizer/types";

function emptyBounds(): StatBounds {
  return Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [stat, { min: 0, max: 0 }]),
  ) as StatBounds;
}

function groupPoolBySlot(pool: DerivedArmorPieceJson[]) {
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

/** Best stat in a slot; prefers legendaries, falls back to exotics when alone in slot. */
function slotStatExtremum(
  pieces: DerivedArmorPieceJson[],
  stat: (typeof ARMOR_STAT_NAMES)[number],
  mode: "min" | "max",
): number | null {
  const legendaries = pieces.filter((p) => !p.isExotic);
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
  stat: (typeof ARMOR_STAT_NAMES)[number],
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

/** Max achievable stat total respecting the one-exotic loadout rule. */
function maxTotalForStat(
  bySlot: Map<DerivedArmorPieceJson["slot"], DerivedArmorPieceJson[]>,
  stat: (typeof ARMOR_STAT_NAMES)[number],
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

/** Min achievable stat total under the exotic lock (conservative, all-legendary floor). */
function minTotalForStat(
  bySlot: Map<DerivedArmorPieceJson["slot"], DerivedArmorPieceJson[]>,
  stat: (typeof ARMOR_STAT_NAMES)[number],
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

/**
 * Achievable min/max per stat from a filtered pool. Respects exotic lock rules
 * (at most one exotic; locked piece fixed to its slot). Powers gray range bars.
 */
export function computeStatBounds(
  pool: DerivedArmorPieceJson[],
  statOffset?: Partial<Record<(typeof ARMOR_STAT_NAMES)[number], number>>,
  exoticLock: ExoticLock = DEFAULT_EXOTIC_LOCK,
): StatBounds {
  const bySlot = groupPoolBySlot(pool);

  for (const slot of SLOT_ORDER) {
    if ((bySlot.get(slot)?.length ?? 0) === 0) {
      return emptyBounds();
    }
  }

  const bounds = emptyBounds();
  for (const stat of ARMOR_STAT_NAMES) {
    const minTotal = minTotalForStat(bySlot, stat, exoticLock);
    const maxTotal = maxTotalForStat(bySlot, stat, exoticLock);
    if (minTotal == null || maxTotal == null) {
      return emptyBounds();
    }
    bounds[stat] = { min: minTotal, max: maxTotal };
  }

  if (!statOffset || Object.keys(statOffset).length === 0) {
    return bounds;
  }
  const zero = Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [stat, 0]),
  ) as Record<(typeof ARMOR_STAT_NAMES)[number], number>;
  const offset = addStatOffsets(
    zero,
    statOffset as Record<(typeof ARMOR_STAT_NAMES)[number], number>,
  );
  for (const stat of ARMOR_STAT_NAMES) {
    bounds[stat] = {
      min: bounds[stat].min + (offset[stat] ?? 0),
      max: bounds[stat].max + (offset[stat] ?? 0),
    };
  }
  return bounds;
}
