import { SLOT_ORDER, type ArmorSlot } from "@/lib/bungie/constants";
import {
  ARMOR_STAT_NAMES,
  type ArmorStatName,
  type DerivedArmorPieceJson,
  type ViewRow,
} from "@/lib/db/types";

export interface CellMatch {
  slot: ArmorSlot;
  tertiary: ArmorStatName;
  matches: DerivedArmorPieceJson[];
}

export interface ViewProgress {
  viewId: string;
  classType: number;
  // The 4 tertiary stats valid for this view's archetype (i.e. the 6 armor
  // stats minus the archetype's primary + secondary). Empty when the archetype
  // has no recorded stat pair.
  tertiaryStats: ArmorStatName[];
  // Row-major cells: cells[slot][tertiary] -> matching pieces.
  cells: Record<ArmorSlot, Partial<Record<ArmorStatName, DerivedArmorPieceJson[]>>>;
  ownedCells: number;
  totalCells: number;
}

/** Fixed left-to-right order for tertiary columns (solo + merged trackers). */
export const TERTIARY_STAT_DISPLAY_ORDER: readonly ArmorStatName[] = [
  "Health",
  "Class",
  "Melee",
  "Super",
  "Weapons",
  "Grenade",
];

export function orderTertiaryStatsForDisplay(
  stats: readonly ArmorStatName[],
): ArmorStatName[] {
  const present = new Set(stats);
  return TERTIARY_STAT_DISPLAY_ORDER.filter((t) => present.has(t));
}

// Returns the 4 tertiary candidates for an archetype: all 6 armor stats minus
// the two stats the archetype already covers via its primary/secondary plugs.
export function tertiaryStatsForArchetype(
  pair: { primary: ArmorStatName; secondary: ArmorStatName } | undefined,
): ArmorStatName[] {
  if (!pair) return [];
  const raw = ARMOR_STAT_NAMES.filter(
    (s) => s !== pair.primary && s !== pair.secondary,
  );
  return orderTertiaryStatsForDisplay(raw);
}

export function computeViewProgress(
  view: ViewRow,
  inventory: DerivedArmorPieceJson[],
  tertiaryStats: readonly ArmorStatName[],
): ViewProgress {
  const setHash = Number(view.set_hash);
  const archHash = Number(view.archetype_hash);
  const tunHash = Number(view.tuning_hash);
  const classType = Number(view.class_type);

  const cells: Record<ArmorSlot, Partial<Record<ArmorStatName, DerivedArmorPieceJson[]>>> = {
    helmet: {},
    arms: {},
    chest: {},
    legs: {},
    classItem: {},
  };

  for (const slot of SLOT_ORDER) {
    for (const t of tertiaryStats) {
      cells[slot][t] = [];
    }
  }

  for (const piece of inventory) {
    if (classType >= 0 && piece.classType !== classType) continue;
    if (piece.setHash !== setHash) continue;
    if (piece.archetypeHash !== archHash) continue;
    // Strict tuning match: every Armor 3.0 drop already has a random tuning
    // installed at drop time, so `tuningHash === null` is anomalous (typically
    // means our derivation didn't recognize the tuning plug — e.g. a manifest
    // sync gap). Treat null as "no match" rather than wildcarding, so the
    // tracker only counts pieces actually committed to this view's tuning.
    if (piece.tuningHash !== tunHash) continue;
    if (!piece.tertiaryStat) continue;
    if (!tertiaryStats.includes(piece.tertiaryStat)) continue;
    const bucket = cells[piece.slot][piece.tertiaryStat];
    if (bucket) bucket.push(piece);
  }

  let ownedCells = 0;
  for (const slot of SLOT_ORDER) {
    for (const t of tertiaryStats) {
      if ((cells[slot][t]?.length ?? 0) > 0) ownedCells++;
    }
  }

  return {
    viewId: view.id,
    classType,
    tertiaryStats: [...tertiaryStats],
    cells,
    ownedCells,
    totalCells: SLOT_ORDER.length * tertiaryStats.length,
  };
}
