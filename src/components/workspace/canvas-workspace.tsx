"use client";

import {
  Crosshair,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
} from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactZoomPanPinchContentRef } from "react-zoom-pan-pinch";
import {
  TransformWrapper,
  TransformComponent,
  useTransformEffect,
} from "react-zoom-pan-pinch";
import {
  TRACKER_DEFAULT_HEIGHT,
  TRACKER_WIDTH,
  WORKSPACE_CANVAS_ELEMENT_ID,
  WORKSPACE_CANVAS_HEIGHT,
  WORKSPACE_CANVAS_WIDTH,
} from "@/lib/workspace/workspace-constants";
import { canAttemptMerge, MERGE_OVERLAP_TRIGGER_RATIO, mergeOverlapRatio } from "@/lib/views/canvas-merge";
import { mergePreviewUnionPathD } from "@/lib/views/merge-preview-outline";
import { computeWorkspaceMinScale } from "@/lib/workspace/workspace-min-scale";
import { computeRecenterTranslation } from "@/lib/workspace/recenter-trackers";
import type { SerializableTrackerPayload } from "@/lib/workspace/types";
import {
  parseWorkspaceLayout,
  type WorkspaceCameraJson,
  type WorkspaceLayoutJson,
} from "@/lib/workspace/workspace-schema";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import {
  NewTrackerDialog,
  type TrackerFormSelectors,
} from "@/components/workspace/new-tracker-dialog";
import {
  TrackerPanel,
  type TrackerMergeRole,
} from "@/components/workspace/tracker-panel";
import { attachCanvasViewportWheel } from "@/components/workspace/canvas-viewport-wheel";

function useDebouncedCamera(
  onSave: (c: WorkspaceCameraJson) => void,
  ms: number,
): (c: WorkspaceCameraJson) => void {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = useRef(onSave);
  useEffect(() => {
    cb.current = onSave;
  }, [onSave]);

  return useCallback(
    (cam: WorkspaceCameraJson) => {
      if (t.current) clearTimeout(t.current);
      t.current = setTimeout(() => {
        t.current = null;
        cb.current(cam);
      }, ms);
    },
    [ms],
  );
}

