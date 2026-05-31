import { SLOT_ORDER, type ArmorSlot } from "@/lib/bungie/constants";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import {
  inventoryPieceMatchesSetSearch,
  tokenizeInventorySearchQuery,
} from "@/lib/filters/inventory-set-search";
import type { GridFiltersJson } from "@/lib/workspace/grid-filters-schema";

function slotRank(slot: ArmorSlot): number {
  return SLOT_ORDER.indexOf(slot);
}

/** Primary inventory-table label; legacy rows may only have `setName`. */
export function inventoryPieceDisplayName(
  piece: DerivedArmorPieceJson,
): string | null {
  return piece.displayName ?? piece.setName ?? null;
}

export function filterInventoryPieces(
  inventory: DerivedArmorPieceJson[],
  filters: GridFiltersJson,
): DerivedArmorPieceJson[] {
  let rows = inventory.filter((p) => p.classType === filters.class);
  // Rarity is single-select and always applied (absent `isExotic` = legendary).
  const wantExotic = filters.rarity === "exotic";
  rows = rows.filter((p) => Boolean(p.isExotic) === wantExotic);
  // Exotics have no equipable set — set filter applies to legendary only.
  if (!wantExotic && filters.setHashes.length > 0) {
    const allowed = new Set(filters.setHashes);
    rows = rows.filter((p) => p.setHash != null && allowed.has(p.setHash));
  }
  if (filters.archetypeHashes.length > 0) {
    const allowed = new Set(filters.archetypeHashes);
    rows = rows.filter(
      (p) => p.archetypeHash != null && allowed.has(p.archetypeHash),
    );
  }
  if (filters.tuningHashes.length > 0) {
    const allowed = new Set(filters.tuningHashes);
    rows = rows.filter(
      (p) => p.tuningHash != null && allowed.has(p.tuningHash),
    );
  }
  if (filters.tertiaryStats.length > 0) {
    const allowed = new Set(filters.tertiaryStats);
    rows = rows.filter(
      (p) => p.tertiaryStat != null && allowed.has(p.tertiaryStat),
    );
  }
  const searchTokens = tokenizeInventorySearchQuery(filters.search);
  if (searchTokens.length > 0) {
    rows = rows.filter((p) =>
      inventoryPieceMatchesSetSearch(p, searchTokens),
    );
  }
  return [...rows].sort((a, b) => {
    const sd = slotRank(a.slot) - slotRank(b.slot);
    if (sd !== 0) return sd;
    const na = (inventoryPieceDisplayName(a) ?? "").localeCompare(
      inventoryPieceDisplayName(b) ?? "",
    );
    if (na !== 0) return na;
    return a.itemHash - b.itemHash;
  });
}
