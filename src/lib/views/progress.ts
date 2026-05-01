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

// Returns the 4 tertiary candidates for an archetype: all 6 armor stats minus
// the two stats the archetype already covers via its primary/secondary plugs.
export function tertiaryStatsForArchetype(
  pair: { primary: ArmorStatName; secondary: ArmorStatName } | undefined,
): ArmorStatName[] {
  if (!pair) return [];
  return ARMOR_STAT_NAMES.filter(
    (s) => s !== pair.primary && s !== pair.secondary,
  );
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

export interface ViewDiagnostics {
  totalInventory: number;
  classFiltered: number;
  withAnySetHash: number;
  withAnyArchetypeHash: number;
  withAnyTuningHash: number;
  withAnyTertiary: number;
  matchingSet: number;
  matchingArchetype: number;
  matchingTuning: number;
  matchingSetAndArchetype: number;
  matchingSetAndTuning: number;
  matchingAll: number;
  matchingAllInClass: number;
  archetypePairKnown: boolean;
}

export function computeViewDiagnostics(
  view: ViewRow,
  inventory: DerivedArmorPieceJson[],
  archetypePairKnown: boolean,
): ViewDiagnostics {
  const setHash = Number(view.set_hash);
  const archHash = Number(view.archetype_hash);
  const tunHash = Number(view.tuning_hash);
  const classType = Number(view.class_type);

  let classFiltered = 0;
  let withAnySetHash = 0;
  let withAnyArchetypeHash = 0;
  let withAnyTuningHash = 0;
  let withAnyTertiary = 0;
  let matchingSet = 0;
  let matchingArchetype = 0;
  let matchingTuning = 0;
  let matchingSetAndArchetype = 0;
  let matchingSetAndTuning = 0;
  let matchingAll = 0;
  let matchingAllInClass = 0;

  for (const p of inventory) {
    const inClass = classType < 0 || p.classType === classType;
    if (inClass) classFiltered++;
    if (p.setHash !== null) withAnySetHash++;
    if (p.archetypeHash !== null) withAnyArchetypeHash++;
    if (p.tuningHash !== null) withAnyTuningHash++;
    if (p.tertiaryStat !== null) withAnyTertiary++;

    const s = p.setHash === setHash;
    const a = p.archetypeHash === archHash;
    const t = p.tuningHash === tunHash;
    if (s) matchingSet++;
    if (a) matchingArchetype++;
    if (t) matchingTuning++;
    if (s && a) matchingSetAndArchetype++;
    if (s && t) matchingSetAndTuning++;
    if (s && a && t) matchingAll++;
    if (s && a && t && inClass) matchingAllInClass++;
  }

  return {
    totalInventory: inventory.length,
    classFiltered,
    withAnySetHash,
    withAnyArchetypeHash,
    withAnyTuningHash,
    withAnyTertiary,
    matchingSet,
    matchingArchetype,
    matchingTuning,
    matchingSetAndArchetype,
    matchingSetAndTuning,
    matchingAll,
    matchingAllInClass,
    archetypePairKnown,
  };
}
