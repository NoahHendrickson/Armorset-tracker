"use client";

import { useMemo } from "react";
import { SquareSplitHorizontal } from "@phosphor-icons/react/dist/ssr";
import { TuningHeaderGlyph } from "@/components/views/tuning-header-glyph";
import { ViewGrid } from "@/components/views/view-grid";
import type { ArmorStatName } from "@/lib/db/types";
import type { ViewProgress } from "@/lib/views/progress";
import { TrackerIdentBadges } from "@/components/workspace/tracker-ident-badges";
import type { SerializableTrackerPayload } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

interface TrackerGridContentProps {
  payload: SerializableTrackerPayload;
  hasInventory: boolean;
  onCompareClick?: () => void;
  className?: string;
}

/** Class glyph assets (static; manifest does not ship class icons). */
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

const TRACKER_BODY_GLASS_BORDER =
  "bg-[linear-gradient(170deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.24)_18%,rgba(255,255,255,0.24)_52%,rgba(255,255,255,0.36)_100%)]";

const TRACKER_HEADER_CONTENT_DIVIDER =
  "h-px w-full shrink-0 bg-gradient-to-r from-white/[0.06] via-white/[0.32] to-white/[0.06]";

/**
 * Inline tracker tile (no Rnd / merge chrome). Same inner layout as the
 * canvas `TrackerPanel`'s solo branch — header + ViewGrid + a Compare action.
 */
export function TrackerGridContent({
  payload,
  hasInventory,
  onCompareClick,
  className,
}: TrackerGridContentProps) {
  const { view } = payload;

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

  const glyphClass =
    Number(view.class_type) < 0
      ? "block h-[15px] w-[30px] shrink-0 text-foreground"
      : Number(view.class_type) === 2
        ? "block h-3.5 w-auto shrink-0 object-contain"
        : "block h-7 w-auto shrink-0 object-contain";

  const ariaRegionLabel = `Tracker ${payload.setName} · ${payload.archetypeName}`;

  return (
    <div
      role="region"
      aria-label={ariaRegionLabel}
      className={cn(
        "flex h-full min-h-0 w-full overflow-hidden rounded-none p-px shadow-lg",
        TRACKER_BODY_GLASS_BORDER,
        className,
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-card">
        <header className="flex shrink-0 select-none items-center gap-4 p-4">
          <ClassGlyph
            classType={Number(view.class_type)}
            className={glyphClass}
          />
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

        <div className={TRACKER_HEADER_CONTENT_DIVIDER} aria-hidden />

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 pt-4 pb-2">
          {payload.needsClass ? (
            <div
              role="alert"
              className="rounded-none border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200"
            >
              <p className="font-medium">No class assigned</p>
              <p className="text-muted-foreground">
                Created before class scoping. Delete and remake to filter by
                class.
              </p>
            </div>
          ) : null}

          <ViewGrid
            progress={viewProgressForGrid}
            hasInventory={hasInventory}
            tertiaryStatIconPaths={tertiaryPaths}
            armorSlotIconPaths={payload.armorSlotIconPaths}
          />

          {onCompareClick ? (
            <div className="mt-auto flex shrink-0 justify-end pt-1">
              <button
                type="button"
                onClick={onCompareClick}
                className="inline-flex h-7 items-center gap-1.5 rounded-none border border-border bg-card px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <SquareSplitHorizontal
                  weight="duotone"
                  aria-hidden
                  className="h-3.5 w-3.5"
                />
                Compare
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
