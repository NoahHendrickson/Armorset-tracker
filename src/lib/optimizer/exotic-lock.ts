import type { ArmorSlot } from "@/lib/bungie/constants";
import { SLOT_ORDER } from "@/lib/bungie/constants";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import {
  isTier5Piece,
} from "@/lib/inventory/compute-stat-totals";

/** How the optimizer treats the single allowed exotic armor slot. */
export type ExoticLock =
  | { mode: "none" }
  | { mode: "any" }
  | { mode: "locked"; itemInstanceId: string; slot: ArmorSlot };

export const DEFAULT_EXOTIC_LOCK: ExoticLock = { mode: "none" };

export function countExoticsInPieces(pieces: DerivedArmorPieceJson[]): number {
  return pieces.filter((p) => p.isExotic).length;
}

function mergeLookupPieces(
  pool: DerivedArmorPieceJson[],
  inventory?: DerivedArmorPieceJson[],
): DerivedArmorPieceJson[] {
  if (!inventory?.length) return pool;
  const seen = new Set<string>();
  const out: DerivedArmorPieceJson[] = [];
  for (const piece of [...pool, ...inventory]) {
    if (seen.has(piece.itemInstanceId)) continue;
    seen.add(piece.itemInstanceId);
    out.push(piece);
  }
  return out;
}

export function resolveLockedExoticIdentityKey(
  lock: ExoticLock,
  lookupPieces: DerivedArmorPieceJson[],
): string | null {
  if (lock.mode !== "locked") return null;
  const locked = lookupPieces.find(
    (p) => p.itemInstanceId === lock.itemInstanceId,
  );
  return locked ? exoticPieceIdentityKey(locked) : null;
}

export function pieceMatchesLockedExotic(
  piece: DerivedArmorPieceJson,
  lock: ExoticLock,
  identityKey: string | null,
): boolean {
  if (lock.mode !== "locked" || identityKey == null) return false;
  return (
    piece.isExotic === true &&
    piece.slot === lock.slot &&
    exoticPieceIdentityKey(piece) === identityKey
  );
}

/** Ensure every eligible copy of a locked exotic is in the pool (best rolls). */
export function mergeLockedExoticCopiesIntoPool(
  pool: DerivedArmorPieceJson[],
  inventory: DerivedArmorPieceJson[],
  classType: number,
  lock: ExoticLock,
): DerivedArmorPieceJson[] {
  if (lock.mode !== "locked") return pool;
  const identityKey = resolveLockedExoticIdentityKey(
    lock,
    mergeLookupPieces(pool, inventory),
  );
  if (!identityKey) return pool;
  const byId = new Map(pool.map((p) => [p.itemInstanceId, p]));
  for (const piece of inventory) {
    if (piece.classType !== classType) continue;
    if (!pieceMatchesLockedExotic(piece, lock, identityKey)) continue;
    if (!piece.isExotic && !isTier5Piece(piece)) continue;
    if (!byId.has(piece.itemInstanceId)) {
      byId.set(piece.itemInstanceId, piece);
    }
  }
  return [...byId.values()];
}

/** Restrict pool pieces so search cannot pick invalid exotic combinations. */
export function applyExoticLockToPool(
  pool: DerivedArmorPieceJson[],
  lock: ExoticLock,
  inventory?: DerivedArmorPieceJson[],
): DerivedArmorPieceJson[] {
  if (lock.mode === "none") {
    return pool.filter((p) => !p.isExotic);
  }
  if (lock.mode === "any") {
    return pool;
  }
  const identityKey = resolveLockedExoticIdentityKey(
    lock,
    mergeLookupPieces(pool, inventory),
  );
  if (!identityKey) {
    return pool.filter((p) => !p.isExotic);
  }
  return pool.filter(
    (p) =>
      !p.isExotic ||
      (p.slot === lock.slot && exoticPieceIdentityKey(p) === identityKey),
  );
}

export function exoticAllowedInPartialCombo(
  piece: DerivedArmorPieceJson,
  chosen: DerivedArmorPieceJson[],
  lock: ExoticLock,
  lockedIdentityKey?: string | null,
): boolean {
  if (!piece.isExotic) return true;
  if (lock.mode === "none") return false;
  const exoticCount = countExoticsInPieces(chosen);
  if (lock.mode === "locked") {
    if (piece.slot !== lock.slot) return false;
    const key =
      lockedIdentityKey ??
      resolveLockedExoticIdentityKey(lock, chosen.length > 0 ? chosen : [piece]);
    if (!pieceMatchesLockedExotic(piece, lock, key)) return false;
    return exoticCount === 0;
  }
  return exoticCount === 0;
}

