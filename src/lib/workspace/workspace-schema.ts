import { z } from "zod";
import {
  TRACKER_DEFAULT_HEIGHT,
  TRACKER_WIDTH,
  WORKSPACE_CANVAS_HEIGHT,
  WORKSPACE_CANVAS_WIDTH,
} from "@/lib/workspace/workspace-constants";

/** Canvas geometry for one tracker (`views.layout`). */
export const workspaceLayoutSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  w: z.number().positive().max(2000),
  h: z.number().positive().max(2000),
  /** Stacking order; larger appears on top. */
  z: z.number().int().min(0).max(1_000_000),
  /**
   * When set, this tracker is merged with exactly one partner (`views.id`).
   * Must be symmetric: if A.mergedWith === B then B.mergedWith === A.
   */
  mergedWith: z.string().uuid().nullable().optional(),
});

export type WorkspaceLayoutJson = z.infer<typeof workspaceLayoutSchema>;

export const defaultWorkspaceLayout = (): WorkspaceLayoutJson => ({
  x: 48,
  y: 48,
  w: TRACKER_WIDTH,
  h: TRACKER_DEFAULT_HEIGHT,
  z: 0,
});

/** Pan/zoom from `users.workspace_camera` (aligned with react-zoom-pan-pinch semantics). */
export const workspaceCameraSchema = z.object({
  zoom: z.number().positive().max(8).min(0.05),
  panX: z.number().finite(),
  panY: z.number().finite(),
});

export type WorkspaceCameraJson = z.infer<typeof workspaceCameraSchema>;

export const defaultWorkspaceCamera = (): WorkspaceCameraJson => ({
  zoom: 1,
  panX: 0,
  panY: 0,
});

export function parseWorkspaceLayout(raw: unknown): WorkspaceLayoutJson {
  const parsed = workspaceLayoutSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return defaultWorkspaceLayout();
}

export function parseWorkspaceCamera(raw: unknown): WorkspaceCameraJson {
  if (raw === null || raw === undefined) {
    return defaultWorkspaceCamera();
  }
  const parsed = workspaceCameraSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return defaultWorkspaceCamera();
}

/** Next tracker anchored near workspace center (`z` is caller-managed). */
export function centeredTrackerLayout(z: number): WorkspaceLayoutJson {
  return {
    x: WORKSPACE_CANVAS_WIDTH / 2 - TRACKER_WIDTH / 2,
    y: WORKSPACE_CANVAS_HEIGHT / 2 - TRACKER_DEFAULT_HEIGHT / 2,
    w: TRACKER_WIDTH,
    h: TRACKER_DEFAULT_HEIGHT,
    z,
  };
}

const PLACE_STEP = 48;
const PLACE_OVERLAP_GAP = 8;
const CANVAS_EDGE_MARGIN = 8;

function rectsOverlapWithGap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  gap: number,
): boolean {
  return (
    a.x < b.x + b.w + gap &&
    a.x + a.w + gap > b.x &&
    a.y < b.y + b.h + gap &&
    a.y + a.h + gap > b.y
  );
}

function clampTrackerXY(
  x: number,
  y: number,
  w: number,
  h: number,
): { x: number; y: number } {
  return {
    x: Math.max(
      CANVAS_EDGE_MARGIN,
      Math.min(x, WORKSPACE_CANVAS_WIDTH - w - CANVAS_EDGE_MARGIN),
    ),
    y: Math.max(
      CANVAS_EDGE_MARGIN,
      Math.min(y, WORKSPACE_CANVAS_HEIGHT - h - CANVAS_EDGE_MARGIN),
    ),
  };
}

/**
 * Top-left for a default-size tracker whose frame is centered on the viewport
 * center (canvas coordinates). Matches react-zoom-pan-pinch: at the middle of
 * the transform wrapper, content x is `(viewportMidX - panX) / zoom`.
 */
export function preferredTrackerTopLeftForViewportCenter(
  viewportWidth: number,
  viewportHeight: number,
  camera: { zoom: number; panX: number; panY: number },
): { x: number; y: number } {
  const { zoom: scale, panX, panY } = camera;
  if (viewportWidth <= 0 || viewportHeight <= 0 || !(scale > 0)) {
    const o = centeredTrackerLayout(0);
    return { x: o.x, y: o.y };
  }
  const cx = (viewportWidth / 2 - panX) / scale;
  const cy = (viewportHeight / 2 - panY) / scale;
  return clampTrackerXY(
    cx - TRACKER_WIDTH / 2,
    cy - TRACKER_DEFAULT_HEIGHT / 2,
    TRACKER_WIDTH,
    TRACKER_DEFAULT_HEIGHT,
  );
}

/**
 * Same defaults as {@link centeredTrackerLayout}, but shifts x/y (in rings
 * around center) until the rect does not overlap existing tracker bounds.
 */
export function layoutForNewTrackerAvoidingOverlap(
  z: number,
  existingRects: readonly { x: number; y: number; w: number; h: number }[],
  options?: {
    /** Clamped to canvas; ring search still avoids overlaps. */
    preferredTopLeft?: { x: number; y: number };
  },
): WorkspaceLayoutJson {
  const template = centeredTrackerLayout(z);
  const seed = options?.preferredTopLeft
    ? clampTrackerXY(
        options.preferredTopLeft.x,
        options.preferredTopLeft.y,
        template.w,
        template.h,
      )
    : { x: template.x, y: template.y };
  const base: WorkspaceLayoutJson = {
    ...template,
    x: seed.x,
    y: seed.y,
    z,
  };
  const candidateRect = (cx: number, cy: number) => ({
    x: cx,
    y: cy,
    w: base.w,
    h: base.h,
  });

  const hitsExisting = (cx: number, cy: number) => {
    const r = candidateRect(cx, cy);
    return existingRects.some((b) =>
      rectsOverlapWithGap(r, b, PLACE_OVERLAP_GAP),
    );
  };

  const tryXY = (cx: number, cy: number): WorkspaceLayoutJson | null => {
    const { x, y } = clampTrackerXY(cx, cy, base.w, base.h);
    if (hitsExisting(x, y)) return null;
    return { ...base, x, y, z };
  };

  const centered = tryXY(base.x, base.y);
  if (centered) return centered;

  for (let n = 1; n <= 48; n++) {
    const d = n * PLACE_STEP;
    const offsets: [number, number][] = [
      [d, 0],
      [-d, 0],
      [0, d],
      [0, -d],
      [d, d],
      [-d, d],
      [d, -d],
      [-d, -d],
    ];
    for (const [ox, oy] of offsets) {
      const placed = tryXY(base.x + ox, base.y + oy);
      if (placed) return placed;
    }
  }

  const stair = existingRects.length;
  const { x, y } = clampTrackerXY(
    base.x + (stair * 36) % 480,
    base.y + Math.floor((stair * 36) / 480) * 36,
    base.w,
    base.h,
  );
  return { ...base, x, y, z };
}
