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

/** Destiny class labels aligned with `{@link CLASS_NAMES}` keys 0–2. */
export const WORKSPACE_CLASS_COLUMN_ORDER_OPTIONS = [
  "Titan",
  "Hunter",
  "Warlock",
] as const;

export type WorkspaceClassColumnOrderKey =
  (typeof WORKSPACE_CLASS_COLUMN_ORDER_OPTIONS)[number];

export const WORKSPACE_CLUSTER_DIMENSIONS = [
  "class_name",
  "armor_set",
  "archetype",
  "tuning",
] as const;

export type WorkspaceClusterDimension =
  (typeof WORKSPACE_CLUSTER_DIMENSIONS)[number];

const CLUSTER_DIM_SET = new Set<string>(
  WORKSPACE_CLUSTER_DIMENSIONS as unknown as string[],
);

const workspaceClusterDimensionSchema = z.enum([
  WORKSPACE_CLUSTER_DIMENSIONS[0],
  WORKSPACE_CLUSTER_DIMENSIONS[1],
  WORKSPACE_CLUSTER_DIMENSIONS[2],
  WORKSPACE_CLUSTER_DIMENSIONS[3],
]);

/** Persisted cluster menu: outer group + optional nested group (`users.workspace_camera.arrange`). */
export const workspaceArrangePrefsSchema = z.object({
  primaryCluster: workspaceClusterDimensionSchema.nullable(),
  secondaryCluster: workspaceClusterDimensionSchema.nullable(),
});

export type WorkspaceArrangePrefsJson = z.infer<
  typeof workspaceArrangePrefsSchema
>;

export function defaultWorkspaceArrangePrefs(): WorkspaceArrangePrefsJson {
  return {
    primaryCluster: null,
    secondaryCluster: null,
  };
}

/** Coerce duplicates, cleared secondary without primary, and invalid enums. */
export function normalizeWorkspaceArrangePrefs(
  prefs: WorkspaceArrangePrefsJson,
): WorkspaceArrangePrefsJson {
  let primaryCluster: WorkspaceClusterDimension | null = prefs.primaryCluster;
  let secondaryCluster: WorkspaceClusterDimension | null = prefs.secondaryCluster;
  if (primaryCluster !== null && !CLUSTER_DIM_SET.has(primaryCluster)) {
    primaryCluster = null;
  }
  if (secondaryCluster !== null && !CLUSTER_DIM_SET.has(secondaryCluster)) {
    secondaryCluster = null;
  }
  if (primaryCluster === null) secondaryCluster = null;
  else if (
    secondaryCluster !== null &&
    secondaryCluster === primaryCluster
  ) {
    secondaryCluster = null;
  }
  return { primaryCluster, secondaryCluster };
}

/** Merge legacy `{ clusterByClass, … }` or parse new `{ primaryCluster, secondaryCluster }`. */
function migrateLegacyWorkspaceArrange(raw: unknown): WorkspaceArrangePrefsJson {
  if (raw === null || typeof raw !== "object") {
    return normalizeWorkspaceArrangePrefs(defaultWorkspaceArrangePrefs());
  }
  const obj = raw as Record<string, unknown>;

  if ("clusterByClass" in obj) {
    const clusterByClass = obj.clusterByClass === true;
    const legacySec = normalizeLegacySecondaryCluster(obj.secondaryCluster);
    if (!clusterByClass) {
      return normalizeWorkspaceArrangePrefs({
        primaryCluster: null,
        secondaryCluster: null,
      });
    }
    return normalizeWorkspaceArrangePrefs({
      primaryCluster: "class_name",
      secondaryCluster: legacySec,
    });
  }

  const parsed = workspaceArrangePrefsSchema.safeParse({
    primaryCluster: obj.primaryCluster ?? null,
    secondaryCluster: obj.secondaryCluster ?? null,
  });
  if (parsed.success) {
    return normalizeWorkspaceArrangePrefs(parsed.data);
  }
  return normalizeWorkspaceArrangePrefs(defaultWorkspaceArrangePrefs());
}

function normalizeLegacySecondaryCluster(raw: unknown): WorkspaceClusterDimension | null {
  if (raw === null || raw === undefined) return null;
  const p = z
    .enum(["tuning", "armor_set", "archetype"])
    .safeParse(raw);
  return p.success ? p.data : null;
}

export function clusterPickOrderFromArrangePrefs(
  prefs: WorkspaceArrangePrefsJson,
): WorkspaceClusterDimension[] {
  const p = normalizeWorkspaceArrangePrefs(prefs);
  const out: WorkspaceClusterDimension[] = [];
  if (p.primaryCluster !== null) out.push(p.primaryCluster);
  if (p.secondaryCluster !== null) out.push(p.secondaryCluster);
  return out;
}

export function arrangePrefsFromPickOrder(
  picks: readonly WorkspaceClusterDimension[],
): WorkspaceArrangePrefsJson {
  const seen = new Set<WorkspaceClusterDimension>();
  const uniq: WorkspaceClusterDimension[] = [];
  for (const dim of picks) {
    if (!CLUSTER_DIM_SET.has(dim) || seen.has(dim)) continue;
    seen.add(dim);
    uniq.push(dim);
    if (uniq.length === 2) break;
  }
  return normalizeWorkspaceArrangePrefs({
    primaryCluster: uniq[0] ?? null,
    secondaryCluster: uniq[1] ?? null,
  });
}

/** Pan/zoom from `users.workspace_camera` (aligned with react-zoom-pan-pinch semantics). */
export const workspaceCameraSchema = z.object({
  zoom: z.number().positive().max(8).min(0.05),
  panX: z.number().finite(),
  panY: z.number().finite(),
  arrange: workspaceArrangePrefsSchema.optional(),
});

/** Full camera blob after parse normalization (always includes `arrange`). */
export type WorkspaceCameraJson = {
  zoom: number;
  panX: number;
  panY: number;
  arrange: WorkspaceArrangePrefsJson;
};

export const defaultWorkspaceCamera = (): WorkspaceCameraJson => ({
  zoom: 1,
  panX: 0,
  panY: 0,
  arrange: defaultWorkspaceArrangePrefs(),
});

export function parseWorkspaceLayout(raw: unknown): WorkspaceLayoutJson {
  const parsed = workspaceLayoutSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return defaultWorkspaceLayout();
}

export function parseWorkspaceCamera(raw: unknown): WorkspaceCameraJson {
  if (raw === null || typeof raw !== "object") {
    return defaultWorkspaceCamera();
  }
  const o = raw as Record<string, unknown>;
  const fallback = defaultWorkspaceCamera();
  const zoom = workspaceCameraSchema.shape.zoom.safeParse(o.zoom).success
    ? (o.zoom as number)
    : fallback.zoom;
  const panX = workspaceCameraSchema.shape.panX.safeParse(o.panX).success
    ? (o.panX as number)
    : fallback.panX;
  const panY = workspaceCameraSchema.shape.panY.safeParse(o.panY).success
    ? (o.panY as number)
    : fallback.panY;

  const arrange = migrateLegacyWorkspaceArrange(o.arrange);

  return {
    zoom,
    panX,
    panY,
    arrange,
  };
}

/** Stripped blob for PATCH `/api/me/workspace`: core fields Supabase persists. */
export function workspaceCameraPersistPayload(cam: WorkspaceCameraJson): z.infer<
  typeof workspaceCameraSchema
> {
  return {
    zoom: cam.zoom,
    panX: cam.panX,
    panY: cam.panY,
    arrange: cam.arrange,
  };
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
