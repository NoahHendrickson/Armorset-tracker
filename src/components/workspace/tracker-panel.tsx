"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { DotsSixVertical } from "@phosphor-icons/react/dist/ssr";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { ViewActions } from "@/components/views/view-actions";
import { ViewDiagnosticsPanel } from "@/components/views/view-diagnostics";
import { ViewGrid } from "@/components/views/view-grid";
import type { ArmorStatName } from "@/lib/db/types";
import type { ViewProgress } from "@/lib/views/progress";
import type { SerializableTrackerPayload } from "@/lib/workspace/types";
import {
  TRACKER_DEFAULT_HEIGHT,
  TRACKER_WIDTH,
} from "@/lib/workspace/workspace-constants";
import type { WorkspaceLayoutJson } from "@/lib/workspace/workspace-schema";
import { formatRelativeTime } from "@/lib/format";

interface TrackerPanelProps {
  payload: SerializableTrackerPayload;
  hasInventory: boolean;
  syncedAt: Date | string | null;
  /**
   * Live canvas zoom factor. Forwarded to `<Rnd>` so react-draggable can
   * correctly translate screen-space mouse coordinates into canvas-space
   * drag offsets. Without it, the tracker jumps to the wrong position on
   * mousedown when zoomed (the library divides by scale, defaulting to 1).
   */
  scale: number;
  onCommitLayout: (viewId: string, layout: WorkspaceLayoutJson) => void;
  onInteract: (viewId: string) => void;
}

function useDebouncedLayoutCommit(
  onCommit: (viewId: string, layout: WorkspaceLayoutJson) => void,
  delayMs: number,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(
    (viewId: string, layout: WorkspaceLayoutJson) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        onCommit(viewId, layout);
      }, delayMs);
    },
    [onCommit, delayMs],
  );
}

/**
 * Class glyphs (Titan / Hunter / Warlock) sourced from static assets in
 * `public/class-icons/{titan,hunter,warlock}.svg`. Bungie's manifest does not
 * ship class icons (`DestinyClassDefinition.displayProperties.icon` is empty
 * for every class), so these are bundled with the app. Legacy unscoped views
 * (`class_type = -1`) keep the original two-peak marker.
 */
const CLASS_GLYPH_SRC: Record<number, string> = {
  0: "/class-icons/titan.svg",
  1: "/class-icons/hunter.svg",
  2: "/class-icons/warlock.svg",
};

function ClassGlyph({
  classType,
  className,
}: {
  classType: number;
  className?: string;
}) {
  const src = CLASS_GLYPH_SRC[classType];
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- static asset; plain img keeps currentColor + sizing simple
      <img src={src} alt="" aria-hidden className={className} />
    );
  }

  return (
    <svg
      width="30"
      height="15"
      viewBox="0 0 30 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      <path d="M0 15 L7.5 0 L15 15 Z" fill="currentColor" />
      <path d="M15 15 L22.5 0 L30 15 Z" fill="currentColor" />
    </svg>
  );
}