/** Pin locked exotic to its slot; strip exotics from other slots when mode is locked. */
export function applyExoticLockToSlotGroups(
  bySlot: Map<DerivedArmorPieceJson["slot"], DerivedArmorPieceJson[]>,
  lock: ExoticLock,
  lookupPieces?: DerivedArmorPieceJson[],
): void {
  if (lock.mode === "locked") {
    const flat = lookupPieces ?? [...bySlot.values()].flat();
    const identityKey = resolveLockedExoticIdentityKey(lock, flat);
    const locked = (bySlot.get(lock.slot) ?? []).filter((p) =>
      identityKey
        ? pieceMatchesLockedExotic(p, lock, identityKey)
        : p.itemInstanceId === lock.itemInstanceId,
    );
    bySlot.set(lock.slot, locked);
    for (const slot of SLOT_ORDER) {
      if (slot === lock.slot) continue;
      bySlot.set(
        slot,
        (bySlot.get(slot) ?? []).filter((p) => !p.isExotic),
      );
    }
    return;
  }
  if (lock.mode === "none") {
    for (const slot of SLOT_ORDER) {
      bySlot.set(
        slot,
        (bySlot.get(slot) ?? []).filter((p) => !p.isExotic),
      );
    }
  }
}

export function ownedExoticsForClass(
  inventory: DerivedArmorPieceJson[],
  classType: number,
): DerivedArmorPieceJson[] {
  return inventory.filter(
    (p) => p.isExotic && p.classType === classType,
  );
}

/**
 * Collapses duplicate vault copies and distinct manifest hashes that share the
 * same slot + display name (common for reissued / legacy exotic definitions).
 */
export function exoticPieceIdentityKey(piece: DerivedArmorPieceJson): string {
  const label = (piece.displayName ?? piece.setName ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (label) return `${piece.slot}\0${label}`;
  return `${piece.slot}\0hash:${piece.itemHash}`;
}

/** One thumbnail per exotic identity for the class (not per item hash or copy). */
export function uniqueOwnedExoticsForClass(
  inventory: DerivedArmorPieceJson[],
  classType: number,
): DerivedArmorPieceJson[] {
  const byIdentity = new Map<string, DerivedArmorPieceJson[]>();
  for (const piece of ownedExoticsForClass(inventory, classType)) {
    const key = exoticPieceIdentityKey(piece);
    const copies = byIdentity.get(key) ?? [];
    copies.push(piece);
    byIdentity.set(key, copies);
  }
  const unique = [...byIdentity.values()].map(pickRepresentativeExoticCopy);
  const slotOrder = new Map(SLOT_ORDER.map((slot, i) => [slot, i]));
  return unique.sort((a, b) => {
    const slotDiff =
      (slotOrder.get(a.slot) ?? 0) - (slotOrder.get(b.slot) ?? 0);
    if (slotDiff !== 0) return slotDiff;
    const nameA = a.displayName ?? "";
    const nameB = b.displayName ?? "";
    return nameA.localeCompare(nameB);
  });
}

function pickRepresentativeExoticCopy(
  copies: DerivedArmorPieceJson[],
): DerivedArmorPieceJson {
  return [...copies].sort((a, b) =>
    a.itemInstanceId.localeCompare(b.itemInstanceId),
  )[0]!;
}

/** Map a locked instance to the canonical copy when duplicates exist. */
export function normalizeExoticLock(
  lock: ExoticLock,
  inventory: DerivedArmorPieceJson[],
  classType: number,
): ExoticLock {
  if (lock.mode !== "locked") return lock;
  const owned = ownedExoticsForClass(inventory, classType);
  const locked = owned.find((p) => p.itemInstanceId === lock.itemInstanceId);
  if (!locked) return { mode: "any" };
  const lockedKey = exoticPieceIdentityKey(locked);
  const representative = uniqueOwnedExoticsForClass(inventory, classType).find(
    (p) => exoticPieceIdentityKey(p) === lockedKey,
  );
  if (!representative) return { mode: "any" };
  if (representative.itemInstanceId === lock.itemInstanceId) return lock;
  return {
    mode: "locked",
    itemInstanceId: representative.itemInstanceId,
    slot: representative.slot,
  };
}
