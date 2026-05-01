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
