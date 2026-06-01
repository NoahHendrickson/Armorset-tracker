"use client";

import { CLASS_NAMES } from "@/lib/bungie/constants";
import type { GridFilterClass } from "@/lib/workspace/grid-filters-schema";
import { cn } from "@/lib/utils";

const CLASS_OPTIONS: Array<{ value: GridFilterClass; label: string }> = [
  { value: 0, label: CLASS_NAMES[0] ?? "Titan" },
  { value: 1, label: CLASS_NAMES[1] ?? "Hunter" },
  { value: 2, label: CLASS_NAMES[2] ?? "Warlock" },
];

function classTabButtonClass(active: boolean, condensed: boolean): string {
  return cn(
    "flex shrink-0 items-center border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
    condensed ? "h-full self-stretch px-2 text-[10px] leading-none" : "h-9 px-3 text-xs",
    condensed
      ? active
        ? "border-transparent bg-primary/15 font-semibold text-foreground"
        : "border-transparent text-muted-foreground hover:bg-background/50 hover:text-foreground dark:hover:bg-accent/50 dark:hover:text-accent-foreground"
      : active
        ? "border-border bg-background/80 text-foreground dark:bg-accent/80 dark:text-accent-foreground"
        : "border-transparent text-muted-foreground hover:bg-background/50 hover:text-foreground dark:hover:bg-accent/50 dark:hover:text-accent-foreground",
  );
}

export interface ClassSwitcherProps {
  value: GridFilterClass;
  onChange: (next: GridFilterClass) => void;
  /** Compact tabs for embedding inside the table search field. */
  variant?: "default" | "condensed";
  className?: string;
}

/** Titan / Hunter / Warlock tabs — same chrome as the tracker filter bar. */
export function ClassSwitcher({
  value,
  onChange,
  variant = "default",
  className,
}: ClassSwitcherProps) {
  const condensed = variant === "condensed";

  return (
    <div
      role="group"
      aria-label="Class"
      className={cn(
        condensed
          ? "flex shrink-0 items-stretch self-stretch pl-1"
          : "flex h-9 min-w-0 shrink-0 bg-card",
        className,
      )}
    >
      {CLASS_OPTIONS.map((tab) => {
        const active = value === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            className={classTabButtonClass(active, condensed)}
            onClick={() => onChange(tab.value)}
            aria-pressed={active}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
