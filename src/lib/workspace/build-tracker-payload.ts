import "server-only";

import { CLASS_NAMES, SLOT_ORDER } from "@/lib/bungie/constants";
import type { ArmorStatName } from "@/lib/db/types";
import type { DerivedArmorPieceJson, ViewRow } from "@/lib/db/types";
import type { ManifestLookups } from "@/lib/manifest/lookups";
import {
  armorSlotIconPathsForView,
  resolveViewSetHash,
} from "@/lib/manifest/lookups";
import type { ViewProgress } from "@/lib/views/progress";
import {
  computeViewProgress,
  tertiaryStatsForArchetype,
} from "@/lib/views/progress";
import { tuningPositiveArmorStat } from "@/lib/views/tuning-positive-stat";
import type {
  SerializableTrackerPayload,
  SerializableViewProgressCells,
} from "@/lib/workspace/types";
import { parseWorkspaceLayout } from "@/lib/workspace/workspace-schema";

function cellsToSerializable(
  cells: ViewProgress["cells"],
): SerializableViewProgressCells {
  const out: SerializableViewProgressCells = {};
  for (const slot of SLOT_ORDER) {
    out[slot] = {};
    const row = cells[slot];
    for (const statName of Object.keys(row)) {
      const v = row[statName as ArmorStatName];
      if (v !== undefined) {
        out[slot]![statName] = v;
      }
    }
  }
  return out;
}

/** Build one tracker card payload after DB view row + manifest + inventory snapshot. */
export function buildSerializableTrackerPayload(
  viewRow: ViewRow,
  lookups: ManifestLookups,
  inventory: DerivedArmorPieceJson[],
): SerializableTrackerPayload {
  const resolvedSetHash = resolveViewSetHash(Number(viewRow.set_hash), lookups);
  const viewForMatching = { ...viewRow, set_hash: resolvedSetHash };

  const archetypePair = lookups.archetypeStatPair.get(
    Number(viewRow.archetype_hash),
  );
  const tertiaryStats = tertiaryStatsForArchetype(archetypePair);
  const progressFull = computeViewProgress(
    viewForMatching,
    inventory,
    tertiaryStats,
  );

  const tertiaryStatIconPaths: Partial<Record<ArmorStatName, string>> = {};
  for (const t of tertiaryStats) {
    const path = lookups.statIconByName.get(t);
    if (path) tertiaryStatIconPaths[t] = path;
  }

  const armorSlotIconPaths = armorSlotIconPathsForView(
    lookups,
    resolvedSetHash,
    Number(viewRow.class_type),
  );

  const setName =
    lookups.setNameByHash.get(resolvedSetHash) ?? "Unknown set";
  const archetypeName =
    lookups.archetypeNameByHash.get(Number(viewRow.archetype_hash)) ??
    "Unknown archetype";
  const tuningName =
    lookups.tuningNameByHash.get(Number(viewRow.tuning_hash)) ?? "Unknown tuning";
  const tuningPositive = tuningPositiveArmorStat(tuningName);
  const tuningStatIconPath =
    tuningPositive !== null
      ? (lookups.statIconByName.get(tuningPositive) ?? null)
      : null;

  const className =
    Number(viewRow.class_type) >= 0
      ? CLASS_NAMES[Number(viewRow.class_type)]
      : null;

  const { cells, ...restProgress } = progressFull;
  void cells;
  const progress = {
    ...restProgress,
    cells: cellsToSerializable(progressFull.cells),
  };

  const needsClass = Number(viewRow.class_type) < 0;

  const layout = parseWorkspaceLayout(viewRow.layout);

  return {
    view: {
      ...viewRow,
      layout,
    },
    progress,
    setName,
    archetypeName,
    tuningName,
    tuningStatIconPath,
    className,
    archetypePrimarySecondary: archetypePair
      ? { primary: archetypePair.primary, secondary: archetypePair.secondary }
      : null,
    tertiaryStatIconPaths: tertiaryStatIconPaths as Record<string, string>,
    armorSlotIconPaths: armorSlotIconPaths as Record<string, string>,
    needsClass,
    resolvedSetHash,
  };
}