function CameraPersist({
  onDebouncedCamera,
}: {
  onDebouncedCamera: (c: WorkspaceCameraJson) => void;
}) {
  const debounced = useDebouncedCamera(onDebouncedCamera, 450);
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
}: {
  trackers: SerializableTrackerPayload[];
  hasInventory: boolean;
  initialScale: number;
  onDragPosition: (viewId: string, x: number, y: number) => void;
  onDragLayoutEnd: (viewId: string, layout: WorkspaceLayoutJson) => void;
  onInteract: (viewId: string) => void;
  draggingId: string | null;
  mergeDropTargetId: string | null;
  mergeDropValid: boolean;
  onUnmergeAnchor: (anchorViewId: string) => void;
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
    if (viewportPx.w <= 0) return;
    const api = twRef.current;
    if (!api?.setTransform) return;
    const lo = viewportMinScale;
    const { scale, positionX, positionY } = api.state;
    if (scale < lo - 1e-9) {
      api.setTransform(positionX, positionY, lo, 0);
    }
  }, [viewportMinScale, viewportPx.w]);
  const persistCamera = useCallback(async (camera: WorkspaceCameraJson) => {
    try {
      await fetch("/api/me/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ camera }),
      });
    } catch {
      /* non-fatal */
    }
  }, []);

  const persistLayoutPatch = useCallback(
    async (viewId: string, layout: WorkspaceLayoutJson) => {
      try {
        const res = await fetch(`/api/views/${viewId}`, {
          method: "PATCH",
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
      for (const { id, layout } of updates) {
        try {
          const res = await fetch(`/api/views/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ layout }),
          });
          if (!res.ok) continue;
          const body = (await res.json()) as { view?: { layout?: unknown } };
          const lo = body.view?.layout as WorkspaceLayoutJson | undefined;
          if (lo) {
            setTrackers((prev) =>
              prev.map((p) =>
                p.view.id === id ? { ...p, view: { ...p.view, layout: lo } } : p,
              ),
            );
          }
        } catch {
          /* non-fatal */
        }
      }
    },
    [],
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
    const camera: WorkspaceCameraJson = {
      zoom: scale,
      panX: positionX,
      panY: positionY,
    };
    twRef.current?.setTransform(positionX, positionY, scale, 260);
    await persistCamera(camera);

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
  }, [draggingId, viewportMinScale, persistCamera, router]);

  const onDragPosition = useCallback((viewId: string, x: number, y: number) => {
    setDraggingId(viewId);
    setDragLive({ x, y });
    const current = trackersRef.current;
    const self = current.find((t) => t.view.id === viewId);
    const partnerId = self
      ? (parseWorkspaceLayout(self.view.layout).mergedWith ?? null)
      : null;

    let best: { id: string; ratio: number } | null = null;
    for (const t of current) {
      if (t.view.id === viewId) continue;
      // Stacked merged partner shares x/y — ignore as merge target so moves
      // don't show merge chrome or block until the pointer leaves the union.
      if (partnerId !== null && t.view.id === partnerId) continue;
      const ratio = mergeOverlapRatio(
        x,
        y,
        t.view.layout.x,
        t.view.layout.y,
      );
      if (ratio < MERGE_OVERLAP_TRIGGER_RATIO) continue;
      if (!best || ratio > best.ratio) best = { id: t.view.id, ratio };
    }
    const targetId = best?.id ?? null;
    let valid = false;
    if (targetId) {
      const src = current.find((t) => t.view.id === viewId);
      const tgt = current.find((t) => t.view.id === targetId);
      if (src && tgt) valid = canAttemptMerge(src, tgt);
    }
    mergeHoverRef.current = { targetId, valid };
    setMergeDropTargetId(targetId);
    setMergeDropValid(valid);
  }, []);

  const handleLayoutDragEnd = useCallback(
    (viewId: string, layout: WorkspaceLayoutJson) => {
      const hover = mergeHoverRef.current;
      mergeHoverRef.current = { targetId: null, valid: false };
      setDraggingId(null);
      setDragLive(null);
      setMergeDropTargetId(null);
      setMergeDropValid(false);

      const current = trackersRef.current;
      const self = current.find((t) => t.view.id === viewId);
      if (!self) return;

      const selfLo = parseWorkspaceLayout(self.view.layout);
      const w = TRACKER_WIDTH;
      const h = TRACKER_DEFAULT_HEIGHT;
      const normalized: WorkspaceLayoutJson = {
        ...layout,
        w,
        h,
      };

      if (
        hover.targetId &&
        hover.valid &&
        hover.targetId !== viewId &&
        selfLo.mergedWith !== hover.targetId
      ) {
        const tgt = current.find((t) => t.view.id === hover.targetId);
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
        const sourceLayout: WorkspaceLayoutJson = {
          ...selfLo,
          x: snapX,
          y: snapY,
          w,
          h,
          z: maxZ + 2,
          mergedWith: tgt.view.id,
        };
        const targetLayout: WorkspaceLayoutJson = {
          ...tgtLo,
          x: snapX,
          y: snapY,
          w,
          h,
          z: maxZ + 1,
          mergedWith: self.view.id,
        };
        void persistTwoLayouts([
          { id: self.view.id, layout: sourceLayout },
          { id: tgt.view.id, layout: targetLayout },
        ]);
        return;
      }

      const partnerId = selfLo.mergedWith ?? null;
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
            w,
            h,
            mergedWith: viewId,
          };
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
    async (anchorViewId: string) => {
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
      };
      const nextPartner: WorkspaceLayoutJson = {
        ...partnerLo,
        x: partnerLo.x + nudge,
        y: partnerLo.y + nudge,
        mergedWith: null,
      };
      await persistTwoLayouts([
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
        <div className="shrink-0 pt-[68px]">
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
        className={`relative min-h-0 flex-1 overflow-hidden bg-[#242525] ${
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
          limitToBounds={false}
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
          <CameraPersist onDebouncedCamera={persistCamera} />
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
                className="workspace-canvas-bounds relative isolate"
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
                    vectorEffect="nonScalingStroke"
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
                />
              </div>
            </TransformComponent>

            {trackers.length === 0 ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 text-center">
                <div>
                  <p className="text-lg font-medium text-foreground">
                    Workspace is empty
                  </p>
                  <p className="text-muted-foreground mt-2 max-w-sm text-sm">
                    Use <span className="font-medium">New tracker</span> below
                    to add your first checklist.
                  </p>
                </div>
              </div>
            ) : null}

            {/* Zoom + recenter — bottom right */}
            <div className="pointer-events-none absolute bottom-6 right-6 z-30 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="pointer-events-auto shadow-md"
                aria-label="Recenter workspace and trackers"
                disabled={trackers.length === 0 || draggingId !== null}
                onClick={() => void handleRecenterWorkspace()}
              >
                <Crosshair className="h-4 w-4" weight="duotone" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="pointer-events-auto shadow-md"
                aria-label="Zoom out"
                onClick={() => twRef.current?.zoomOut(0.2)}
              >
                <MagnifyingGlassMinus className="h-4 w-4" weight="duotone" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="pointer-events-auto shadow-md"
                aria-label="Zoom in"
                onClick={() => twRef.current?.zoomIn(0.2)}
              >
                <MagnifyingGlassPlus className="h-4 w-4" weight="duotone" />
              </Button>
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
                  } else {
                    router.refresh();
                  }
                }}
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
