import type {
  DerivedArmorPieceJson,
  ViewRow,
} from "@/lib/db/types";
import type { ViewProgress } from "@/lib/views/progress";
import type { WorkspaceLayoutJson } from "@/lib/workspace/workspace-schema";

/** Strip Map-based cells → JSON-safe structure for passing RSC → client. */
export type SerializableViewProgressCells = Record<
  string,
  Partial<Record<string, DerivedArmorPieceJson[]>>
>;

export interface SerializableTrackerPayload {
  view: ViewRow & { layout: WorkspaceLayoutJson };
  progress: Omit<ViewProgress, "cells"> & {
    cells: SerializableViewProgressCells;
  };
  setName: string;
  archetypeName: string;
  tuningName: string;
  className: string | null;
  archetypePrimarySecondary: {
    primary: string;
    secondary: string;
  } | null;
  /** Relative paths for tertiary column headers — JSON-serializable map. */
  tertiaryStatIconPaths: Record<string, string>;
  /** Icon for the tuning +stat (+Weapons, …) when parsing succeeds. */
  tuningStatIconPath: string | null;
  needsClass: boolean;
  resolvedSetHash: number;
}
