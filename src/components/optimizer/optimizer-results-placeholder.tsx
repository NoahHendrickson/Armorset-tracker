"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { SLOT_ORDER } from "@/lib/bungie/constants";
import { cn } from "@/lib/utils";

export type OptimizerResultsPhase = "idle" | "priming" | "generating";

export interface OptimizerResultsPlaceholderProps {
  /** Drives the indicator, copy, and how "alive" the shimmer feels. */
  phase: OptimizerResultsPhase;
  /** Primary status line. Falls back to a per-phase default. */
  message?: string;
  /** Secondary guidance line (e.g. "Add another target to start"). */
  hint?: string;
  /** 0-100 search progress, shown only while generating. */
  progress?: number;
  className?: string;
}

const DEFAULT_MESSAGE: Record<OptimizerResultsPhase, string> = {
  idle: "Ready when you are",
  priming: "Warming up\u2026",
  generating: "Generating builds\u2026",
};

/** Faint while idle, brighter once warming up, full while really generating. */
const CARD_OPACITY: Record<OptimizerResultsPhase, string> = {
  idle: "opacity-40",
  priming: "opacity-70",
  generating: "opacity-100",
};

const PLACEHOLDER_CARD_COUNT = 3;

/**
 * Anticipation state for the optimizer results pane. Renders one continuous
 * "thinking" presentation (status indicator + shimmering build cards) that
 * intensifies from idle -> priming -> generating, so the handoff into a real
 * search never feels like a discrete jump.
 */
export function OptimizerResultsPlaceholder({
  phase,
  message,
  hint,
  progress,
  className,
}: OptimizerResultsPlaceholderProps) {
  const primary = message ?? DEFAULT_MESSAGE[phase];

  return (
    <div className={cn("mt-2", className)}>
      <div
        role="status"
        className="flex items-center gap-2 text-sm text-foreground"
      >
        {phase === "generating" ? (
          <span
            className="size-3 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-foreground"
            aria-hidden
          />
        ) : (
          <span
            className={cn(
              "size-2 shrink-0 animate-pulse rounded-full bg-muted-foreground",
              phase === "idle" ? "opacity-50" : "opacity-80",
            )}
            aria-hidden
          />
        )}
        <span>
          {primary}
          {phase === "generating" && typeof progress === "number"
            ? ` ${Math.round(progress)}%`
            : null}
        </span>
      </div>

      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}

      <ul
        className={cn("mt-4 space-y-3 transition-opacity", CARD_OPACITY[phase])}
        aria-hidden
      >
        {Array.from({ length: PLACEHOLDER_CARD_COUNT }, (_, index) => (
          <li key={index} className="space-y-2 rounded border border-border p-3">
            <Skeleton className="h-4 w-3/4" />
            {SLOT_ORDER.map((slot) => (
              <div key={slot} className="flex items-center gap-2">
                <Skeleton className="size-7 rounded" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
