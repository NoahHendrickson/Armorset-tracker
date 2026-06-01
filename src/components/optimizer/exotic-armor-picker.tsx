"use client";

import { useMemo } from "react";
import {
  SLOT_LABELS,
  SLOT_ORDER,
  bungieIconUrl,
  type ArmorSlot,
} from "@/lib/bungie/constants";
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

const MODE_OPTIONS = [
  { mode: "none" as const, label: "All legendary" },
  { mode: "any" as const, label: "Any exotic" },
];

function exoticsBySlot(
  exotics: DerivedArmorPieceJson[],
): Map<ArmorSlot, DerivedArmorPieceJson[]> {
  const map = new Map<ArmorSlot, DerivedArmorPieceJson[]>();
  for (const slot of SLOT_ORDER) {
    map.set(slot, []);
  }
  for (const piece of exotics) {
    map.get(piece.slot)?.push(piece);
  }
  return map;
}

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
  const bySlot = useMemo(() => exoticsBySlot(uniqueExotics), [uniqueExotics]);

  const handlePieceClick = (piece: DerivedArmorPieceJson) => {
    if (isLockedToPiece(exoticLock, piece)) {
      onExoticLockChange({ mode: "any" });
      return;
    }
    onExoticLockChange({
      mode: "locked",
      itemInstanceId: piece.itemInstanceId,
      slot: piece.slot,
    });
  };

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Exotic armor mode"
      >
        {MODE_OPTIONS.map((option) => {
          const selected = exoticLock.mode === option.mode;
          return (
            <button
              key={option.mode}
              type="button"
              aria-pressed={selected}
              className={cn(
                "rounded-none border px-3 py-2 text-sm transition-colors",
                selected
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:bg-muted",
              )}
              onClick={() => onExoticLockChange({ mode: option.mode })}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {uniqueExotics.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No exotic armor in inventory for this class.
        </p>
      ) : (
        <div className="space-y-4">
          {SLOT_ORDER.map((slot) => {
            const pieces = bySlot.get(slot) ?? [];
            if (pieces.length === 0) return null;
            return (
              <div key={slot}>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {SLOT_LABELS[slot]}
                </p>
                <ul
                  className="flex flex-wrap gap-2"
                  role="list"
                  aria-label={`${SLOT_LABELS[slot]} exotics`}
                >
                  {pieces.map((piece) => {
                    const selected = isLockedToPiece(exoticLock, piece);
                    const name =
                      inventoryPieceDisplayName(piece) ?? "Exotic armor";
                    return (
                      <li key={piece.itemInstanceId}>
                        <button
                          type="button"
                          aria-pressed={selected}
                          title={name}
                          className={cn(
                            "inline-flex rounded-none border bg-background p-0.5 transition-colors",
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
                              className="block size-10 object-contain sm:size-12"
                              loading="lazy"
                            />
                          ) : (
                            <span
                              className="block size-10 bg-muted sm:size-12"
                              aria-hidden
                            />
                          )}
                          <span className="sr-only">
                            {selected ? `Selected: ${name}` : name}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
