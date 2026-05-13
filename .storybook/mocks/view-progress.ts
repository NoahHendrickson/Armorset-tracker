import type { ArmorSlot } from "@/lib/bungie/constants";
import { SLOT_ORDER } from "@/lib/bungie/constants";
import type { ArmorStatName, DerivedArmorPieceJson } from "@/lib/db/types";
import type { ViewProgress } from "@/lib/views/progress";
import { computeViewProgress } from "@/lib/views/progress";
import { EMPTY_INVENTORY, FULL_COVERAGE_INVENTORY, MOCK_INVENTORY } from "./armor-pieces";
import { MOCK_VIEW_TITAN } from "./view-row";

const TERTIARY_STATS: ArmorStatName[] = ["Class", "Melee", "Super", "Grenade"];

/** Empty cells skeleton for one tracker (no inventory). */
function emptyCells(): Record<ArmorSlot, Partial<Record<ArmorStatName, DerivedArmorPieceJson[]>>> {
  return SLOT_ORDER.reduce(
    (acc, slot) => {
      acc[slot] = {};
      for (const t of TERTIARY_STATS) {
        acc[slot]![t] = [];
      }
      return acc;
    },
    {} as Record<ArmorSlot, Partial<Record<ArmorStatName, DerivedArmorPieceJson[]>>>,
  );
}

export const PROGRESS_EMPTY: ViewProgress = {
  viewId: MOCK_VIEW_TITAN.id,
  classType: 0,
  tertiaryStats: TERTIARY_STATS,
  cells: emptyCells(),
  ownedCells: 0,
  totalCells: SLOT_ORDER.length * TERTIARY_STATS.length,
};

export const PROGRESS_PARTIAL: ViewProgress = computeViewProgress(
  MOCK_VIEW_TITAN,
  MOCK_INVENTORY,
  TERTIARY_STATS,
);

export const PROGRESS_COMPLETE: ViewProgress = computeViewProgress(
  MOCK_VIEW_TITAN,
  FULL_COVERAGE_INVENTORY,
  TERTIARY_STATS,
);

export const PROGRESS_LOADING_INVENTORY = {
  progress: PROGRESS_EMPTY,
  hasInventory: false,
  inventory: EMPTY_INVENTORY,
} as const;
