"use client";

import type { AssumedStatMods } from "@/lib/optimizer/mod-offset";
import { OptimizerSegmentedControl } from "./optimizer-segmented-control";

const MAJOR_MOD_COUNTS = [0, 1, 2, 3, 4, 5] as const;

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
  const control = (
    <OptimizerSegmentedControl
      ariaLabel="Major mod count"
      value={value.majorCount}
      options={MAJOR_MOD_COUNTS}
      compact={compact}
      onChange={(majorCount) => onChange({ ...value, majorCount })}
    />
  );

  if (!showHeader) {
    return <div className={className}>{control}</div>;
  }

  return (
    <div className={className}>
      <h2 className="text-sm font-semibold tracking-wide text-foreground">
        Major mods used
      </h2>
      <div className={compact ? "mt-2" : "mt-3"}>{control}</div>
    </div>
  );
}
