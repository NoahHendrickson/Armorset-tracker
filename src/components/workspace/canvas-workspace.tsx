"use client";

import {
  CaretDown,
  Crosshair,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  SquaresFour,
} from "@phosphor-icons/react/dist/ssr";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DraggableEvent } from "react-draggable";
import type { ReactZoomPanPinchContentRef } from "react-zoom-pan-pinch";
import {
  TransformWrapper,
  TransformComponent,
  useTransformEffect,
} from "react-zoom-pan-pinch";
import {
  arrangeLayoutEaseDurationMs,
  TRACKER_DEFAULT_HEIGHT,
  TRACKER_WIDTH,
  trackerWidthForTertiaryColumns,
  WORKSPACE_CANVAS_ELEMENT_ID,
  WORKSPACE_CANVAS_HEIGHT,
  WORKSPACE_CANVAS_WIDTH,
} from "@/lib/workspace/workspace-constants";
import {
  canAttemptMerge,
  pickMergeDropTarget,
} from "@/lib/views/canvas-merge";
import { unionTertiaryStats } from "@/lib/views/merge-compare";
import { mergePreviewUnionPathD } from "@/lib/views/merge-preview-outline";
import { computeWorkspaceMinScale } from "@/lib/workspace/workspace-min-scale";
import { clampWorkspacePan } from "@/lib/workspace/clamp-pan";
import { computeRecenterTranslation } from "@/lib/workspace/recenter-trackers";
import type { SerializableTrackerPayload } from "@/lib/workspace/types";
import {
  arrangePrefsFromPickOrder,
  clusterPickOrderFromArrangePrefs,
  normalizeWorkspaceArrangePrefs,
  parseWorkspaceCamera,
  parseWorkspaceLayout,
  preferredTrackerTopLeftForViewportCenter,
  workspaceCameraPersistPayload,
  WORKSPACE_CLASS_COLUMN_ORDER_OPTIONS,
  WORKSPACE_CLUSTER_DIMENSIONS,
  type WorkspaceArrangePrefsJson,
  type WorkspaceCameraJson,
  type WorkspaceClusterDimension,
  type WorkspaceLayoutJson,
} from "@/lib/workspace/workspace-schema";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import {
  NewTrackerDialog,
  type TrackerFormSelectors,
} from "@/components/workspace/new-tracker-dialog";
import {
  TrackerPanel,
  type TrackerMergeRole,
} from "@/components/workspace/tracker-panel";
import {
  clientPointFromDragEvent,
  computeDragEdgePanFromPointer,
} from "@/components/workspace/canvas-drag-edge-pan";
import { attachCanvasViewportWheel } from "@/components/workspace/canvas-viewport-wheel";
import {
  computeWorkspaceGridLayouts,
  type ArrangeGroupMode,
  type ArrangeSortMode,
} from "@/lib/workspace/workspace-arrange-grid";

type ArrangeRecipe = {
  sort: ArrangeSortMode;
  groupBy: ArrangeGroupMode;
  /** Rows within each primary pillar (requires a primary cluster). */
  groupBySecondary: ArrangeGroupMode | null;
};

type WorkspaceViewportPanZoom = Pick<
  WorkspaceCameraJson,
  "zoom" | "panX" | "panY"
>;

const DEFAULT_ARRANGE: ArrangeRecipe = {
  sort: "canvas_order",
  groupBy: "none",
  groupBySecondary: null,
};

function prefsToArrangeRecipe(prefs: WorkspaceArrangePrefsJson): ArrangeRecipe {
  const p = normalizeWorkspaceArrangePrefs(prefs);
  return {
    sort: DEFAULT_ARRANGE.sort,
    groupBy: (p.primaryCluster ?? "none") as ArrangeGroupMode,
    groupBySecondary: p.secondaryCluster,
  };
}

function clusterDimensionLabel(dim: WorkspaceClusterDimension): string {
  switch (dim) {
    case "class_name":
      return "Class";
    case "armor_set":
      return "Armor set";
    case "archetype":
      return "Archetype";
    case "tuning":
      return "Tuning";
  }
}

function computeNextClusterPicks(
  prev: readonly WorkspaceClusterDimension[],
  dim: WorkspaceClusterDimension,
  checked: boolean,
): WorkspaceClusterDimension[] {
  if (!checked) return [...prev].filter((d) => d !== dim);
  const cur = [...prev];
  if (cur.includes(dim)) return cur;
  if (cur.length < 2) return [...cur, dim];
  /* Keep outer grouping stable; swapping in a third dimension replaces the nested one. */
  return [cur[0]!, dim];
}

function useDebouncedViewport(
  onSave: (c: WorkspaceViewportPanZoom) => void,
  ms: number,
): (c: WorkspaceViewportPanZoom) => void {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = useRef(onSave);
  useEffect(() => {
    cb.current = onSave;
  }, [onSave]);

  return useCallback(
    (slice: WorkspaceViewportPanZoom) => {
      if (t.current) clearTimeout(t.current);
      t.current = setTimeout(() => {
        t.current = null;
        cb.current(slice);
      }, ms);
    },
    [ms],
  );
}

function CameraPersist({
  onDebouncedViewport,
}: {
  onDebouncedViewport: (c: WorkspaceViewportPanZoom) => void;
}) {
  const debounced = useDebouncedViewport(onDebouncedViewport, 450);
  useTransformEffect((refCtx) => {
    debounced({
      zoom: refCtx.state.scale,
      panX: refCtx.state.positionX,
      panY: refCtx.state.positionY,
    });
  });
  return null;
}

