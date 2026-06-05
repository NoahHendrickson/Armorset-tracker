"use client";

import {
  MAJOR_ARMOR_STAT_MOD,
  MINOR_ARMOR_STAT_MOD,
  totalAssumedModBudget,
  type AssumedStatMods,
} from "@/lib/optimizer/mod-offset";
import { cn } from "@/lib/utils";
import { OptimizerSegmentedControl } from "./optimizer-segmented-control";

const MAJOR_MOD_COUNTS = [0, 1, 2, 3, 4, 5] as const;
const PIECE_COUNT = 5;

export type AssumedStatModsPanelProps = {
  value: AssumedStatMods;
  onChange: (next: AssumedStatMods) => void;
  compact?: boolean;
  /** When false, only the major-count control is shown (no section title/blurb). */
  showHeader?: boolean;
  className?: string;
};

/** Major mod count; remaining armor pieces assume minor (+5) mods. */
export function AssumedStatModsPanel({
  value,
  onChange,
  compact = true,
  showHeader = true,
  className,
}: AssumedStatModsPanelProps) {
  const budget = totalAssumedModBudget(value, PIECE_COUNT);
  const modTotal = budget.total;

  return (
    <div
      className={cn(
        showHeader && "border-t border-border pt-3",
        compact ? "space-y-2.5" : "space-y-3",
        className,
      )}
    >
      {showHeader ? (
        <div>
          <p
            className={cn(
              "font-semibold uppercase tracking-wide text-muted-foreground",
              compact ? "text-[10px]" : "text-xs",
            )}
          >
            Assumed stat mods
          </p>
        </div>
      ) : null}

      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <span className="text-xs font-medium text-foreground">
            Major (+{MAJOR_ARMOR_STAT_MOD} each)
          </span>
          <OptimizerSegmentedControl
            ariaLabel="Major mod count"
            value={value.majorCount}
            options={MAJOR_MOD_COUNTS}
            compact={compact}
            onChange={(majorCount) => onChange({ ...value, majorCount })}
          />
        </div>
        <p className="text-[10px] tabular-nums text-muted-foreground">
          {modTotal > 0 ? (
            <>
              {budget.majorCount > 0 ? (
                <span>
                  {budget.majorCount} major (+{budget.majorTotal})
                </span>
              ) : null}
              {budget.majorCount > 0 && budget.minorCount > 0 ? ", " : null}
              {budget.minorCount > 0 ? (
                <span>
                  {budget.minorCount} minor (+{budget.minorTotal})
                </span>
              ) : null}
              {" · "}+{modTotal} on target stats
            </>
          ) : (
            "No stat mod budget"
          )}
        </p>
      </div>
    </div>
  );
}
