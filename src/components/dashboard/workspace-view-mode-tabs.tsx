"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  Compass,
  SlidersHorizontal,
  SquaresFour,
  Table,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
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
  const groupRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [indicatorReady, setIndicatorReady] = useState(false);
  // Stays false on first paint so the pill snaps to the initial tab without a
  // slide; flips true on user selection so subsequent switches animate.
  const [animateIndicator, setAnimateIndicator] = useState(false);

  const activeIndex = TABS.findIndex((tab) => tab.value === mode);

  useLayoutEffect(() => {
    const update = () => {
      const group = groupRef.current;
      const tab = activeIndex >= 0 ? tabRefs.current[activeIndex] : null;
      if (!group || !tab) return;
      const groupRect = group.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();
      setIndicator({
        left: tabRect.left - groupRect.left,
        width: tabRect.width,
      });
      setIndicatorReady(true);
    };

    update();
    const group = groupRef.current;
    if (!group) return;
    const observer = new ResizeObserver(update);
    observer.observe(group);
    return () => observer.disconnect();
  }, [activeIndex]);

  const handleSelect = (next: WorkspaceViewMode) => {
    if (next !== mode) setAnimateIndicator(true);
    onModeChange(next);
  };

  return (
    <div
      ref={groupRef}
      className={cn(chromeToolbarShellClass, "relative pointer-events-auto")}
      role="tablist"
      aria-label="Workspace view"
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 z-0 bg-accent",
          animateIndicator &&
            "transition-[left,width] duration-200 ease-out motion-reduce:transition-none",
          !indicatorReady && "opacity-0",
        )}
        style={{ left: indicator.left, width: indicator.width }}
        onTransitionEnd={() => setAnimateIndicator(false)}
      />
      {TABS.map((tab, index) => {
        const active = mode === tab.value;
        return (
          <button
            key={tab.value}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            type="button"
            role="tab"
            aria-selected={active}
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
