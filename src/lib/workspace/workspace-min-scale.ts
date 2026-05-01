import {
  WORKSPACE_CANVAS_HEIGHT,
  WORKSPACE_CANVAS_WIDTH,
} from "@/lib/workspace/workspace-constants";

const FALLBACK_MIN = 0.1;

/**
 * Smallest zoom so the scaled canvas still covers the viewport (short side fits;
 * excess on the long side clips). Zooming below this exposes empty canvas margin.
 */
export function computeWorkspaceMinScale(
  viewportWidth: number,
  viewportHeight: number,
  canvasWidth = WORKSPACE_CANVAS_WIDTH,
  canvasHeight = WORKSPACE_CANVAS_HEIGHT,
): number {
  if (
    viewportWidth <= 0 ||
    viewportHeight <= 0 ||
    canvasWidth <= 0 ||
    canvasHeight <= 0
  ) {
    return FALLBACK_MIN;
  }
  return Math.max(viewportWidth / canvasWidth, viewportHeight / canvasHeight);
}
