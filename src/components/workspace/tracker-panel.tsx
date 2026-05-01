"use client";

import { useEffect, useMemo, useState } from "react";
import { Rnd } from "react-rnd";
import {
  DotsSixVertical,
  SquareSplitHorizontal,
} from "@phosphor-icons/react/dist/ssr";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { ViewActions } from "@/components/views/view-actions";
import { ViewDiagnosticsPanel } from "@/components/views/view-diagnostics";
import { MergedCompareGrid } from "@/components/views/merged-compare-grid";
import { TuningHeaderGlyph } from "@/components/views/tuning-header-glyph";
import { ViewGrid } from "@/components/views/view-grid";
import type { ArmorStatName } from "@/lib/db/types";
import type { ViewProgress } from "@/lib/views/progress";
import { MERGE_ACCENT_BLUE, MERGE_ACCENT_GREEN } from "@/lib/views/merge-compare";
import type { SerializableTrackerPayload } from "@/lib/workspace/types";
import {
  TRACKER_DEFAULT_HEIGHT,
  TRACKER_WIDTH,
} from "@/lib/workspace/workspace-constants";
import type { WorkspaceLayoutJson } from "@/lib/workspace/workspace-schema";

export type TrackerMergeRole = "solo" | "anchor" | "mergedPartner";

