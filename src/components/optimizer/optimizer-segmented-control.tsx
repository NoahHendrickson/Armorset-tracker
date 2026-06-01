"use client";

import { cn } from "@/lib/utils";

function segmentButtonClass(active: boolean, compact: boolean): string {
  return cn(
    "flex shrink-0 items-center justify-center border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
    compact ? "size-7 text-xs tabular-nums" : "h-9 min-w-9 px-3 text-xs",
    active
      ? "border-border bg-background/80 text-foreground dark:bg-accent/80 dark:text-accent-foreground"
      : "border-transparent text-muted-foreground hover:bg-background/50 hover:text-foreground dark:hover:bg-accent/50 dark:hover:text-accent-foreground",
  );
}

export type OptimizerSegmentedControlProps<T extends string | number> = {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  ariaLabel: string;
  formatOption?: (value: T) => string;
  compact?: boolean;
  className?: string;
};

/** Compact aria-pressed segments — same chrome as ClassSwitcher tabs. */
export function OptimizerSegmentedControl<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  formatOption,
  compact = true,
  className,
}: OptimizerSegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex min-w-0 shrink-0 bg-card",
        compact ? "h-7" : "h-9",
        className,
      )}
    >
      {options.map((option) => {
        const active = value === option;
        return (
          <button
            key={String(option)}
            type="button"
            aria-pressed={active}
            className={segmentButtonClass(active, compact)}
            onClick={() => onChange(option)}
          >
            {formatOption?.(option) ?? String(option)}
          </button>
        );
      })}
    </div>
  );
}