function getMergeRole(
  payload: SerializableTrackerPayload,
  list: SerializableTrackerPayload[],
): TrackerMergeRole {
  const mw = payload.view.layout.mergedWith;
  if (!mw) return "solo";
  const partner = list.find((t) => t.view.id === mw);
  if (!partner) return "solo";
  if (payload.view.layout.z > partner.view.layout.z) return "anchor";
  if (payload.view.layout.z < partner.view.layout.z) return "mergedPartner";
  return payload.view.id.localeCompare(partner.view.id) > 0
    ? "anchor"
    : "mergedPartner";
}

/**
 * Renders the tracker layer and tracks the live transform scale. We pass
 * `scale` to each `<TrackerPanel>` (and from there to `<Rnd>`) so that
 * react-draggable can correctly translate screen-space mouse coordinates
 * into canvas-space drag offsets — without it the tracker jumps to the
 * wrong position on mousedown when the canvas is zoomed in/out, since the
 * library divides by `scale` (default 1) when computing the drag origin.
 *
 * Isolated as its own component so re-renders on zoom (~60Hz) don't bubble
 * up and force the entire `CanvasWorkspace` chrome to re-render.
 */
function TrackerLayer({
  trackers,
  hasInventory,
  initialScale,
  onDragPosition,
  onDragLayoutEnd,
  onInteract,
  draggingId,
  mergeDropTargetId,
  mergeDropValid,
  onUnmergeAnchor,
  spawnHighlightId,
  easeLayoutPulse,
}: {
  trackers: SerializableTrackerPayload[];
  hasInventory: boolean;
  initialScale: number;
  onDragPosition: (
    viewId: string,
    x: number,
    y: number,
    dragEvent: DraggableEvent,
  ) => void;
  onDragLayoutEnd: (viewId: string, layout: WorkspaceLayoutJson) => void;
  onInteract: (viewId: string) => void;
  draggingId: string | null;
  mergeDropTargetId: string | null;
  mergeDropValid: boolean;
  onUnmergeAnchor: (anchorViewId: string) => void;
  spawnHighlightId: string | null;
  easeLayoutPulse: { durationMs: number } | null;
}) {
  const [scale, setScale] = useState(initialScale);
  useTransformEffect((ref) => {
    setScale(ref.state.scale);
  });
  return (
    <>
      {trackers.map((t) => {
        const mergeRole = getMergeRole(t, trackers);
        const mw = t.view.layout.mergedWith;
        const mergePartner =
          mw ? trackers.find((p) => p.view.id === mw) ?? null : null;
        const dropHighlight =
          draggingId &&
          mergeDropTargetId === t.view.id &&
          draggingId !== t.view.id
            ? mergeDropValid
              ? "valid"
              : "invalid"
            : "none";
        return (
          <TrackerPanel
            key={t.view.id}
            payload={t}
            hasInventory={hasInventory}
            scale={scale}
            onInteract={onInteract}
            onDragPosition={onDragPosition}
            onDragLayoutEnd={onDragLayoutEnd}
            mergeRole={mergeRole}
            mergePartnerPayload={mergePartner}
            mergeDropHighlight={dropHighlight}
            onUnmerge={
              mergeRole === "anchor" && mergePartner
                ? () => onUnmergeAnchor(t.view.id)
                : undefined
            }
            spawnHighlight={spawnHighlightId === t.view.id}
            easeLayoutPulse={easeLayoutPulse}
          />
        );
      })}
    </>
  );
}

interface CanvasWorkspaceProps {
  className?: string;
  banners?: React.ReactNode;
  initialTrackers: SerializableTrackerPayload[];
  initialCamera: WorkspaceCameraJson;
  focusTrackerId: string | null;
  syncWarning: string | null;
  hasInventory: boolean;
  selectors: TrackerFormSelectors;
}

