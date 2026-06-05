"use client";

import {
  Compass,
  SlidersHorizontal,
  SquaresFour,
  Table,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useSlidingIndicator } from "@/lib/hooks/use-sliding-indicator";
import { chromeToolbarShellClass } from "@/components/ui/chrome-square-icon-button";

export type WorkspaceViewMode = "grid" | "table" | "optimizer" | "plan";

interface WorkspaceViewModeTabsProps {
  mode: WorkspaceViewMode;
  onModeChange: (mode: WorkspaceViewMode) => void;
}

const TABS: Array<{ value: WorkspaceViewMode; label: string; Icon: Icon }> = [
  { value: "table", label: "Table", Icon: Table },
  { value: "grid", label: "Tracker", Icon: SquaresFour },
  { value: "optimizer", label: "Optimize", Icon: SlidersHorizontal },
  { value: "plan", label: "Plan", Icon: Compass },
];

const segmentBtn =
  "relative z-10 flex h-9 shrink-0 items-center gap-1.5 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

export function WorkspaceViewModeTabs({
  mode,
  onModeChange,
}: WorkspaceViewModeTabsProps) {
  const activeIndex = TABS.findIndex((tab) => tab.value === mode);
  const {
    groupRef,
    registerTab,
    indicatorStyle,
    indicatorReady,
    animating,
    beginSlide,
    endSlide,
  } = useSlidingIndicator(activeIndex);

  const handleSelect = (next: WorkspaceViewMode) => {
    if (next !== mode) beginSlide();
    onModeChange(next);
  };

  return (
    <div
      ref={groupRef}
      className={cn(chromeToolbarShellClass, "relative pointer-events-auto")}
      role="group"
      aria-label="Workspace view"
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 z-0 bg-accent",
          animating &&
            "transition-[left,width] duration-200 ease-out motion-reduce:transition-none",
          !indicatorReady && "opacity-0",
        )}
        style={indicatorStyle}
        onTransitionEnd={endSlide}
      />
      {TABS.map((tab, index) => {
        const active = mode === tab.value;
        return (
          <button
            key={tab.value}
            ref={registerTab(index)}
            type="button"
            aria-pressed={active}
            className={cn(
              segmentBtn,
              index > 0 && "border-l border-border",
              active && "text-foreground",
            )}
            onClick={() => handleSelect(tab.value)}
          >
            <tab.Icon className="h-4 w-4" weight="duotone" aria-hidden />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
