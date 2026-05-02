/**
 * While dragging a tracker on the infinite canvas, nudge the camera when the
 * pointer sits in a band along a viewport edge.
 *
 * We key off the **pointer** (not the tracker bounds). With `bounds="parent"`
 * the panel stops at x=0 / y=0 while the cursor can still hug the left/top of
 * the screen — tracker-rect edge pan barely fired there, but bottom/right felt
 * fine because the workspace extends far in those directions.
 *
 * Important: only update `positionX` / `positionY` here. react-draggable
 * already adjusts its control-point math when the transformed ancestor moves;
 * applying a second full canvas `(x,y)` correction doubles up and throws the
 * panel off the cursor (especially at zoom ≠ 1).
 */

import type { DraggableEvent } from "react-draggable";

const DEFAULT_RAMP_PX = 72;
const DEFAULT_MAX_STEP_PX = 16;
/** At first contact (0px past edge), still move camera at this fraction of max. */
const CONTACT_FLOOR = 0.38;

function stepForDepth(
  depthPastEdge: number,
  maxStep: number,
  ramp: number,
): number {
  const t = Math.min(
    1,
    CONTACT_FLOOR + (1 - CONTACT_FLOOR) * (depthPastEdge / Math.max(ramp, 1)),
  );
  return maxStep * t;
}

export interface DragEdgePanPointerArgs {
  pointerX: number;
  pointerY: number;
  viewportRect: DOMRect;
  positionX: number;
  positionY: number;
  rampPx?: number;
  maxStepPx?: number;
}

export interface DragEdgePanResult {
  positionX: number;
  positionY: number;
  didPan: boolean;
}

export function computeDragEdgePanFromPointer({
  pointerX,
  pointerY,
  viewportRect,
  positionX,
  positionY,
  rampPx = DEFAULT_RAMP_PX,
  maxStepPx = DEFAULT_MAX_STEP_PX,
}: DragEdgePanPointerArgs): DragEdgePanResult {
  let deltaPx = 0;
  let deltaPy = 0;

  const distLeft = pointerX - viewportRect.left;
  if (distLeft < rampPx) {
    const depth = Math.max(0, rampPx - distLeft);
    deltaPx += stepForDepth(depth, maxStepPx, rampPx);
  }
  const distRight = viewportRect.right - pointerX;
  if (distRight < rampPx) {
    const depth = Math.max(0, rampPx - distRight);
    deltaPx -= stepForDepth(depth, maxStepPx, rampPx);
  }
  const distTop = pointerY - viewportRect.top;
  if (distTop < rampPx) {
    const depth = Math.max(0, rampPx - distTop);
    deltaPy += stepForDepth(depth, maxStepPx, rampPx);
  }
  const distBottom = viewportRect.bottom - pointerY;
  if (distBottom < rampPx) {
    const depth = Math.max(0, rampPx - distBottom);
    deltaPy -= stepForDepth(depth, maxStepPx, rampPx);
  }

  if (deltaPx === 0 && deltaPy === 0) {
    return {
      positionX,
      positionY,
      didPan: false,
    };
  }

  return {
    positionX: positionX + deltaPx,
    positionY: positionY + deltaPy,
    didPan: true,
  };
}

/** Best-effort client point from react-rnd / react-draggable's first callback arg. */
export function clientPointFromDragEvent(
  e: DraggableEvent | undefined,
): { x: number; y: number } | null {
  if (!e) return null;
  if (e instanceof MouseEvent) {
    return { x: e.clientX, y: e.clientY };
  }
  if (
    typeof TouchEvent !== "undefined" &&
    e instanceof TouchEvent &&
    e.touches.length > 0
  ) {
    const t = e.touches[0];
    return { x: t.clientX, y: t.clientY };
  }
  if ("nativeEvent" in e && e.nativeEvent instanceof MouseEvent) {
    return { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
  }
  const ne = "nativeEvent" in e ? e.nativeEvent : null;
  if (
    typeof TouchEvent !== "undefined" &&
    ne instanceof TouchEvent &&
    ne.touches.length > 0
  ) {
    const t = ne.touches[0];
    return { x: t.clientX, y: t.clientY };
  }
  return null;
}
