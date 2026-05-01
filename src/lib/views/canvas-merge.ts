import type { SerializableTrackerPayload } from "@/lib/workspace/types";
import {
  TRACKER_DEFAULT_HEIGHT,
  TRACKER_WIDTH,
} from "@/lib/workspace/workspace-constants";

/**
 * Intersection / dragged rect area — values above ~0.2 feel like intentional overlap.
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

export function unionBounds(
  rects: { x: number; y: number; w: number; h: number }[],
): { x: number; y: number; w: number; h: number } | null {
  if (rects.length === 0) return null;
  let minX = rects[0].x;
  let minY = rects[0].y;
  let maxR = rects[0].x + rects[0].w;
  let maxB = rects[0].y + rects[0].h;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxR = Math.max(maxR, r.x + r.w);
    maxB = Math.max(maxB, r.y + r.h);
  }
  return { x: minX, y: minY, w: maxR - minX, h: maxB - minY };
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
