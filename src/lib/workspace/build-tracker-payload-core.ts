import { CLASS_NAMES, SLOT_ORDER } from "@/lib/bungie/constants";
import type {
  ArmorStatName,
  DerivedArmorPieceJson,
  ViewRow,
} from "@/lib/db/types";
import type { GridLookupPayload } from "@/lib/views/grid-lookup-payload";
import { armorSlotIconPathsFromGridLookup } from "@/lib/views/grid-lookup-payload";
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
import {
  defaultWorkspaceLayout,
  type WorkspaceLayoutJson,
} from "@/lib/workspace/workspace-schema";

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

interface EphemeralDescriptor {
  setHash: number;
  archetypeHash: number;
  tuningHash: number;
  classType: number;
}

/**
 * Pure tracker payload assembly. Reads only from {@link GridLookupPayload} so
 * it runs on either side of the server/client boundary.
 */
export function assembleTrackerPayloadFromLookup(
  view: ViewRow & { layout: WorkspaceLayoutJson },
  resolvedSetHash: number,
  inventory: DerivedArmorPieceJson[],
  lookup: GridLookupPayload,
): SerializableTrackerPayload {
  const archetypePair = lookup.archetypeStatPair[String(view.archetype_hash)];
  const tertiaryStats = tertiaryStatsForArchetype(archetypePair);

  const viewForMatching: ViewRow = { ...view, set_hash: resolvedSetHash };
  const progressFull = computeViewProgress(
    viewForMatching,
    inventory,
    tertiaryStats,
  );

  const tertiaryStatIconPaths: Partial<Record<ArmorStatName, string>> = {};
  for (const t of tertiaryStats) {
    const path = lookup.statIconByName[t];
    if (path) tertiaryStatIconPaths[t] = path;
  }

  const armorSlotIconPaths = armorSlotIconPathsFromGridLookup(
    lookup,
    resolvedSetHash,
    Number(view.class_type),
  );

  const setName =
    lookup.setNameByHash[String(resolvedSetHash)] ?? "Unknown set";
  const archetypeName =
    lookup.archetypeNameByHash[String(view.archetype_hash)] ??
    "Unknown archetype";
  const tuningName =
    lookup.tuningNameByHash[String(view.tuning_hash)] ?? "Unknown tuning";
  const tuningPositive = tuningPositiveArmorStat(tuningName);
  const tuningStatIconPath =
    tuningPositive !== null
      ? (lookup.statIconByName[tuningPositive] ?? null)
      : null;

  const className =
    Number(view.class_type) >= 0
      ? CLASS_NAMES[Number(view.class_type)]
      : null;

  const progress = {
    ...progressFull,
    cells: cellsToSerializable(progressFull.cells),
  };

  return {
    view,
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
    needsClass: Number(view.class_type) < 0,
    resolvedSetHash,
  };
}

/**
 * Build a tracker payload for an ephemeral grid tile — no `views` row required.
 * Synthetic `view.id` keeps `SerializableTrackerPayload` consumers (ViewGrid,
 * MergedCompareGrid) happy without touching the database.
 */
export function buildEphemeralTrackerPayload(
  descriptor: EphemeralDescriptor,
  inventory: DerivedArmorPieceJson[],
  lookup: GridLookupPayload,
): SerializableTrackerPayload {
  const { setHash, archetypeHash, tuningHash, classType } = descriptor;

  const setName = lookup.setNameByHash[String(setHash)] ?? "Unknown set";
  const archetypeName =
    lookup.archetypeNameByHash[String(archetypeHash)] ?? "Unknown archetype";
  const tuningName =
    lookup.tuningNameByHash[String(tuningHash)] ?? "Unknown tuning";

  const view: ViewRow & { layout: WorkspaceLayoutJson } = {
    id: ephemeralTrackerId(descriptor),
    user_id: "",
    name: `${setName} · ${archetypeName} · ${tuningName}`,
    set_hash: setHash,
    archetype_hash: archetypeHash,
    tuning_hash: tuningHash,
    class_type: classType,
    created_at: "1970-01-01T00:00:00.000Z",
    updated_at: "1970-01-01T00:00:00.000Z",
    layout: defaultWorkspaceLayout(),
  };

  return assembleTrackerPayloadFromLookup(
    view,
    setHash,
    inventory,
    lookup,
  );
}

export function ephemeralTrackerId(d: EphemeralDescriptor): string {
  return `eph:${d.classType}:${d.setHash}:${d.archetypeHash}:${d.tuningHash}`;
}
