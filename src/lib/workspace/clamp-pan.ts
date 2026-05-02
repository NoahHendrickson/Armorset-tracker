import {
  WORKSPACE_CANVAS_HEIGHT,
  WORKSPACE_CANVAS_WIDTH,
} from "@/lib/workspace/workspace-constants";

export interface ClampWorkspacePanInput {
  positionX: number;
  positionY: number;
  scale: number;
  viewportWidth: number;
  viewportHeight: number;
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface ClampWorkspacePanResult {
  positionX: number;
  positionY: number;
  changed: boolean;
}

/**
 * Constrains pan so the scaled canvas always fully covers the viewport — no
 * empty margin can be revealed at any edge. `positionX/Y` follow the
 * react-zoom-pan-pinch convention: viewport-space offset of the canvas top-left.
 *
 * The scaled canvas occupies `(positionX, positionY)..(positionX + scale*W,
 * positionY + scale*H)` in viewport coords. To cover the viewport rectangle
 * `(0..vw, 0..vh)`:
 *   positionX in [vw - scale*W, 0]
 *   positionY in [vh - scale*H, 0]
 *
 * If the canvas is smaller than the viewport on an axis (only happens
 * transiently, e.g. before the resize-snap effect lifts scale to minScale), we
 * center on that axis instead of clamping into an empty range.
 */
export function clampWorkspacePan({
  positionX,
  positionY,
  scale,
  viewportWidth,
  viewportHeight,
  canvasWidth = WORKSPACE_CANVAS_WIDTH,
  canvasHeight = WORKSPACE_CANVAS_HEIGHT,
}: ClampWorkspacePanInput): ClampWorkspacePanResult {
  if (viewportWidth <= 0 || viewportHeight <= 0 || scale <= 0) {
    return { positionX, positionY, changed: false };
  }
  const scaledW = scale * canvasWidth;
  const scaledH = scale * canvasHeight;

  let x = positionX;
  let y = positionY;
  if (scaledW <= viewportWidth) {
    x = (viewportWidth - scaledW) / 2;
  } else {
    const minX = viewportWidth - scaledW;
    if (x < minX) x = minX;
    else if (x > 0) x = 0;
  }
  if (scaledH <= viewportHeight) {
    y = (viewportHeight - scaledH) / 2;
  } else {
    const minY = viewportHeight - scaledH;
    if (y < minY) y = minY;
    else if (y > 0) y = 0;
  }
  return {
    positionX: x,
    positionY: y,
    changed: x !== positionX || y !== positionY,
  };
}