interface TrackerPanelProps {
  payload: SerializableTrackerPayload;
  hasInventory: boolean;
  /**
   * Live canvas zoom factor. Forwarded to `<Rnd>` so react-draggable can
   * correctly translate screen-space mouse coordinates into canvas-space
   * drag offsets. Without it, the tracker jumps to the wrong position on
   * mousedown when zoomed (the library divides by scale, defaulting to 1).
   */
  scale: number;
  onInteract: (viewId: string) => void;
  onDragPosition?: (viewId: string, x: number, y: number) => void;
  onDragLayoutEnd: (viewId: string, layout: WorkspaceLayoutJson) => void;
  mergeRole: TrackerMergeRole;
  mergePartnerPayload: SerializableTrackerPayload | null;
  mergeDropHighlight: "none" | "valid" | "invalid";
  onUnmerge?: () => void;
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
  scale,
  onDragPosition,
  onDragLayoutEnd,
  onInteract,
  mergeRole,
  mergePartnerPayload,
  mergeDropHighlight,
  onUnmerge,
}: TrackerPanelProps) {
  const { view } = payload;
  const [layout, setLayout] = useState<WorkspaceLayoutJson>(view.layout);
  const merged = Boolean(view.layout.mergedWith) && mergePartnerPayload !== null;

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
      view.layout.mergedWith,
    ],
  );

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

  const showMergedGrid =
    mergeRole === "anchor" && merged && mergePartnerPayload;

  const glyphClass =
    Number(view.class_type) < 0
      ? "h-[15px] w-[30px] shrink-0 text-white"
      : Number(view.class_type) === 2
        ? "h-3.5 w-auto shrink-0"
        : "h-7 w-auto shrink-0";

  const ariaRegionLabel =
    showMergedGrid && mergePartnerPayload
      ? `Merged trackers ${payload.view.name} and ${mergePartnerPayload.view.name}`
      : `Tracker ${payload.view.name}`;

  const dropRing =
    mergeDropHighlight === "valid"
      ? "ring-2 ring-[#00FF85] ring-offset-0"
      : mergeDropHighlight === "invalid"
        ? "ring-2 ring-destructive/80 ring-offset-0"
        : "";

  const isGhostPartner = mergeRole === "mergedPartner";

  if (isGhostPartner) {
    return (
      <Rnd
        className="rnd-tracker pointer-events-none"
        bounds="parent"
        scale={scale}
        position={{ x: layout.x, y: layout.y }}
        size={{ width: TRACKER_WIDTH, height: TRACKER_DEFAULT_HEIGHT }}
        enableResizing={false}
        enableDragging={false}
        style={{ zIndex: layout.z }}
        cancel=".no-drag"
      >
        <div
          id={`tracker-${view.id}`}
          aria-hidden
          className="h-full w-full opacity-0"
        />
      </Rnd>
    );
  }

  return (
    <Rnd
      className="rnd-tracker pointer-events-auto"
      dragHandleClassName="tracker-drag"
      bounds="parent"
      scale={scale}
      position={{ x: layout.x, y: layout.y }}
      size={{ width: TRACKER_WIDTH, height: TRACKER_DEFAULT_HEIGHT }}
      enableResizing={false}
      style={{ zIndex: layout.z }}
      onDragStart={() => onInteract(view.id)}
      onDrag={(_e, d) => {
        onDragPosition?.(view.id, d.x, d.y);
      }}
      onDragStop={(_e, d) => {
        const next: WorkspaceLayoutJson = {
          ...layout,
          x: d.x,
          y: d.y,
          w: TRACKER_WIDTH,
          h: TRACKER_DEFAULT_HEIGHT,
        };
        setLayout(next);
        onDragLayoutEnd(view.id, next);
      }}
      cancel=".no-drag"
    >
      <div
        id={`tracker-${view.id}`}
        role="region"
        aria-label={ariaRegionLabel}
        className="flex h-full overflow-hidden"
      >
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

          {showMergedGrid && onUnmerge ? (
            <>
              <button
                type="button"
                aria-label="Split merged trackers"
                onClick={onUnmerge}
                className="no-drag flex h-5 w-5 cursor-pointer items-center justify-center text-[#00FF85]/80 transition-colors hover:text-[#00FF85] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF85]/40"
              >
                <SquareSplitHorizontal className="h-5 w-5" weight="bold" />
              </button>
              <span aria-hidden className="h-px w-full bg-white/10" />
            </>
          ) : null}

          <ViewActions
            viewId={view.id}
            initialName={view.name}
            layout="sidebar"
          />
        </aside>

        <div
          className={`flex min-w-0 flex-1 flex-col overflow-hidden border border-[#424347] bg-[#2d2e32] shadow-lg ${dropRing}`}
        >
          {showMergedGrid && mergePartnerPayload ? (
            <header className="flex shrink-0 items-stretch gap-0 border-b border-[#424347] px-4 pb-0 pt-4">
              <div
                className="flex min-w-0 flex-1 flex-col gap-1 border-b-2 pr-2"
                style={{ borderColor: MERGE_ACCENT_GREEN }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <ClassGlyph classType={Number(view.class_type)} className={glyphClass} />
                    <h2 className="truncate text-xl font-normal leading-7 text-white">
                      {payload.view.name}
                    </h2>
                  </div>
                  <TuningHeaderGlyph
                    tuningName={payload.tuningName}
                    iconPath={payload.tuningStatIconPath}
                  />
                </div>
              </div>
              <div
                className="flex min-w-0 flex-1 flex-col gap-1 border-b-2 pl-2"
                style={{ borderColor: MERGE_ACCENT_BLUE }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 flex-row-reverse items-center gap-2">
                    <h2 className="truncate text-right text-xl font-normal leading-7 text-white">
                      {mergePartnerPayload.view.name}
                    </h2>
                    <ClassGlyph
                      classType={Number(mergePartnerPayload.view.class_type)}
                      className={glyphClass}
                    />
                  </div>
                  <TuningHeaderGlyph
                    tuningName={mergePartnerPayload.tuningName}
                    iconPath={mergePartnerPayload.tuningStatIconPath}
                  />
                </div>
              </div>
            </header>
          ) : (
            <header className="flex shrink-0 items-start justify-between gap-2 p-4">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <ClassGlyph classType={Number(view.class_type)} className={glyphClass} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-normal leading-7 text-white">
                    {payload.view.name}
                  </h2>
                </div>
              </div>
              <TuningHeaderGlyph
                tuningName={payload.tuningName}
                iconPath={payload.tuningStatIconPath}
              />
            </header>
          )}

          <div
            className={`no-drag flex min-h-0 flex-1 flex-col gap-4 border-t border-[#424347] px-4 pt-4 pb-2 ${
              !showMergedGrid &&
              (payload.needsClass || payload.showDiagnostics)
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

            {showMergedGrid && mergePartnerPayload ? (
              <MergedCompareGrid
                anchorPayload={payload}
                partnerPayload={mergePartnerPayload}
                hasInventory={hasInventory}
              />
            ) : (
              <ViewGrid
                progress={viewProgressForGrid}
                hasInventory={hasInventory}
                tertiaryStatIconPaths={tertiaryPaths}
              />
            )}

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
