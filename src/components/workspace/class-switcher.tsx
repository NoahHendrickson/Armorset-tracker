"use client";

import { CLASS_NAMES } from "@/lib/bungie/constants";
import type { GridFilterClass } from "@/lib/workspace/grid-filters-schema";
import { useSlidingIndicator } from "@/lib/hooks/use-sliding-indicator";
import { cn } from "@/lib/utils";

const CLASS_OPTIONS: Array<{ value: GridFilterClass; label: string }> = [
  { value: 0, label: CLASS_NAMES[0] ?? "Titan" },
  { value: 1, label: CLASS_NAMES[1] ?? "Hunter" },
  { value: 2, label: CLASS_NAMES[2] ?? "Warlock" },
];

/** Tab group tray — slightly recessed from surface (card/muted collapse to the same token). */
export const TAB_BAR_CLASS = "bg-accent/75 dark:bg-background/50";

/** One solid stroke (`--border`) — sliding active indicator only. */
export const SEGMENT_STROKE_CLASS = "border-border";

/** Sliding pill behind the active tab. */
export const CLASS_TAB_INDICATOR_CLASS = cn(
  SEGMENT_STROKE_CLASS,
  "bg-background dark:bg-accent",
);

/** @deprecated Use {@link CLASS_TAB_INDICATOR_CLASS} — kept for story/docs parity. */
export const CLASS_TAB_ACTIVE_CLASS = CLASS_TAB_INDICATOR_CLASS;

export const CLASS_TAB_IDLE_CLASS =
  "text-muted-foreground hover:bg-background/50 hover:text-foreground dark:hover:bg-accent/50 dark:hover:text-accent-foreground";

/** Table search compound fill — outer stroke lives on {@link EmbeddedClassSearchField}. */
export const EMBEDDED_SEARCH_CLASS =
  "bg-background text-foreground dark:bg-accent dark:text-accent-foreground";

export const EMBEDDED_SEARCH_ACTIVE_FILL = "bg-background/80 dark:bg-accent/80";

function classTabButtonClass(active: boolean, condensed: boolean): string {
  return cn(
    "relative z-10 flex shrink-0 items-center border border-transparent font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
    condensed
      ? "h-full min-h-0 self-stretch px-2 text-[10px] leading-none"
      : "h-9 px-3 text-xs",
    active ? "text-foreground" : CLASS_TAB_IDLE_CLASS,
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
  const activeIndex = CLASS_OPTIONS.findIndex((tab) => tab.value === value);
  const {
    groupRef,
    registerTab,
    indicatorStyle,
    indicatorReady,
    animating,
    beginSlide,
    endSlide,
  } = useSlidingIndicator(activeIndex);

  const handleSelect = (next: GridFilterClass) => {
    if (next !== value) beginSlide();
    onChange(next);
  };
  const isLastTab = activeIndex === CLASS_OPTIONS.length - 1;

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label="Class"
      className={cn(
        "relative flex w-fit min-w-0 shrink-0 items-stretch",
        TAB_BAR_CLASS,
        condensed ? "h-full min-h-0 self-stretch" : "h-9",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 z-0 border",
          animating &&
            "transition-[left,width] duration-200 ease-out motion-reduce:transition-none",
          CLASS_TAB_INDICATOR_CLASS,
          condensed &&
            "border-t-transparent border-b-transparent",
          condensed && isLastTab && "border-r-transparent",
          !indicatorReady && "opacity-0",
        )}
        style={indicatorStyle}
        onTransitionEnd={endSlide}
      />
      {CLASS_OPTIONS.map((tab, index) => {
        const active = value === tab.value;
        return (
          <button
            key={tab.value}
            ref={registerTab(index)}
            type="button"
            className={classTabButtonClass(active, condensed)}
            onClick={() => handleSelect(tab.value)}
            aria-pressed={active}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
