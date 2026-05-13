import type { ArmorStatName, DerivedArmorPieceJson } from "@/lib/db/types";
import type {
  SerializableTrackerPayload,
  SerializableViewProgressCells,
} from "@/lib/workspace/types";
import type { ViewProgress } from "@/lib/views/progress";
import { CLASS_NAMES } from "@/lib/bungie/constants";
import {
  defaultWorkspaceLayout,
  type WorkspaceLayoutJson,
} from "@/lib/workspace/workspace-schema";
import {
  PROGRESS_COMPLETE,
  PROGRESS_EMPTY,
  PROGRESS_PARTIAL,
} from "./view-progress";
import {
  MOCK_VIEW_HUNTER,
  MOCK_VIEW_TITAN,
} from "./view-row";

function toSerializableProgress(progress: ViewProgress) {
  const cells: SerializableViewProgressCells = {};
  for (const slotKey of Object.keys(progress.cells)) {
    const slot = slotKey as keyof ViewProgress["cells"];
    const row = progress.cells[slot];
    const out: Partial<Record<string, DerivedArmorPieceJson[]>> = {};
    for (const statKey of Object.keys(row)) {
      out[statKey] = row[statKey as ArmorStatName];
    }
    cells[slotKey] = out;
  }
  const { cells: _omit, ...rest } = progress;
  void _omit;
  return { ...rest, cells };
}

interface BuildPayloadOptions {
  view: typeof MOCK_VIEW_TITAN;
  progress: ViewProgress;
  setName: string;
  archetypeName: string;
  tuningName: string;
  layout?: WorkspaceLayoutJson;
  primaryStat?: ArmorStatName;
  secondaryStat?: ArmorStatName;
}

function buildPayload({
  view,
  progress,
  setName,
  archetypeName,
  tuningName,
  layout,
  primaryStat = "Weapons",
  secondaryStat = "Health",
}: BuildPayloadOptions): SerializableTrackerPayload {
  const className =
    Number(view.class_type) >= 0 ? CLASS_NAMES[Number(view.class_type)] : null;
  return {
    view: { ...view, layout: layout ?? defaultWorkspaceLayout() },
    progress: toSerializableProgress(progress),
    setName,
    archetypeName,
    tuningName,
    className: className ?? null,
    archetypePrimarySecondary: { primary: primaryStat, secondary: secondaryStat },
    tertiaryStatIconPaths: {},
    armorSlotIconPaths: {},
    tuningStatIconPath: null,
    needsClass: Number(view.class_type) < 0,
    resolvedSetHash: Number(view.set_hash),
  };
}

export const MOCK_PAYLOAD_TITAN_PARTIAL: SerializableTrackerPayload = buildPayload({
  view: MOCK_VIEW_TITAN,
  progress: PROGRESS_PARTIAL,
  setName: "Iron Will Suit",
  archetypeName: "Bulwark",
  tuningName: "Tuned: +Weapons / -Grenade",
});

export const MOCK_PAYLOAD_TITAN_COMPLETE: SerializableTrackerPayload = buildPayload({
  view: MOCK_VIEW_TITAN,
  progress: PROGRESS_COMPLETE,
  setName: "Iron Will Suit",
  archetypeName: "Bulwark",
  tuningName: "Tuned: +Weapons / -Grenade",
});

export const MOCK_PAYLOAD_HUNTER_EMPTY: SerializableTrackerPayload = buildPayload({
  view: MOCK_VIEW_HUNTER,
  progress: PROGRESS_EMPTY,
  setName: "Reverie Dawn",
  archetypeName: "Brawler",
  tuningName: "Tuned: +Health / -Super",
  primaryStat: "Health",
  secondaryStat: "Super",
});