export function CanvasWorkspace({
  className = "",
  banners,
  initialTrackers,
  initialCamera,
  focusTrackerId,
  syncWarning,
  hasInventory,
  selectors,
}: CanvasWorkspaceProps) {
  const router = useRouter();
  const [trackers, setTrackers] = useState(initialTrackers);
  const [newTrackerOpen, setNewTrackerOpen] = useState(false);
  const twRef = useRef<ReactZoomPanPinchContentRef | null>(null);
  const viewportSurfaceRef = useRef<HTMLDivElement | null>(null);
  const lastFocused = useRef<string | null>(null);
  const [viewportPx, setViewportPx] = useState({ w: 0, h: 0 });
  const [spacePan, setSpacePan] = useState(false);

  const trackersRef = useRef(trackers);
  useEffect(() => {
    trackersRef.current = trackers;
  }, [trackers]);

  const mergeHoverRef = useRef<{ targetId: string | null; valid: boolean }>({
    targetId: null,
    valid: false,
  });

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragLive, setDragLive] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [mergeDropTargetId, setMergeDropTargetId] = useState<string | null>(
    null,
  );
  const [mergeDropValid, setMergeDropValid] = useState(false);
  const [spawnHighlightId, setSpawnHighlightId] = useState<string | null>(null);
  const spawnHighlightTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [easeLayoutPulse, setEaseLayoutPulse] = useState<{
    durationMs: number;
  } | null>(null);

  const workspaceHydrateBootstrap = parseWorkspaceCamera(initialCamera);
  const workspacePersistTimerRef = useRef<number | null>(null);
  const workspaceSnapshotRef = useRef(workspaceHydrateBootstrap);
  const arrangeMenuRecipeRef = useRef<ArrangeRecipe>(
    prefsToArrangeRecipe(workspaceHydrateBootstrap.arrange),
  );

  const [clusterDimPickOrder, setClusterDimPickOrder] = useState<
    WorkspaceClusterDimension[]
  >(() => clusterPickOrderFromArrangePrefs(workspaceHydrateBootstrap.arrange));

  useEffect(() => {
    const cam = parseWorkspaceCamera(initialCamera);
    workspaceSnapshotRef.current = cam;
    const recipe = prefsToArrangeRecipe(cam.arrange);
    arrangeMenuRecipeRef.current = recipe;
    const picks = clusterPickOrderFromArrangePrefs(cam.arrange);
    queueMicrotask(() => {
      setClusterDimPickOrder(picks);
    });
  }, [initialCamera]);

  const scheduleSpawnHighlight = useCallback((viewId: string) => {
    if (spawnHighlightTimeoutRef.current) {
      clearTimeout(spawnHighlightTimeoutRef.current);
      spawnHighlightTimeoutRef.current = null;
    }
    setSpawnHighlightId(viewId);
    spawnHighlightTimeoutRef.current = setTimeout(() => {
      spawnHighlightTimeoutRef.current = null;
      setSpawnHighlightId((cur) => (cur === viewId ? null : cur));
    }, 3500);
  }, []);

  const getPreferredTrackerTopLeft = useCallback(() => {
    const surface = viewportSurfaceRef.current;
    const api = twRef.current;
    if (!surface || !api) return null;
    return preferredTrackerTopLeftForViewportCenter(
      surface.clientWidth,
      surface.clientHeight,
      {
        zoom: api.state.scale,
        panX: api.state.positionX,
        panY: api.state.positionY,
      },
    );
  }, []);

  useEffect(() => {
    return () => {
      if (spawnHighlightTimeoutRef.current) {
        clearTimeout(spawnHighlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!easeLayoutPulse) return;
    const settleMs =
      easeLayoutPulse.durationMs > 1 ? easeLayoutPulse.durationMs + 80 : 0;
    const t = window.setTimeout(() => setEaseLayoutPulse(null), settleMs);
    return () => clearTimeout(t);
  }, [easeLayoutPulse]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resync trackers after router.refresh()
    setTrackers(initialTrackers);
  }, [initialTrackers]);

  const viewportMinScale = useMemo(
    () => computeWorkspaceMinScale(viewportPx.w, viewportPx.h),
    [viewportPx.w, viewportPx.h],
  );

  useEffect(() => {
    const el = viewportSurfaceRef.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setViewportPx((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };

    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    update();

    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = viewportSurfaceRef.current;
    if (!el) return;
    return attachCanvasViewportWheel(
      el,
      () => twRef.current ?? undefined,
      () => computeWorkspaceMinScale(el.clientWidth, el.clientHeight),
    );
  }, []);

  // Figma-style Space+drag: hold space, canvas-pan mode takes precedence over
  // tracker pointer events, cursor becomes grab, and the library handles drag.
  useEffect(() => {
    const shouldSkipSpaceCapture = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        tag === "BUTTON" ||
        tag === "A"
      ) {
        return true;
      }
      if (el.isContentEditable) return true;
      if (el.getAttribute("role") === "button") return true;
      return false;
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      if (shouldSkipSpaceCapture(e.target)) return;
      e.preventDefault();
      setSpacePan(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      setSpacePan(false);
    };
    const blur = () => setSpacePan(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useEffect(() => {
    if (viewportPx.w <= 0 || viewportPx.h <= 0) return;
    const api = twRef.current;
    if (!api?.setTransform) return;
    const lo = viewportMinScale;
    const { scale, positionX, positionY } = api.state;
    const nextScale = scale < lo - 1e-9 ? lo : scale;
    const clamped = clampWorkspacePan({
      positionX,
      positionY,
      scale: nextScale,
      viewportWidth: viewportPx.w,
      viewportHeight: viewportPx.h,
    });
    if (nextScale !== scale || clamped.changed) {
      api.setTransform(clamped.positionX, clamped.positionY, nextScale, 0);
    }
  }, [viewportMinScale, viewportPx.w, viewportPx.h]);

  const persistWorkspaceSnapshotNow = useCallback(async (): Promise<boolean> => {
    if (workspacePersistTimerRef.current !== null) {
      window.clearTimeout(workspacePersistTimerRef.current);
      workspacePersistTimerRef.current = null;
    }
    try {
      const res = await fetch("/api/me/workspace", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          camera: workspaceCameraPersistPayload(workspaceSnapshotRef.current),
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const scheduleWorkspaceSnapshotPersistDebounced = useCallback(() => {
    if (workspacePersistTimerRef.current !== null) {
      window.clearTimeout(workspacePersistTimerRef.current);
    }
    workspacePersistTimerRef.current = window.setTimeout(() => {
      workspacePersistTimerRef.current = null;
      void persistWorkspaceSnapshotNow();
    }, 450);
  }, [persistWorkspaceSnapshotNow]);

  useEffect(() => {
    return () => {
      if (workspacePersistTimerRef.current !== null) {
        window.clearTimeout(workspacePersistTimerRef.current);
      }
    };
  }, []);

  const debouncedPersistViewportSlice = useCallback(
    (slice: WorkspaceViewportPanZoom) => {
      workspaceSnapshotRef.current = {
        ...workspaceSnapshotRef.current,
        ...slice,
      };
      scheduleWorkspaceSnapshotPersistDebounced();
    },
    [scheduleWorkspaceSnapshotPersistDebounced],
  );

  const persistLayoutPatch = useCallback(
    async (viewId: string, layout: WorkspaceLayoutJson) => {
      try {
        const res = await fetch(`/api/views/${viewId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ layout }),
        });
        if (!res.ok) return;
        const body = (await res.json()) as { view?: { layout?: unknown } };
        const lo = body.view?.layout as WorkspaceLayoutJson | undefined;
        if (lo) {
          setTrackers((prev) =>
            prev.map((p) =>
              p.view.id === viewId ? { ...p, view: { ...p.view, layout: lo } } : p,
            ),
          );
        }
      } catch {
        /* non-fatal */
      }
    },
    [],
  );

  const persistTwoLayouts = useCallback(
    async (updates: { id: string; layout: WorkspaceLayoutJson }[]) => {
      if (updates.length === 0) return;
      try {
        const results = await Promise.all(
          updates.map(async ({ id, layout }) => {
            const res = await fetch(`/api/views/${id}`, {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ layout }),
            });
            if (!res.ok) return { id, layout: undefined as WorkspaceLayoutJson | undefined };
            const body = (await res.json()) as { view?: { layout?: unknown } };
            const lo = body.view?.layout as WorkspaceLayoutJson | undefined;
            return { id, layout: lo };
          }),
        );
        if (results.some((r) => !r.layout)) {
          router.refresh();
          return;
        }
        const byId = new Map(results.map((r) => [r.id, r.layout!]));
        setTrackers((prev) =>
          prev.map((p) => {
            const lo = byId.get(p.view.id);
            return lo ? { ...p, view: { ...p.view, layout: lo } } : p;
          }),
        );
      } catch {
        router.refresh();
      }
    },
    [router],
  );

  const handleRecenterWorkspace = useCallback(async () => {
    if (draggingId !== null) return;
    const surface = viewportSurfaceRef.current;
    if (!surface) return;
    const list = trackersRef.current;
    if (list.length === 0) return;

    const positions = list.map((t) => {
      const lo = parseWorkspaceLayout(t.view.layout);
      return { x: lo.x, y: lo.y };
    });

    const { dx, dy } = computeRecenterTranslation(
      positions,
      WORKSPACE_CANVAS_WIDTH,
      WORKSPACE_CANVAS_HEIGHT,
      TRACKER_WIDTH,
      TRACKER_DEFAULT_HEIGHT,
    );

    const layoutChanged =
      Math.abs(dx) > 1e-6 || Math.abs(dy) > 1e-6;

    let updates: { id: string; layout: WorkspaceLayoutJson }[] = [];
    if (layoutChanged) {
      updates = list.map((t) => {
        const lo = parseWorkspaceLayout(t.view.layout);
        return {
          id: t.view.id,
          layout: { ...lo, x: lo.x + dx, y: lo.y + dy },
        };
      });

      const layoutById = new Map(
        updates.map((u): [string, WorkspaceLayoutJson] => [u.id, u.layout]),
      );
      setTrackers((prev) =>
        prev.map((p) => {
          const lo = layoutById.get(p.view.id);
          if (!lo) return p;
          return { ...p, view: { ...p.view, layout: lo } };
        }),
      );
    }

    /*
     * Align viewport center with workspace center `(W/2, H/2)` in content coords.
     * Library convention: `(wrapperMid - positionX) / scale === contentX` at viewport center
     * (see react-zoom-pan-pinch zoom handlers).
     */
    const scale = Math.max(1, viewportMinScale);
    const vw = surface.clientWidth;
    const vh = surface.clientHeight;
    const canvasCx = WORKSPACE_CANVAS_WIDTH / 2;
    const canvasCy = WORKSPACE_CANVAS_HEIGHT / 2;
    const positionX = vw / 2 - scale * canvasCx;
    const positionY = vh / 2 - scale * canvasCy;
    workspaceSnapshotRef.current = {
      ...workspaceSnapshotRef.current,
      zoom: scale,
      panX: positionX,
      panY: positionY,
    };
    twRef.current?.setTransform(positionX, positionY, scale, 260);
    await persistWorkspaceSnapshotNow();

    if (!layoutChanged || updates.length === 0) return;

    const results = await Promise.all(
      updates.map(async ({ id, layout }) => {
        try {
          const res = await fetch(`/api/views/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ layout }),
          });
          return res.ok;
        } catch {
          return false;
        }
      }),
    );

    if (results.some((ok) => !ok)) {
      router.refresh();
    }
  }, [draggingId, viewportMinScale, persistWorkspaceSnapshotNow, router]);

  const handleArrangeGrid = useCallback(
    async (
      opts?: {
        sort?: ArrangeSortMode;
        groupBy?: ArrangeGroupMode;
        groupBySecondary?: ArrangeGroupMode | null;
        adjustViewport?: boolean;
        animateLayouts?: boolean;
      },
    ) => {
      if (draggingId !== null) return;
      const list = trackersRef.current;
      if (list.length === 0) return;

      const sort = opts?.sort ?? arrangeMenuRecipeRef.current.sort;
      const groupBy = opts?.groupBy ?? arrangeMenuRecipeRef.current.groupBy;
      const groupBySecondary =
        opts?.groupBySecondary ?? arrangeMenuRecipeRef.current.groupBySecondary ?? null;

      const adjustViewport = opts?.adjustViewport ?? true;
      const animateLayouts = opts?.animateLayouts === true;

      const usesClassColumns =
        groupBy === "class_name" || groupBySecondary === "class_name";

      const { updates } = computeWorkspaceGridLayouts(list, {
        sort,
        groupBy,
        groupBySecondary,
        classColumnOrder:
          usesClassColumns ?
            [...WORKSPACE_CLASS_COLUMN_ORDER_OPTIONS]
          : undefined,
      });

      if (animateLayouts) {
        const durationMs = arrangeLayoutEaseDurationMs();
        if (durationMs > 1) {
          const pulse = { durationMs };
          flushSync(() => {
            setEaseLayoutPulse(pulse);
          });
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
          });
        }
      }

      const layoutById = new Map(
        updates.map((u): [string, WorkspaceLayoutJson] => [u.id, u.layout]),
      );
      setTrackers((prev) =>
        prev.map((p) => {
          const lo = layoutById.get(p.view.id);
          return lo ? { ...p, view: { ...p.view, layout: lo } } : p;
        }),
      );

      if (adjustViewport) {
        const surface = viewportSurfaceRef.current;
        if (!surface) return;
        const scale = Math.max(1, viewportMinScale);
        const vw = surface.clientWidth;
        const vh = surface.clientHeight;
        const positionX = vw / 2 - scale * (WORKSPACE_CANVAS_WIDTH / 2);
        const positionY = vh / 2 - scale * (WORKSPACE_CANVAS_HEIGHT / 2);
        workspaceSnapshotRef.current = {
          ...workspaceSnapshotRef.current,
          zoom: scale,
          panX: positionX,
          panY: positionY,
        };
        twRef.current?.setTransform(positionX, positionY, scale, 260);
        await persistWorkspaceSnapshotNow();
      }

      const results = await Promise.all(
        updates.map(async ({ id, layout }) => {
          try {
            const res = await fetch(`/api/views/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ layout }),
            });
            return res.ok;
          } catch {
            return false;
          }
        }),
      );
      if (results.some((ok) => !ok)) {
        router.refresh();
      }
    },
    [
      draggingId,
      viewportMinScale,
      persistWorkspaceSnapshotNow,
      router,
    ],
  );

  const commitClusterPickOrder = useCallback(
    (nextPicks: WorkspaceClusterDimension[]) => {
      const prefs = arrangePrefsFromPickOrder(nextPicks);
      const recipe = prefsToArrangeRecipe(prefs);
      arrangeMenuRecipeRef.current = recipe;
      workspaceSnapshotRef.current = {
        ...workspaceSnapshotRef.current,
        arrange: prefs,
      };
      setClusterDimPickOrder(clusterPickOrderFromArrangePrefs(prefs));
      scheduleWorkspaceSnapshotPersistDebounced();
      void handleArrangeGrid({
        sort: recipe.sort,
        groupBy: recipe.groupBy,
        groupBySecondary: recipe.groupBySecondary,
        adjustViewport: false,
        animateLayouts: true,
      });
    },
    [handleArrangeGrid, scheduleWorkspaceSnapshotPersistDebounced],
  );

  const arrangeDisabled =
    trackers.length === 0 || draggingId !== null;

  const onDragPosition = useCallback(
    (viewId: string, x: number, y: number, dragEvent: DraggableEvent) => {
      setEaseLayoutPulse(null);

      const api = twRef.current;
      const surfaceEl = viewportSurfaceRef.current;
      const pt = clientPointFromDragEvent(dragEvent);

      if (api?.setTransform && surfaceEl && pt) {
        const { positionX: px, positionY: py, scale } = api.state;
        const pan = computeDragEdgePanFromPointer({
          pointerX: pt.x,
          pointerY: pt.y,
          viewportRect: surfaceEl.getBoundingClientRect(),
          positionX: px,
          positionY: py,
        });
        if (pan.didPan) {
          const clamped = clampWorkspacePan({
            positionX: pan.positionX,
            positionY: pan.positionY,
            scale,
            viewportWidth: surfaceEl.clientWidth,
            viewportHeight: surfaceEl.clientHeight,
          });
          if (clamped.positionX !== px || clamped.positionY !== py) {
            api.setTransform(clamped.positionX, clamped.positionY, scale, 0);
          }
        }
      }

      setDraggingId(viewId);
      setDragLive({ x, y });
      const current = trackersRef.current;
      const self = current.find((t) => t.view.id === viewId);
      const selfLo = self ? parseWorkspaceLayout(self.view.layout) : null;
      const dragFootprint = selfLo
        ? { w: selfLo.w, h: selfLo.h }
        : { w: TRACKER_WIDTH, h: TRACKER_DEFAULT_HEIGHT };

      const { targetId, valid } = pickMergeDropTarget(
        viewId,
        { x, y, w: dragFootprint.w, h: dragFootprint.h },
        current,
      );
      mergeHoverRef.current = { targetId, valid };
      setMergeDropTargetId(targetId);
      setMergeDropValid(valid);
    },
    [],
  );

  const handleLayoutDragEnd = useCallback(
    (viewId: string, layout: WorkspaceLayoutJson) => {
      mergeHoverRef.current = { targetId: null, valid: false };
      setDraggingId(null);
      setDragLive(null);
      setMergeDropTargetId(null);
      setMergeDropValid(false);

      const current = trackersRef.current;
      const self = current.find((t) => t.view.id === viewId);
      if (!self) return;

      const selfLo = parseWorkspaceLayout(self.view.layout);
      const h = TRACKER_DEFAULT_HEIGHT;
      const normalized: WorkspaceLayoutJson = {
        ...layout,
        h,
      };

      const mergePick = pickMergeDropTarget(
        viewId,
        {
          x: normalized.x,
          y: normalized.y,
          w: normalized.w,
          h: normalized.h,
        },
        current,
      );

      if (
        mergePick.targetId &&
        mergePick.valid &&
        mergePick.targetId !== viewId &&
        (normalized.mergedWith ?? selfLo.mergedWith ?? null) !==
          mergePick.targetId
      ) {
        const tgt = current.find((t) => t.view.id === mergePick.targetId);
        if (!tgt || !canAttemptMerge(self, tgt)) {
          void persistLayoutPatch(viewId, normalized);
          return;
        }
        const maxZ = current.length
          ? Math.max(...current.map((t) => t.view.layout.z))
          : 0;
        const tgtLo = parseWorkspaceLayout(tgt.view.layout);
        const snapX = tgtLo.x;
        const snapY = tgtLo.y;
        const mergedW = trackerWidthForTertiaryColumns(
          unionTertiaryStats(self, tgt).length,
        );
        const sourceLayout: WorkspaceLayoutJson = {
          ...selfLo,
          x: snapX,
          y: snapY,
          w: mergedW,
          h,
          z: maxZ + 2,
          mergedWith: tgt.view.id,
        };
        const targetLayout: WorkspaceLayoutJson = {
          ...tgtLo,
          x: snapX,
          y: snapY,
          w: mergedW,
          h,
          z: maxZ + 1,
          mergedWith: self.view.id,
        };
        setTrackers((prev) =>
          prev.map((p) => {
            if (p.view.id === self.view.id) {
              return { ...p, view: { ...p.view, layout: sourceLayout } };
            }
            if (p.view.id === tgt.view.id) {
              return { ...p, view: { ...p.view, layout: targetLayout } };
            }
            return p;
          }),
        );
        void persistTwoLayouts([
          { id: self.view.id, layout: sourceLayout },
          { id: tgt.view.id, layout: targetLayout },
        ]);
        return;
      }

      const partnerId =
        (normalized.mergedWith ?? selfLo.mergedWith) ?? null;
      if (partnerId) {
        const partner = current.find((t) => t.view.id === partnerId);
        if (partner) {
          const partnerLo = parseWorkspaceLayout(partner.view.layout);
          const nextSelf: WorkspaceLayoutJson = {
            ...normalized,
            mergedWith: partnerId,
          };
          const nextPartner: WorkspaceLayoutJson = {
            ...partnerLo,
            x: normalized.x,
            y: normalized.y,
            w: normalized.w,
            h,
            mergedWith: viewId,
          };
          setTrackers((prev) =>
            prev.map((p) => {
              if (p.view.id === viewId) {
                return { ...p, view: { ...p.view, layout: nextSelf } };
              }
              if (p.view.id === partnerId) {
                return { ...p, view: { ...p.view, layout: nextPartner } };
              }
              return p;
            }),
          );
          void persistTwoLayouts([
            { id: viewId, layout: nextSelf },
            { id: partnerId, layout: nextPartner },
          ]);
          return;
        }
      }

      void persistLayoutPatch(viewId, normalized);
    },
    [persistLayoutPatch, persistTwoLayouts],
  );

  const handleUnmergeAnchor = useCallback(
    (anchorViewId: string) => {
      const current = trackersRef.current;
      const anchor = current.find((t) => t.view.id === anchorViewId);
      const partnerId = anchor?.view.layout.mergedWith;
      if (!anchor || !partnerId) return;
      const partner = current.find((t) => t.view.id === partnerId);
      if (!partner) return;
      const nudge = 40;
      const anchorLo = parseWorkspaceLayout(anchor.view.layout);
      const partnerLo = parseWorkspaceLayout(partner.view.layout);
      const nextAnchor: WorkspaceLayoutJson = {
        ...anchorLo,
        mergedWith: null,
        w: TRACKER_WIDTH,
        h: TRACKER_DEFAULT_HEIGHT,
      };
      const nextPartner: WorkspaceLayoutJson = {
        ...partnerLo,
        x: partnerLo.x + nudge,
        y: partnerLo.y + nudge,
        mergedWith: null,
        w: TRACKER_WIDTH,
        h: TRACKER_DEFAULT_HEIGHT,
      };
      setTrackers((prev) =>
        prev.map((p) => {
          if (p.view.id === anchorViewId) {
            return { ...p, view: { ...p.view, layout: nextAnchor } };
          }
          if (p.view.id === partnerId) {
            return { ...p, view: { ...p.view, layout: nextPartner } };
          }
          return p;
        }),
      );
      void persistTwoLayouts([
        { id: anchorViewId, layout: nextAnchor },
        { id: partnerId, layout: nextPartner },
      ]);
    },
    [persistTwoLayouts],
  );

  const mergePreviewPath = useMemo(() => {
    if (!draggingId || !dragLive || !mergeDropTargetId) return null;
    const tgt = trackers.find((t) => t.view.id === mergeDropTargetId);
    if (!tgt) return null;
    const d = mergePreviewUnionPathD(
      dragLive.x,
      dragLive.y,
      tgt.view.layout.x,
      tgt.view.layout.y,
      TRACKER_WIDTH,
      TRACKER_DEFAULT_HEIGHT,
      14,
    );
    if (!d) return null;
    return { d, valid: mergeDropValid };
  }, [dragLive, draggingId, mergeDropTargetId, mergeDropValid, trackers]);

  const handleInteract = useCallback(
    (viewId: string) => {
      setTrackers((prev) => {
        const maxZ = prev.length
          ? Math.max(...prev.map((t) => t.view.layout.z))
          : 0;
        const target = prev.find((t) => t.view.id === viewId);
        if (!target) return prev;

        const targetLo = parseWorkspaceLayout(target.view.layout);
        const pid = targetLo.mergedWith ?? null;
        if (pid) {
          const partner = prev.find((t) => t.view.id === pid);
          if (!partner) return prev;
          const partnerLo = parseWorkspaceLayout(partner.view.layout);
          const topZ = Math.max(targetLo.z, partnerLo.z);
          if (topZ >= maxZ) return prev;
          const nextSelf: WorkspaceLayoutJson = {
            ...targetLo,
            z: maxZ + 2,
          };
          const nextPartner: WorkspaceLayoutJson = {
            ...partnerLo,
            z: maxZ + 1,
          };
          void persistTwoLayouts([
            { id: viewId, layout: nextSelf },
            { id: pid, layout: nextPartner },
          ]);
          return prev.map((p) => {
            if (p.view.id === viewId)
              return { ...p, view: { ...p.view, layout: nextSelf } };
            if (p.view.id === pid)
              return { ...p, view: { ...p.view, layout: nextPartner } };
            return p;
          });
        }

        if (targetLo.z >= maxZ) return prev;
        const nextLayout: WorkspaceLayoutJson = {
          x: targetLo.x,
          y: targetLo.y,
          w: targetLo.w,
          h: targetLo.h,
          z: maxZ + 1,
          mergedWith: targetLo.mergedWith ?? null,
        };
        void persistLayoutPatch(viewId, nextLayout);
        return prev.map((p) =>
          p.view.id === viewId
            ? { ...p, view: { ...p.view, layout: nextLayout } }
            : p,
        );
      });
    },
    [persistLayoutPatch, persistTwoLayouts],
  );

  useEffect(() => {
    if (!focusTrackerId) {
      lastFocused.current = null;
      return;
    }
    if (lastFocused.current === focusTrackerId) return;

    const rid = window.requestAnimationFrame(() => {
      const api = twRef.current;
      const el = document.getElementById(`tracker-${focusTrackerId}`);
      if (!api?.zoomToElement || !el) return;
      api.zoomToElement(el, 1.05, 280);
      handleInteract(focusTrackerId);
      lastFocused.current = focusTrackerId;
      router.replace("/dashboard");
    });

    return () => cancelAnimationFrame(rid);
  }, [focusTrackerId, handleInteract, router]);

  const hasTopMessage = Boolean(banners) || Boolean(syncWarning);

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      {hasTopMessage ? (
        <div className="shrink-0 pt-[76px]">
          {banners ? (
            <div className="space-y-2 border-b border-border bg-background px-4 py-3 sm:px-6">
              {banners}
            </div>
          ) : null}
          {syncWarning ? (
            <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 sm:px-6">
              <p role="alert" className="text-sm text-destructive">
                {syncWarning}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className={`relative min-h-0 flex-1 overflow-hidden bg-[#1a1b1b] ${
          spacePan ? "canvas-space-pan" : ""
        }`}
      >
        {/* Library wheel/trackpad routing is unreliable on Safari pinch; viewport wheel handled in attachCanvasViewportWheel (capture phase). */}
        <TransformWrapper
          ref={twRef}
          initialScale={initialCamera.zoom}
          initialPositionX={initialCamera.panX}
          initialPositionY={initialCamera.panY}
          minScale={viewportMinScale}
          maxScale={6}
          limitToBounds={true}
          centerZoomedOut={false}
          smooth={false}
          panning={{
            // Kinetic release — short glide after flick-pans feels like Figma.
            velocityDisabled: false,
            // Middle-click always pans, even over trackers. Space+drag is
            // handled via the `.canvas-space-pan` class lifting pointer events.
            allowMiddleClickPan: true,
            // NOTE: library's isExcludedNode builds selectors like
            // `.react-transform-wrapper .{exclude}` internally — pass the
            // class name without a leading dot to avoid a `..rnd-tracker`
            // SyntaxError that breaks pan/zoom throughout the canvas.
            excluded: ["rnd-tracker"],
          }}
          velocityAnimation={{
            sensitivityMouse: 0.6,
            animationTime: 260,
            animationType: "easeOutQuad",
          }}
          trackPadPanning={{ disabled: true }}
          pinch={{ disabled: false, step: 3 }}
          wheel={{ disabled: true }}
          doubleClick={{ mode: "reset" }}
        >
          <CameraPersist onDebouncedViewport={debouncedPersistViewportSlice} />
          <div
            ref={viewportSurfaceRef}
            className="canvas-viewport-surface relative h-full w-full"
          >
            <TransformComponent
              infinite
              wrapperStyle={{ width: "100%", height: "100%" }}
            >
              <div
                id={WORKSPACE_CANVAS_ELEMENT_ID}
                className="workspace-canvas-bounds relative"
                style={{
                  width: WORKSPACE_CANVAS_WIDTH,
                  height: WORKSPACE_CANVAS_HEIGHT,
                  position: "relative",
                }}
              >
                <svg
                  className="workspace-canvas-edge-overlay absolute left-0 top-0"
                  width={WORKSPACE_CANVAS_WIDTH}
                  height={WORKSPACE_CANVAS_HEIGHT}
                  aria-hidden
                >
                  <rect
                    x={0.5}
                    y={0.5}
                    width={WORKSPACE_CANVAS_WIDTH - 1}
                    height={WORKSPACE_CANVAS_HEIGHT - 1}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1}
                  />
                </svg>
                {mergePreviewPath ? (
                  <svg
                    className="pointer-events-none absolute left-0 top-0 overflow-visible"
                    width={WORKSPACE_CANVAS_WIDTH}
                    height={WORKSPACE_CANVAS_HEIGHT}
                    style={{ zIndex: 999998 }}
                    aria-hidden
                  >
                    <path
                      d={mergePreviewPath.d}
                      fill="none"
                      stroke={
                        mergePreviewPath.valid ? "#00FF85" : "rgb(248 113 113)"
                      }
                      strokeWidth={4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
                <TrackerLayer
                  trackers={trackers}
                  hasInventory={hasInventory}
                  initialScale={initialCamera.zoom}
                  onDragPosition={onDragPosition}
                  onDragLayoutEnd={handleLayoutDragEnd}
                  onInteract={handleInteract}
                  draggingId={draggingId}
                  mergeDropTargetId={mergeDropTargetId}
                  mergeDropValid={mergeDropValid}
                  onUnmergeAnchor={handleUnmergeAnchor}
                  spawnHighlightId={spawnHighlightId}
                  easeLayoutPulse={easeLayoutPulse}
                />
              </div>
            </TransformComponent>

            {trackers.length === 0 ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8">
                <div className="flex max-w-lg flex-col items-center text-center">
                  <p className="text-[20px] font-normal leading-normal tracking-tight text-white">
                    Welcome to ASB+TT
                  </p>
                  <p className="mt-2 max-w-xl text-sm font-normal leading-snug text-white/50">
                    Create a tracker by class, armor set, archetype, and tuning.
                  </p>
                </div>
              </div>
            ) : null}

            {/* Zoom + recenter — bottom right */}
            <div className="pointer-events-none absolute bottom-6 right-6 z-30 flex gap-2">
              <div className="pointer-events-auto flex h-12 shrink-0 overflow-hidden rounded-none border border-white/10 bg-[#2d2e32] shadow-lg">
                <button
                  type="button"
                  aria-label="Arrange trackers in a 5-column grid (canvas order)"
                  disabled={arrangeDisabled}
                  onClick={() => void handleArrangeGrid()}
                  className="flex h-12 w-12 shrink-0 items-center justify-center text-white/80 transition-colors hover:bg-[#3a3b3f] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-60"
                >
                  <SquaresFour className="h-5 w-5" weight="duotone" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Canvas clustering options"
                      title="Choose how trackers group on the canvas"
                      disabled={arrangeDisabled}
                      className="flex h-12 w-9 shrink-0 items-center justify-center border-l border-white/15 text-white/80 transition-colors hover:bg-[#3a3b3f] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-60 data-[state=open]:bg-[#3a3b3f] data-[state=open]:text-white"
                    >
                      <CaretDown className="h-4 w-4" weight="bold" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    side="top"
                    sideOffset={8}
                    className="min-w-[14rem] rounded-none border border-white/15 bg-[#2d2e32] py-2 text-white shadow-xl"
                  >
                    <DropdownMenuLabel className="max-w-[16rem] px-3 pb-2 pt-1.5 text-xs font-normal leading-snug text-white/65">
                      Pick up to two: first groups the workspace, second nests inside
                      each group.
                    </DropdownMenuLabel>
                    {WORKSPACE_CLUSTER_DIMENSIONS.map((dim) => (
                      <DropdownMenuCheckboxItem
                        key={dim}
                        disabled={arrangeDisabled}
                        checked={clusterDimPickOrder.includes(dim)}
                        onSelect={(e) => {
                          /* Keep menu open so both cluster picks can be toggled without reopening */
                          e.preventDefault();
                        }}
                        onCheckedChange={(c) => {
                          const next = computeNextClusterPicks(
                            clusterDimPickOrder,
                            dim,
                            c,
                          );
                          commitClusterPickOrder(next);
                        }}
                        className="rounded-none text-white focus:bg-white/10 focus:text-white data-[highlighted]:bg-white/10 [&_span.absolute.left-2]:text-white"
                      >
                        {clusterDimensionLabel(dim)}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <button
                type="button"
                aria-label="Recenter workspace and trackers"
                disabled={trackers.length === 0 || draggingId !== null}
                onClick={() => void handleRecenterWorkspace()}
                className="pointer-events-auto flex h-12 w-12 shrink-0 items-center justify-center border border-white/10 bg-[#2d2e32] text-white/80 shadow-lg transition-colors hover:bg-[#3a3b3f] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-60"
              >
                <Crosshair className="h-5 w-5" weight="duotone" />
              </button>
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => twRef.current?.zoomOut(0.2)}
                className="pointer-events-auto flex h-12 w-12 shrink-0 items-center justify-center border border-white/10 bg-[#2d2e32] text-white/80 shadow-lg transition-colors hover:bg-[#3a3b3f] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-60"
              >
                <MagnifyingGlassMinus className="h-5 w-5" weight="duotone" />
              </button>
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => twRef.current?.zoomIn(0.2)}
                className="pointer-events-auto flex h-12 w-12 shrink-0 items-center justify-center border border-white/10 bg-[#2d2e32] text-white/80 shadow-lg transition-colors hover:bg-[#3a3b3f] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-60"
              >
                <MagnifyingGlassPlus className="h-5 w-5" weight="duotone" />
              </button>
            </div>

            {/* Sticky primary action — bottom-center of the canvas */}
            <div className="pointer-events-none absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 gap-2">
              <NewTrackerDialog
                open={newTrackerOpen}
                onOpenChange={setNewTrackerOpen}
                trackers={trackers}
                selectors={selectors}
                onCreated={(tracker) => {
                  if (tracker) {
                    setTrackers((prev) =>
                      prev.some((t) => t.view.id === tracker.view.id)
                        ? prev
                        : [...prev, tracker],
                    );
                    scheduleSpawnHighlight(tracker.view.id);
                  } else {
                    router.refresh();
                  }
                }}
                getPreferredTrackerTopLeft={getPreferredTrackerTopLeft}
              />
              <div className="pointer-events-auto">
                <RefreshButton variant="fab" />
              </div>
            </div>
          </div>
        </TransformWrapper>
      </div>

    </div>
  );
}
