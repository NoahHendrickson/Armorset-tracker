"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { DraggableEvent } from "react-draggable";
import { Rnd } from "react-rnd";
import {
  CopySimple,
  DotsSixVertical,
  SquareSplitHorizontal,
} from "@phosphor-icons/react/dist/ssr";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { ViewActions } from "@/components/views/view-actions";
import { MergedCompareGrid } from "@/components/views/merged-compare-grid";
import { TuningHeaderGlyph } from "@/components/views/tuning-header-glyph";
import { ViewGrid } from "@/components/views/view-grid";
import type { ArmorStatName } from "@/lib/db/types";
import type { ViewProgress } from "@/lib/views/progress";
import {
  MERGE_ACCENT_BLUE,
  MERGE_ACCENT_GREEN,
  unionTertiaryStats,
} from "@/lib/views/merge-compare";
import { TrackerIdentBadges } from "@/components/workspace/tracker-ident-badges";
import type { SerializableTrackerPayload } from "@/lib/workspace/types";
import {
  TRACKER_DEFAULT_HEIGHT,
  TRACKER_WIDTH,
  trackerWidthForTertiaryColumns,
} from "@/lib/workspace/workspace-constants";
import {
  parseWorkspaceLayout,
  type WorkspaceLayoutJson,
} from "@/lib/workspace/workspace-schema";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useWorkspaceZoomScaleRef } from "@/components/workspace/workspace-zoom-scale-context";

export type TrackerMergeRole = "solo" | "anchor" | "mergedPartner";

