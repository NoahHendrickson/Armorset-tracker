import type { SerializableTrackerPayload } from "@/lib/workspace/types";
import {
  TRACKER_DEFAULT_HEIGHT,
  TRACKER_WIDTH,
} from "@/lib/workspace/workspace-constants";
import { parseWorkspaceLayout } from "@/lib/workspace/workspace-schema";

/** Min overlap (fraction of dragged tracker area) to show merge preview and allow merge-on-drop. */
export const MERGE_OVERLAP_TRIGGER_RATIO = 0.05;

export type MergeOverlapRect = { w: number; h: number };

const defaultSoloRect = (): MergeOverlapRect => ({
  w: TRACKER_WIDTH,
  h: TRACKER_DEFAULT_HEIGHT,
});

/**
 * Intersection area divided by dragged rect area. Compare to
 * {@link MERGE_OVERLAP_TRIGGER_RATIO} for merge affordances.
 *
 * Dragged and target footprints may differ (e.g. merged trackers use wider
 * `layout.w`); both rectangles must use their real bounds or overlap vanishes
 * outside the default solo width strip.
 */
export function mergeOverlapRatio(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  dragged: MergeOverlapRect = defaultSoloRect(),
  target: MergeOverlapRect = dragged,
): number {
  const wa = dragged.w;
  const ha = dragged.h;
  const wb = target.w;
  const hb = target.h;
  const ix = Math.max(0, Math.min(ax + wa, bx + wb) - Math.max(ax, bx));
  const iy = Math.max(0, Math.min(ay + ha, by + hb) - Math.max(ay, by));
  const inter = ix * iy;
  if (inter <= 0) return 0;
  return inter / (wa * ha);
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

/** Live dragged bounds in canvas coordinates (same space as `views.layout`). */
export interface MergeDragRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Best merge target under the dragged rect (highest overlap ratio).
 * Used during drag for highlights and again on drag end so merge-on-drop does
 * not depend on a final `onDrag` frame firing before `onDragStop`.
 */
export function pickMergeDropTarget(
  viewId: string,
  dragRect: MergeDragRect,
  trackers: readonly SerializableTrackerPayload[],
): { targetId: string | null; valid: boolean } {
  const self = trackers.find((t) => t.view.id === viewId) ?? null;
  const selfStored = self ? parseWorkspaceLayout(self.view.layout) : null;
  const partnerId = selfStored?.mergedWith ?? null;

  const dragFootprint: MergeOverlapRect = { w: dragRect.w, h: dragRect.h };

  let best: { id: string; ratio: number } | null = null;
  for (const t of trackers) {
    if (t.view.id === viewId) continue;
    if (partnerId !== null && t.view.id === partnerId) continue;
    const tLo = parseWorkspaceLayout(t.view.layout);
    const ratio = mergeOverlapRatio(
      dragRect.x,
      dragRect.y,
      t.view.layout.x,
      t.view.layout.y,
      dragFootprint,
      { w: tLo.w, h: tLo.h },
    );
    if (ratio < MERGE_OVERLAP_TRIGGER_RATIO) continue;
    if (!best || ratio > best.ratio) best = { id: t.view.id, ratio };
  }

  const targetId = best?.id ?? null;
  if (!targetId || !self) return { targetId: null, valid: false };

  const tgt = trackers.find((t) => t.view.id === targetId);
  if (!tgt) return { targetId: null, valid: false };

  return { targetId, valid: canAttemptMerge(self, tgt) };
}
