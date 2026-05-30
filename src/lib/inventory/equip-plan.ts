import { CLASS_NAMES } from "@/lib/bungie/constants";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import type { GridFilterClass } from "@/lib/workspace/grid-filters-schema";

export type EquipPlanStep =
  | {
      kind: "transfer";
      characterId: string;
      transferToVault: boolean;
    }
  | {
      kind: "equip";
      characterId: string;
    };

/** Bungie TransferItem throttle is 0.1s between actions per user. */
export const EQUIP_ACTION_GAP_MS = 110;

/**
 * Vault ↔ character only; cross-character moves use the vault as intermediary.
 */
export function planTransferSteps(
  piece: DerivedArmorPieceJson,
  targetCharacterId: string,
): EquipPlanStep[] {
  const loc = piece.location;

  if (loc.kind === "vault") {
    return [
      { kind: "transfer", characterId: targetCharacterId, transferToVault: false },
    ];
  }

  if (loc.characterId === targetCharacterId) {
    return [];
  }

  return [
    { kind: "transfer", characterId: loc.characterId, transferToVault: true },
    { kind: "transfer", characterId: targetCharacterId, transferToVault: false },
  ];
}

export function planEquipSteps(
  piece: DerivedArmorPieceJson,
  targetCharacterId: string,
): EquipPlanStep[] {
  const loc = piece.location;

  if (loc.kind === "character" && loc.characterId === targetCharacterId && loc.equipped) {
    return [];
  }

  const transfers = planTransferSteps(piece, targetCharacterId);
  if (
    loc.kind === "character" &&
    loc.characterId === targetCharacterId &&
    !loc.equipped
  ) {
    return [{ kind: "equip", characterId: targetCharacterId }];
  }

  return [...transfers, { kind: "equip", characterId: targetCharacterId }];
}

export function resolveCharacterIdForClass(
  characters: Record<string, { classType: number }>,
  classType: number,
): string | null {
  for (const [characterId, meta] of Object.entries(characters)) {
    if (meta.classType === classType) return characterId;
  }
  return null;
}

/** Piece class must match the table filter class. */
export function wrongClassForTarget(
  piece: DerivedArmorPieceJson,
  targetClass: GridFilterClass,
): string | null {
  if (piece.classType != null && piece.classType !== targetClass) {
    return `Only ${CLASS_NAMES[targetClass] ?? "this class"} armor can be moved or equipped here.`;
  }
  return null;
}

/**
 * True when the piece is already on the target class's character (one character
 * per class — matches {@link planTransferSteps} noop via characterId).
 */
export function moveNoopForTargetClass(
  piece: DerivedArmorPieceJson,
  targetClass: GridFilterClass,
): boolean {
  const loc = piece.location;
  return loc.kind === "character" && loc.classType === targetClass;
}

/** True when already equipped on the target class's character. */
export function equipNoopForTargetClass(
  piece: DerivedArmorPieceJson,
  targetClass: GridFilterClass,
): boolean {
  const loc = piece.location;
  return loc.kind === "character" && loc.equipped && loc.classType === targetClass;
}

export function moveDisabledMessage(
  piece: DerivedArmorPieceJson,
  targetClass: GridFilterClass,
): string | null {
  const classBlock = wrongClassForTarget(piece, targetClass);
  if (classBlock) return classBlock;
  if (moveNoopForTargetClass(piece, targetClass)) {
    return "Already on this character.";
  }
  return null;
}

export function equipDisabledMessage(
  piece: DerivedArmorPieceJson,
  targetClass: GridFilterClass,
): string | null {
  const classBlock = wrongClassForTarget(piece, targetClass);
  if (classBlock) return classBlock;
  if (equipNoopForTargetClass(piece, targetClass)) {
    return "Already equipped.";
  }
  return null;
}
