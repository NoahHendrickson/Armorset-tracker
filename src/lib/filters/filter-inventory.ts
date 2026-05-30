import {
  SLOT_LABELS,
  SLOT_ORDER,
  type ArmorSlot,
} from "@/lib/bungie/constants";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import type { GridFiltersJson } from "@/lib/workspace/grid-filters-schema";

function slotRank(slot: ArmorSlot): number {
  return SLOT_ORDER.indexOf(slot);
}

export function filterInventoryPieces(
  inventory: DerivedArmorPieceJson[],
  filters: GridFiltersJson,
): DerivedArmorPieceJson[] {
  let rows = inventory.filter((p) => p.classType === filters.class);
  if (filters.setHashes.length > 0) {
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
  const trimmedSearch = filters.search.trim().toLowerCase();
  if (trimmedSearch) {
    rows = rows.filter((p) => {
      const haystack = [
        p.setName,
        p.archetypeName,
        p.tuningName,
        p.tertiaryStat,
        SLOT_LABELS[p.slot],
      ]
        .filter((v): v is string => Boolean(v))
        .join(" ")
        .toLowerCase();
      return haystack.includes(trimmedSearch);
    });
  }
  return [...rows].sort((a, b) => {
    const sd = slotRank(a.slot) - slotRank(b.slot);
    if (sd !== 0) return sd;
    const na = (a.setName ?? "").localeCompare(b.setName ?? "");
    if (na !== 0) return na;
    return a.itemHash - b.itemHash;
  });
}
