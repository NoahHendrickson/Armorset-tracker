"use client";

import { useMemo } from "react";
import { bungieIconUrl } from "@/lib/bungie/constants";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import { inventoryPieceDisplayName } from "@/lib/filters/filter-inventory";
import type { ExoticLock } from "@/lib/optimizer/exotic-lock";
import { uniqueOwnedExoticsForClass } from "@/lib/optimizer/exotic-lock";
import { cn } from "@/lib/utils";

export type ExoticArmorPickerProps = {
  inventory: DerivedArmorPieceJson[];
  classType: number;
  exoticLock: ExoticLock;
  onExoticLockChange: (lock: ExoticLock) => void;
};

function isLockedToPiece(lock: ExoticLock, piece: DerivedArmorPieceJson): boolean {
  return (
    lock.mode === "locked" &&
    lock.itemInstanceId === piece.itemInstanceId &&
    lock.slot === piece.slot
  );
}

export function ExoticArmorPicker({
  inventory,
  classType,
  exoticLock,
  onExoticLockChange,
}: ExoticArmorPickerProps) {
  const uniqueExotics = useMemo(
    () => uniqueOwnedExoticsForClass(inventory, classType),
    [inventory, classType],
  );

  const handlePieceClick = (piece: DerivedArmorPieceJson) => {
    if (isLockedToPiece(exoticLock, piece)) {
      onExoticLockChange({ mode: "none" });
      return;
    }
    onExoticLockChange({
      mode: "locked",
      itemInstanceId: piece.itemInstanceId,
      slot: piece.slot,
    });
  };

  if (uniqueExotics.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No exotic armor in inventory for this class.
      </p>
    );
  }

  return (
    <ul
      className="grid w-max grid-cols-8 gap-1.5 leading-none"
      role="list"
      aria-label="Exotic armor"
    >
      {uniqueExotics.map((piece) => {
        const selected = isLockedToPiece(exoticLock, piece);
        const name = inventoryPieceDisplayName(piece) ?? "Exotic armor";
        return (
          <li key={piece.itemInstanceId}>
            <button
              type="button"
              aria-pressed={selected}
              title={name}
              className={cn(
                "flex size-10 overflow-hidden rounded-none border transition-colors",
                selected
                  ? "border-foreground ring-1 ring-foreground"
                  : "border-border hover:border-foreground/50",
              )}
              onClick={() => handlePieceClick(piece)}
            >
              {piece.iconPath ? (
                <img
                  src={bungieIconUrl(piece.iconPath)}
                  alt={name}
                  className="size-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="size-full bg-muted" aria-hidden />
              )}
              <span className="sr-only">
                {selected ? `Selected: ${name}` : name}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