export function TrackerPanel({
  payload,
  hasInventory,
  syncedAt,
  scale,
  onCommitLayout,
  onInteract,
}: TrackerPanelProps) {
  const { view } = payload;
  const [layout, setLayout] = useState<WorkspaceLayoutJson>(view.layout);

  useEffect(
    () => {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- keep Rnd state aligned after server refresh
      setLayout(view.layout);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layout scalars; `view.layout` identity churns with parent payloads
    [
      view.id,
      view.layout.x,
      view.layout.y,
      view.layout.w,
      view.layout.h,
      view.layout.z,
    ],
  );

  const debouncedPush = useDebouncedLayoutCommit(onCommitLayout, 420);

  const viewProgressForGrid = useMemo(
    (): ViewProgress => ({
      ...payload.progress,
      cells: payload.progress.cells as ViewProgress["cells"],
    }),
    [payload.progress],
  );

  const tertiaryPaths = payload.tertiaryStatIconPaths as Partial<
    Record<ArmorStatName, string>
  >;

  return (
    <Rnd
      className="rnd-tracker pointer-events-auto"
      dragHandleClassName="tracker-drag"
      bounds="parent"
      // Required when the canvas is CSS-transformed via react-zoom-pan-pinch
      // — react-draggable divides mouse delta / origin by `scale` to map
      // screen pixels to local CSS pixels. Without this the tracker snaps
      // to a wrong offset on mousedown.
      scale={scale}
      position={{ x: layout.x, y: layout.y }}
      // Width and height are both fixed — the stat grid is a known size and
      // trackers shouldn't be resizable. Rnd is only used for drag here.
      size={{ width: TRACKER_WIDTH, height: TRACKER_DEFAULT_HEIGHT }}
      enableResizing={false}
      style={{ zIndex: layout.z }}
      onDragStart={() => onInteract(view.id)}
      onDragStop={(_e, d) => {
        const next: WorkspaceLayoutJson = {
          ...layout,
          x: d.x,
          y: d.y,
          w: TRACKER_WIDTH,
          h: TRACKER_DEFAULT_HEIGHT,
        };
        setLayout(next);
        debouncedPush(view.id, next);
      }}
      cancel=".no-drag"
    >
      <div
        id={`tracker-${view.id}`}
        role="region"
        aria-label={`Tracker ${payload.view.name}`}
        className="flex h-full overflow-hidden"
      >
        {/* Sidebar toolbar (drag handle, refresh, rename, delete) — hugs its
            buttons rather than stretching to the tracker's full height. */}
        <aside
          aria-label="Tracker actions"
          className="flex shrink-0 flex-col items-center gap-2 self-start bg-[#424347] p-2"
        >
          <button
            type="button"
            aria-label="Drag tracker"
            className="tracker-drag flex h-5 w-5 cursor-grab items-center justify-center text-white/70 transition-colors hover:text-white active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <DotsSixVertical className="h-5 w-5" />
          </button>

          <span aria-hidden className="h-px w-full bg-white/10" />

          <RefreshButton variant="icon" />

          <span aria-hidden className="h-px w-full bg-white/10" />

          <ViewActions
            viewId={view.id}
            initialName={view.name}
            layout="sidebar"
          />
        </aside>

        {/* Main content — dark tracker surface */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden border border-[#424347] bg-[#2d2e32] shadow-lg">
          <header className="flex shrink-0 items-center gap-2.5 p-4">
            <ClassGlyph
              classType={Number(view.class_type)}
              className={
                Number(view.class_type) >= 0
                  ? "h-7 w-auto shrink-0"
                  : "h-[15px] w-[30px] shrink-0 text-white"
              }
            />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-normal leading-7 text-white">
                {payload.view.name}
              </h2>
              <p className="mt-0.5 truncate text-xs text-white/50">
                <span className="font-mono">
                  {payload.progress.ownedCells}/{payload.progress.totalCells}
                </span>
                {payload.className ? <> · {payload.className}</> : null}
                {payload.archetypePrimarySecondary ? (
                  <>
                    {" "}
                    · +{payload.archetypePrimarySecondary.primary} / +
                    {payload.archetypePrimarySecondary.secondary}
                  </>
                ) : null}
                {syncedAt ? <> · synced {formatRelativeTime(syncedAt)}</> : null}
              </p>
            </div>
          </header>

          {/*
           * Only opt into vertical scrolling when extra content (no-class
           * alert or diagnostics panel) genuinely pushes the body past the
           * fixed 384px tracker height. In the normal case the grid is
           * sized to fit exactly, so `overflow-auto` would surface a
           * spurious scrollbar from sub-pixel flex rounding even though
           * there's nothing to scroll. As a bonus this stops the canvas
           * wheel handler from deferring trackpad pans into the tracker
           * body when it's not actually scrollable.
           */}
          <div
            className={`no-drag flex min-h-0 flex-1 flex-col gap-4 border-t border-[#424347] px-4 pt-4 pb-2 ${
              payload.needsClass || payload.showDiagnostics
                ? "overflow-y-auto"
                : "overflow-hidden"
            }`}
          >
            {payload.needsClass ? (
              <div
                role="alert"
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200"
              >
                <p className="font-medium">No class assigned</p>
                <p className="text-white/60">
                  Created before class scoping. Delete and remake to filter by
                  class.
                </p>
              </div>
            ) : null}

            <ViewGrid
              progress={viewProgressForGrid}
              hasInventory={hasInventory}
              tertiaryStatIconPaths={tertiaryPaths}
            />

            {payload.showDiagnostics ? (
              <ViewDiagnosticsPanel
                diagnostics={payload.diagnostics}
                setName={payload.setName}
                archetypeName={payload.archetypeName}
                tuningName={payload.tuningName}
                className={payload.className}
              />
            ) : null}
          </div>
        </div>
      </div>
    </Rnd>
  );
}
