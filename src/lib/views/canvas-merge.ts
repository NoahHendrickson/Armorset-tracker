import type { SerializableTrackerPayload } from "@/lib/workspace/types";
import {
  TRACKER_DEFAULT_HEIGHT,
  TRACKER_WIDTH,
} from "@/lib/workspace/workspace-constants";

/** Min overlap (fraction of dragged tracker area) to show merge preview and allow merge-on-drop. */
export const MERGE_OVERLAP_TRIGGER_RATIO = 0.05;

/**
 * Intersection area divided by dragged rect area (w×h). Compare to
 * {@link MERGE_OVERLAP_TRIGGER_RATIO} for merge affordances.
 */
export function mergeOverlapRatio(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  w: number = TRACKER_WIDTH,
  h: number = TRACKER_DEFAULT_HEIGHT,
): number {
  const ix = Math.max(0, Math.min(ax + w, bx + w) - Math.max(ax, bx));
  const iy = Math.max(0, Math.min(ay + h, by + h) - Math.max(ay, by));
  const inter = ix * iy;
  if (inter <= 0) return 0;
  return inter / (w * h);
}

export function canAttemptMerge(
  a: SerializableTrackerPayload,
  b: SerializableTrackerPayload,
): boolean {
  if (a.view.id === b.view.id) return false;
  if (Number(a.view.class_type) !== Number(b.view.class_type)) return false;
  const aM = a.view.layout.mergedWith ?? null;
  const bM = b.view.layout.mergedWith ?? null;
  if (aM != null && aM !== b.view.id) return false;
  if (bM != null && bM !== a.view.id) return false;
  return true;
}
