"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { ArmorStatIcon } from "@/components/ui/armor-stat-icon";
import { Input } from "@/components/ui/input";
import type { ArmorStatName } from "@/lib/db/types";
import {
  clampOptimizerStat,
  isOptimizerStatTick,
  OPTIMIZER_STAT_MAX,
  OPTIMIZER_STAT_MIN,
  OPTIMIZER_STAT_TICKS,
  OPTIMIZER_TRACK_INSET,
  pctOnOptimizerTrack,
  snapOptimizerStat,
  valueFromTrackRatio,
} from "@/lib/optimizer/stat-range";
import { cn } from "@/lib/utils";

function anchorPositionStyle(value: number): CSSProperties {
  return {
    left: `${pctOnOptimizerTrack(value)}%`,
    transform: "translate(-50%, -50%)",
  };
}

function anchorLabelStyle(value: number): CSSProperties {
  return {
    left: `${pctOnOptimizerTrack(value)}%`,
    transform: "translateX(-50%)",
  };
}

function StatTrackTick({
  active,
  compact,
}: {
  active: boolean;
  compact: boolean;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden",
        compact ? "h-3.5 w-1.5" : "h-4 w-1.5",
        active
          ? "bg-[var(--optimizer-tick-active-outer)]"
          : "bg-[var(--optimizer-tick-inactive-outer)]",
      )}
      aria-hidden
    >
      <span
        className={cn(
          compact ? "h-2.5 w-1" : "h-3 w-1",
          active
            ? "bg-[var(--optimizer-tick-active-inner)]"
            : "bg-[var(--optimizer-tick-inactive-inner)]",
        )}
      />
    </span>
  );
}

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
  const trackRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<string | null>(null);
  const [draftValue, setDraftValue] = useState<string | null>(null);
  const trackInset = compact
    ? OPTIMIZER_TRACK_INSET.compact
    : OPTIMIZER_TRACK_INSET.default;

  const safeMin = clampOptimizerStat(min);
  const isTargeted = safeMin > OPTIMIZER_STAT_MIN;
  const selWidth = pctOnOptimizerTrack(safeMin);
  const showValueTick = isTargeted && !isOptimizerStatTick(safeMin);

  useEffect(() => {
    draftRef.current = null;
    setDraftValue(null);
  }, [safeMin]);

  const setMin = useCallback(
    (next: number) => {
      onChange(clampOptimizerStat(next));
    },
    [onChange],
  );

  const commitDraftValue = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed === "") {
        setMin(OPTIMIZER_STAT_MIN);
        draftRef.current = null;
        setDraftValue(null);
        return;
      }
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed <= OPTIMIZER_STAT_MIN) {
        setMin(OPTIMIZER_STAT_MIN);
      } else {
        setMin(parsed);
      }
      draftRef.current = null;
      setDraftValue(null);
    },
    [setMin],
  );

  const applyTrackValue = useCallback(
    (rawValue: number) => {
      const snapped = snapOptimizerStat(rawValue);
      if (safeMin === snapped && snapped > OPTIMIZER_STAT_MIN) {
        setMin(OPTIMIZER_STAT_MIN);
        return;
      }
      setMin(snapped);
    },
    [safeMin, setMin],
  );

  const valueFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return safeMin;
      const rect = el.getBoundingClientRect();
      const ratio = (clientX - rect.left) / Math.max(1, rect.width);
      return valueFromTrackRatio(ratio);
    },
    [safeMin],
  );

  const handleTrackPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      applyTrackValue(valueFromClientX(event.clientX));
    },
    [applyTrackValue, valueFromClientX],
  );

  const handleAchievableDoubleClick = () => {
    onChange(clampOptimizerStat(achievableMax));
  };

  const bandMin = Math.max(OPTIMIZER_STAT_MIN, achievableMin);
  const bandMax = Math.max(bandMin, achievableMax);
  let achLeft = pctOnOptimizerTrack(bandMin);
  let achWidth = Math.max(0, pctOnOptimizerTrack(bandMax) - achLeft);
  const MIN_BAND_PCT = 3;
  if (achWidth < MIN_BAND_PCT && bandMax > OPTIMIZER_STAT_MIN) {
    achWidth = MIN_BAND_PCT;
    achLeft = Math.min(achLeft, 100 - MIN_BAND_PCT);
  }

  const valueInput = (
    <Input
      type="number"
      min={OPTIMIZER_STAT_MIN}
      max={OPTIMIZER_STAT_MAX}
      step={1}
      inputMode="numeric"
      aria-label={`${stat} minimum`}
      data-testid="stat-min-input"
      value={draftValue ?? String(safeMin)}
      onChange={(e) => {
        draftRef.current = e.target.value;
        setDraftValue(e.target.value);
      }}
      onBlur={() => commitDraftValue(draftRef.current ?? String(safeMin))}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commitDraftValue(draftRef.current ?? String(safeMin));
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "shadow-none focus-visible:ring-1",
        "border-[var(--optimizer-value-border)] bg-transparent tabular-nums leading-none text-foreground",
        "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        compact
          ? "h-5 min-w-[2.75rem] px-1 text-center text-xs"
          : "h-6 min-w-[3rem] px-1.5 text-center text-sm",
      )}
    />
  );

  return (
    <div
      className={cn(
        "grid items-center text-sm",
        compact
          ? "grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3"
          : "grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-1 sm:grid-cols-[auto_5rem_minmax(0,1fr)_auto]",
      )}
    >
      <ArmorStatIcon
        stat={stat}
        iconPath={iconPath}
        size="md"
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
          compact ? "col-span-1" : "col-span-2 sm:col-span-1",
        )}
      >
        <div
          className={cn(
            "relative touch-none select-none",
            compact ? "pt-2 pb-5" : "pt-2 pb-5",
          )}
          role="group"
          aria-labelledby={labelId}
        >
          <div
            ref={trackRef}
            className="absolute left-0 right-0 top-1/2 -translate-y-1/2"
            style={{ left: trackInset, right: trackInset, height: "0.875rem" }}
          >
            <div
              className={cn(
                "absolute top-1/2 right-0 left-0 -translate-y-1/2 bg-[var(--optimizer-track-inactive)]",
                compact ? "h-1.5" : "h-2",
              )}
            />

            {isTargeted ? (
              <div
                className={cn(
                  "absolute top-1/2 z-[4] -translate-y-1/2 bg-gradient-to-r from-[var(--optimizer-track-active-from)] to-[var(--optimizer-track-active-to)]",
                  compact ? "h-1.5" : "h-2",
                )}
                style={{ left: "0%", width: `${selWidth}%` }}
                aria-hidden
              />
            ) : null}

            {bandMax > OPTIMIZER_STAT_MIN ? (
              <div
                className={cn(
                  "absolute top-1/2 z-[6] -translate-y-1/2 bg-[var(--optimizer-track-achievable)]",
                  compact ? "h-1.5" : "h-2",
                )}
                style={{ left: `${achLeft}%`, width: `${achWidth}%` }}
                title={`Achievable ${bandMin}–${bandMax} — double-click to set min to ${bandMax}`}
                onDoubleClick={handleAchievableDoubleClick}
              />
            ) : null}

            {OPTIMIZER_STAT_TICKS.map((tick) => (
              <div
                key={tick}
                className="pointer-events-none absolute top-1/2 z-[12]"
                style={anchorPositionStyle(tick)}
              >
                <StatTrackTick
                  active={isTargeted && tick <= safeMin}
                  compact={compact}
                />
              </div>
            ))}

            {showValueTick ? (
              <div
                className="pointer-events-none absolute top-1/2 z-[13]"
                style={anchorPositionStyle(safeMin)}
              >
                <StatTrackTick active compact={compact} />
              </div>
            ) : null}

            <button
              type="button"
              tabIndex={-1}
              data-testid="stat-range-track-hit"
              className={cn(
                "absolute inset-x-0 top-1/2 z-[14] -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0",
                compact ? "h-8" : "h-9",
              )}
              aria-hidden
              onPointerDown={handleTrackPointerDown}
            />

            <input
              type="range"
              min={OPTIMIZER_STAT_MIN}
              max={OPTIMIZER_STAT_MAX}
              step={1}
              value={safeMin}
              onChange={(e) => setMin(Number(e.target.value))}
              aria-label={`${stat} minimum on track`}
              aria-valuemin={OPTIMIZER_STAT_MIN}
              aria-valuemax={OPTIMIZER_STAT_MAX}
              aria-valuenow={safeMin}
              className={cn(
                "optimizer-range-thumb pointer-events-none absolute inset-x-0 top-1/2 z-20 w-full -translate-y-1/2 appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:pointer-events-auto",
                compact ? "h-8" : "h-9",
                compact && "optimizer-range-thumb-compact",
              )}
            />
          </div>

          <div
            className={cn(
              "pointer-events-none absolute bottom-0 left-0 right-0 leading-none text-muted-foreground",
              compact ? "text-[10px]" : "text-xs",
            )}
            style={{ left: trackInset, right: trackInset }}
          >
            {OPTIMIZER_STAT_TICKS.map((tick) => (
              <span
                key={tick}
                className="absolute whitespace-nowrap"
                style={anchorLabelStyle(tick)}
              >
                {tick}
              </span>
            ))}
          </div>
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
          "self-center",
          compact ? "" : "row-span-2 sm:row-span-1",
        )}
      >
        {valueInput}
        {!compact ? (
          <p className="mt-0.5 text-center text-[10px] tabular-nums text-muted-foreground">
            max {achievableMax}
          </p>
        ) : null}
      </div>
    </div>
  );
}
