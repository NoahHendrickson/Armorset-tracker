"use client";

import { useCallback, useId } from "react";
import { ArmorStatIcon } from "@/components/ui/armor-stat-icon";
import type { ArmorStatName } from "@/lib/db/types";
import {
  clampOptimizerStat,
  OPTIMIZER_STAT_MAX,
  OPTIMIZER_STAT_MIN,
  OPTIMIZER_STAT_TIER_MARKS,
  pctOnOptimizerTrack,
} from "@/lib/optimizer/stat-range";
import { cn } from "@/lib/utils";

export type StatRangeSliderProps = {
  stat: ArmorStatName;
  iconPath?: string | null;
  min: number;
  achievableMin: number;
  achievableMax: number;
  onChange: (min: number) => void;
  compact?: boolean;
};

export function StatRangeSlider({
  stat,
  iconPath,
  min,
  achievableMin,
  achievableMax,
  onChange,
  compact = false,
}: StatRangeSliderProps) {
  const labelId = useId();

  const safeMin = clampOptimizerStat(min);

  const setMin = useCallback(
    (next: number) => {
      onChange(clampOptimizerStat(next));
    },
    [onChange],
  );

  const handleAchievableDoubleClick = () => {
    onChange(clampOptimizerStat(achievableMax));
  };

  const achLeft = pctOnOptimizerTrack(achievableMin);
  const achWidth = Math.max(
    0,
    pctOnOptimizerTrack(achievableMax) - achLeft,
  );
  const selWidth = pctOnOptimizerTrack(safeMin);

  return (
    <div
      className={cn(
        "grid items-center gap-x-2 text-sm",
        compact
          ? "grid-cols-[auto_minmax(0,1fr)_3rem]"
          : "grid-cols-[auto_minmax(0,1fr)_4.5rem] gap-y-1 sm:grid-cols-[auto_5rem_minmax(0,1fr)_4.5rem]",
      )}
    >
      <ArmorStatIcon
        stat={stat}
        iconPath={iconPath}
        size={compact ? "sm" : "md"}
        className={cn(
          "self-center",
          compact ? "" : "row-span-2 sm:row-span-1",
        )}
      />

      {!compact ? (
        <span
          id={labelId}
          className="hidden font-medium text-foreground sm:block"
        >
          {stat}
        </span>
      ) : (
        <span id={labelId} className="sr-only">
          {stat}
        </span>
      )}

      <div
        className={cn(
          "min-w-0",
          compact ? "col-span-1" : "col-span-2 space-y-1 sm:col-span-1",
        )}
      >
        <div
          className={cn(
            "relative mx-0.5 touch-none select-none",
            compact ? "h-6" : "h-8",
          )}
          role="group"
          aria-labelledby={labelId}
        >
          <div className="absolute top-1/2 right-0 left-0 h-2 -translate-y-1/2 rounded-full bg-muted" />

          {OPTIMIZER_STAT_TIER_MARKS.map((tier) => (
            <span
              key={tier}
              className="pointer-events-none absolute top-1/2 z-10 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-border"
              style={{ left: `${pctOnOptimizerTrack(tier)}%` }}
              aria-hidden
            />
          ))}

          <div
            className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-muted-foreground/35"
            style={{ left: `${achLeft}%`, width: `${achWidth}%` }}
            title={`Achievable ${achievableMin}–${achievableMax} — double-click to set min to ${achievableMax}`}
            onDoubleClick={handleAchievableDoubleClick}
          />

          {safeMin > OPTIMIZER_STAT_MIN ? (
            <div
              className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-primary/55"
              style={{ left: "0%", width: `${selWidth}%` }}
              aria-hidden
            />
          ) : null}

          <input
            type="range"
            min={OPTIMIZER_STAT_MIN}
            max={OPTIMIZER_STAT_MAX}
            step={1}
            value={safeMin}
            onChange={(e) => setMin(Number(e.target.value))}
            aria-label={`${stat} minimum`}
            aria-valuemin={OPTIMIZER_STAT_MIN}
            aria-valuemax={OPTIMIZER_STAT_MAX}
            aria-valuenow={safeMin}
            className={cn(
              "optimizer-range-thumb pointer-events-none absolute inset-0 z-20 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:pointer-events-auto",
              compact ? "h-6" : "h-8",
            )}
          />
        </div>

        {!compact ? (
          <>
            <p className="text-xs text-muted-foreground sm:hidden">{stat}</p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Achievable {achievableMin}–{achievableMax}
            </p>
          </>
        ) : null}
      </div>

      <div
        className={cn(
          "self-center text-right",
          compact ? "" : "row-span-2 sm:row-span-1",
        )}
      >
        <p
          className={cn(
            "tabular-nums font-semibold leading-none",
            compact ? "text-sm" : "text-base",
            safeMin > OPTIMIZER_STAT_MIN
              ? "text-foreground"
              : "text-muted-foreground",
          )}
        >
          {safeMin > OPTIMIZER_STAT_MIN ? safeMin : "—"}
        </p>
        {!compact ? (
          <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
            max {achievableMax}
          </p>
        ) : null}
      </div>
    </div>
  );
}