interface TrackerPanelProps {
  payload: SerializableTrackerPayload;
  hasInventory: boolean;
  /**
   * Canvas zoom for react-draggable is synced from the transform library via
   * `workspace-zoom-scale-context` — only flushed to React before pointer/touch
   * interaction so pinch-zoom doesn't re-render every tracker each tick.
   */
  onInteract: (viewId: string) => void;
  onDragPosition?: (
    viewId: string,
    x: number,
    y: number,
    dragEvent: DraggableEvent,
  ) => void;
  onDragLayoutEnd: (viewId: string, layout: WorkspaceLayoutJson) => void;
  mergeRole: TrackerMergeRole;
  mergePartnerPayload: SerializableTrackerPayload | null;
  mergeDropHighlight: "none" | "valid" | "invalid";
  onUnmerge?: () => void;
  /** Open duplicate flow (dashboard) pre-filled from this tracker. */
  onRequestDuplicate?: (payload: SerializableTrackerPayload) => void;
  /** Brief light-blue frame after the tracker is created on the canvas. */
  spawnHighlight?: boolean;
  /**
   * Optional `transform` easing on react-rnd when layouts change from the
   * canvas arrange menu (flush + rAF primes the transition at the old coords).
   */
  easeLayoutPulse?: { durationMs: number } | null;
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

/** 1px frame only: brighter rim at top/corners, fades toward bottom/sides (#2d2e32 stays on the interior). */
const TRACKER_BODY_GLASS_BORDER =
  "bg-[linear-gradient(170deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.24)_18%,rgba(255,255,255,0.24)_52%,rgba(255,255,255,0.36)_100%)]";

/** Horizontal hairline between title row and tracker grid — similar specular cue as the rim. */
const TRACKER_HEADER_CONTENT_DIVIDER =
  "h-px w-full shrink-0 bg-gradient-to-r from-white/[0.06] via-white/[0.32] to-white/[0.06]";

export function TrackerPanel({
  payload,
  hasInventory,
  onDragPosition,
  onDragLayoutEnd,
  onInteract,
  mergeRole,
  mergePartnerPayload,
  mergeDropHighlight,
  onUnmerge,
  onRequestDuplicate,
  spawnHighlight = false,
  easeLayoutPulse = null,
}: TrackerPanelProps) {
  const { view } = payload;
  const zoomScaleRef = useWorkspaceZoomScaleRef();
  const [rndScale, setRndScale] = useState(() => zoomScaleRef.current);

  const primeRndScaleForPointer = useCallback(() => {
    const s = zoomScaleRef.current;
    flushSync(() => {
      setRndScale((prev) => (Math.abs(prev - s) <= 1e-9 ? prev : s));
    });
  }, [zoomScaleRef]);

  const [layout, setLayout] = useState<WorkspaceLayoutJson>(view.layout);
  /** Latest layout during drag — avoids stale React state in `onDragStop`. */
  const layoutLiveRef = useRef<WorkspaceLayoutJson>(
    parseWorkspaceLayout(view.layout),
  );
  const merged = Boolean(view.layout.mergedWith) && mergePartnerPayload !== null;

  const panelWidth =
    merged && mergePartnerPayload
      ? trackerWidthForTertiaryColumns(
          unionTertiaryStats(payload, mergePartnerPayload).length,
          { dualSlotRails: true },
        )
      : TRACKER_WIDTH;

  useEffect(
    () => {
       
      layoutLiveRef.current = parseWorkspaceLayout(view.layout);
      setLayout(parseWorkspaceLayout(view.layout));
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
      ? "block h-[15px] w-[30px] shrink-0 text-white"
      : Number(view.class_type) === 2
        ? "block h-3.5 w-auto shrink-0 object-contain"
        : "block h-7 w-auto shrink-0 object-contain";

  const soloIdent = `${payload.setName} · ${payload.archetypeName}`;
  const ariaRegionLabel =
    showMergedGrid && mergePartnerPayload
      ? `Merged trackers ${soloIdent} and ${mergePartnerPayload.setName} · ${mergePartnerPayload.archetypeName}`
      : `Tracker ${soloIdent}`;

  const dropRing =
    mergeDropHighlight === "valid"
      ? "ring-2 ring-[#00FF85] ring-offset-0"
      : mergeDropHighlight === "invalid"
        ? "ring-2 ring-destructive/80 ring-offset-0"
        : "";

  const isGhostPartner = mergeRole === "mergedPartner";

  const easeMotionStyle =
    easeLayoutPulse !== null && easeLayoutPulse.durationMs > 1
      ? {
          transition: `transform ${easeLayoutPulse.durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }
      : undefined;

  if (isGhostPartner) {
    return (
      <Rnd
        className="rnd-tracker rnd-tracker-ghost pointer-events-none"
        bounds="parent"
        scale={rndScale}
        position={{ x: layout.x, y: layout.y }}
        size={{ width: panelWidth, height: TRACKER_DEFAULT_HEIGHT }}
        enableResizing={false}
        enableDragging={false}
        style={
          easeMotionStyle ? { zIndex: layout.z, ...easeMotionStyle } : { zIndex: layout.z }
        }
        cancel=".no-drag"
      >
        <div id={`tracker-${view.id}`} aria-hidden className="h-full w-full" />
      </Rnd>
    );
  }

  return (
    <Rnd
      className="rnd-tracker pointer-events-auto"
      dragHandleClassName="tracker-drag"
      bounds="parent"
      scale={rndScale}
      enableResizing={false}
      position={{ x: layout.x, y: layout.y }}
      size={{ width: panelWidth, height: TRACKER_DEFAULT_HEIGHT }}
      style={easeMotionStyle}
      onDrag={(e, d) => {
        onDragPosition?.(view.id, d.x, d.y, e);
        const next = { ...layoutLiveRef.current, x: d.x, y: d.y };
        layoutLiveRef.current = next;
        setLayout(next);
      }}
      onDragStop={(_e, d) => {
        const next: WorkspaceLayoutJson = {
          ...layoutLiveRef.current,
          x: d.x,
          y: d.y,
          w: panelWidth,
          h: TRACKER_DEFAULT_HEIGHT,
        };
        layoutLiveRef.current = next;
        setLayout(next);
        onDragLayoutEnd(view.id, next);
      }}
      cancel=".no-drag"
    >
      <div
        id={`tracker-${view.id}`}
        role="region"
        aria-label={ariaRegionLabel}
        className={cn(
          "flex h-full overflow-hidden",
          spawnHighlight && "tracker-spawn-highlight",
        )}
      >
        <aside
          aria-label="Tracker actions"
          className="flex shrink-0 cursor-default flex-col items-center gap-2 self-start bg-[#424347] p-2"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Drag tracker"
                onPointerDownCapture={primeRndScaleForPointer}
                onTouchStartCapture={primeRndScaleForPointer}
                className="tracker-drag flex h-5 w-5 cursor-grab items-center justify-center text-white/70 transition-colors hover:text-white active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <DotsSixVertical className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Drag tracker</TooltipContent>
          </Tooltip>

          <span aria-hidden className="h-px w-full bg-white/10" />

          <span className="no-drag inline-flex">
            <RefreshButton variant="icon" />
          </span>

          {onRequestDuplicate ?
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Duplicate tracker"
                  onClick={() => onRequestDuplicate(payload)}
                  className="no-drag flex h-5 w-5 cursor-pointer items-center justify-center text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <CopySimple className="h-5 w-5" weight="duotone" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Duplicate tracker</TooltipContent>
            </Tooltip>
          : null}

          <span aria-hidden className="h-px w-full bg-white/10" />

          {showMergedGrid && onUnmerge ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Split merged trackers"
                    onClick={onUnmerge}
                    className="no-drag flex h-5 w-5 cursor-pointer items-center justify-center text-[#00FF85]/80 transition-colors hover:text-[#00FF85] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF85]/40"
                  >
                    <SquareSplitHorizontal className="h-5 w-5" weight="bold" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Split merged trackers</TooltipContent>
              </Tooltip>
              <span aria-hidden className="h-px w-full bg-white/10" />
            </>
          ) : null}

          <div className="no-drag">
            <ViewActions viewId={view.id} layout="sidebar" />
          </div>
        </aside>

        <div
          className={cn(
            // Glass rim only on the draggable body column, not the left icon rail.
            "tracker-drag flex min-w-0 flex-1 cursor-grab flex-col overflow-hidden rounded-none p-px shadow-lg active:cursor-grabbing",
            TRACKER_BODY_GLASS_BORDER,
            dropRing,
          )}
          onPointerDownCapture={primeRndScaleForPointer}
          onTouchStartCapture={primeRndScaleForPointer}
        >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#2d2e32]">
            {showMergedGrid && mergePartnerPayload ? (
            <header className="flex shrink-0 select-none items-stretch gap-0 px-4 pb-0 pt-4">
              <div
                className="flex min-w-0 flex-1 flex-col gap-1 border-b-2 pr-2"
                style={{ borderColor: MERGE_ACCENT_GREEN }}
              >
                <div className="flex min-w-0 items-center gap-4">
                  <ClassGlyph classType={Number(view.class_type)} className={glyphClass} />
                  <TrackerIdentBadges
                    setName={payload.setName}
                    archetypeName={payload.archetypeName}
                    tuning={
                      <TuningHeaderGlyph
                        tuningName={payload.tuningName}
                        iconPath={payload.tuningStatIconPath}
                      />
                    }
                  />
                </div>
              </div>
              <div
                className="flex min-w-0 flex-1 flex-col gap-1 border-b-2 pl-2"
                style={{ borderColor: MERGE_ACCENT_BLUE }}
              >
                <div className="flex min-w-0 flex-1 flex-row-reverse items-center gap-4">
                  <TrackerIdentBadges
                    setName={mergePartnerPayload.setName}
                    archetypeName={mergePartnerPayload.archetypeName}
                    tuning={
                      <TuningHeaderGlyph
                        tuningName={mergePartnerPayload.tuningName}
                        iconPath={mergePartnerPayload.tuningStatIconPath}
                      />
                    }
                  />
                  <ClassGlyph
                    classType={Number(mergePartnerPayload.view.class_type)}
                    className={glyphClass}
                  />
                </div>
              </div>
            </header>
          ) : (
            <header className="flex shrink-0 select-none items-center gap-4 p-4">
              <ClassGlyph classType={Number(view.class_type)} className={glyphClass} />
              <TrackerIdentBadges
                setName={payload.setName}
                archetypeName={payload.archetypeName}
                tuning={
                  <TuningHeaderGlyph
                    tuningName={payload.tuningName}
                    iconPath={payload.tuningStatIconPath}
                  />
                }
              />
            </header>
          )}

            <div className={TRACKER_HEADER_CONTENT_DIVIDER} aria-hidden />

            <div
              className={`flex min-h-0 flex-1 flex-col gap-4 px-4 pt-4 pb-2 ${
                !showMergedGrid && payload.needsClass
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
                armorSlotIconPaths={payload.armorSlotIconPaths}
              />
            )}
            </div>
          </div>
        </div>
      </div>
    </Rnd>
  );
}
