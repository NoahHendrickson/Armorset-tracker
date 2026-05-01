"use client";

import {
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Plus,
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
  WORKSPACE_CANVAS_HEIGHT,
  WORKSPACE_CANVAS_WIDTH,
} from "@/lib/workspace/workspace-constants";
import { computeWorkspaceMinScale } from "@/lib/workspace/workspace-min-scale";
import type { SerializableTrackerPayload } from "@/lib/workspace/types";
import type {
  WorkspaceCameraJson,
  WorkspaceLayoutJson,
} from "@/lib/workspace/workspace-schema";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import {
  NewTrackerDialog,
  type TrackerFormSelectors,
} from "@/components/workspace/new-tracker-dialog";
import { TrackerPanel } from "@/components/workspace/tracker-panel";
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
  syncedAt,
  hasInventory,
  initialScale,
  onCommitLayout,
  onInteract,
}: {
  trackers: SerializableTrackerPayload[];
  syncedAt: Date | string | null;
  hasInventory: boolean;
  initialScale: number;
  onCommitLayout: (viewId: string, layout: WorkspaceLayoutJson) => void;
  onInteract: (viewId: string) => void;
}) {
  const [scale, setScale] = useState(initialScale);
  useTransformEffect((ref) => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror live scale into state for child Rnd props
    setScale(ref.state.scale);
  });
  return (
    <>
      {trackers.map((t) => (
        <TrackerPanel
          key={t.view.id}
          payload={t}
          syncedAt={syncedAt}
          hasInventory={hasInventory}
          scale={scale}
          onCommitLayout={onCommitLayout}
          onInteract={onInteract}
        />
      ))}
    </>
  );
}

interface CanvasWorkspaceProps {
  className?: string;
  banners?: React.ReactNode;
  initialTrackers: SerializableTrackerPayload[];
  initialCamera: WorkspaceCameraJson;
  focusTrackerId: string | null;
  syncedAt: Date | string | null;
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
  syncedAt,
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

  const handleInteract = useCallback(
    (viewId: string) => {
      setTrackers((prev) => {
        const maxZ = prev.length
          ? Math.max(...prev.map((t) => t.view.layout.z))
          : 0;
        const target = prev.find((t) => t.view.id === viewId);
        if (!target || target.view.layout.z >= maxZ) return prev;
        const base = target.view.layout;
        const nextLayout: WorkspaceLayoutJson = {
          x: base.x,
          y: base.y,
          w: base.w,
          h: base.h,
          z: maxZ + 1,
        };
        void persistLayoutPatch(viewId, nextLayout);
        return prev.map((p) =>
          p.view.id === viewId
            ? { ...p, view: { ...p.view, layout: nextLayout } }
            : p,
        );
      });
    },
    [persistLayoutPatch],
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
                style={{
                  width: WORKSPACE_CANVAS_WIDTH,
                  height: WORKSPACE_CANVAS_HEIGHT,
                  position: "relative",
                }}
              >
                <TrackerLayer
                  trackers={trackers}
                  syncedAt={syncedAt}
                  hasInventory={hasInventory}
                  initialScale={initialCamera.zoom}
                  onCommitLayout={persistLayoutPatch}
                  onInteract={handleInteract}
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

            {/* Zoom controls — bottom right */}
            <div className="pointer-events-none absolute bottom-6 right-6 z-30 flex gap-2">
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
              <button
                type="button"
                disabled={selectors.manifestEmpty}
                onClick={() => setNewTrackerOpen(true)}
                className="pointer-events-auto relative flex h-12 items-center gap-2 overflow-hidden bg-[#07ad6b] px-6 text-sm font-medium text-white transition-colors hover:bg-[#0ac07a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07ad6b] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  boxShadow:
                    "0 10px 20px -5px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(0,0,0,0.24), inset 0 -10px 14px -4px rgba(255,255,255,0.16)",
                }}
                aria-label="New tracker"
              >
                <Plus className="h-5 w-5" weight="duotone" />
                <span>New tracker</span>
              </button>
              <div className="pointer-events-auto">
                <RefreshButton variant="fab" />
              </div>
            </div>
          </div>
        </TransformWrapper>
      </div>

      <NewTrackerDialog
        open={newTrackerOpen}
        onOpenChange={setNewTrackerOpen}
        trackers={trackers}
        selectors={selectors}
        onCreated={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
