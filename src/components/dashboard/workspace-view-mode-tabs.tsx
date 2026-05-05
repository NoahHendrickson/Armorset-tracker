"use client";

import { SquaresFour, Table } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { chromeToolbarShellClass } from "@/components/ui/chrome-square-icon-button";

export type WorkspaceViewMode = "canvas" | "table";

interface WorkspaceViewModeTabsProps {
  mode: WorkspaceViewMode;
  onModeChange: (mode: WorkspaceViewMode) => void;
}

const segmentBtn =
  "flex h-10 shrink-0 items-center gap-1.5 px-3 text-xs font-medium uppercase tracking-wide text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/35 disabled:pointer-events-none disabled:opacity-50";

export function WorkspaceViewModeTabs({
  mode,
  onModeChange,
}: WorkspaceViewModeTabsProps) {
  return (
    <div
      className={cn(chromeToolbarShellClass, "pointer-events-auto")}
      role="tablist"
      aria-label="Workspace view"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "canvas"}
        className={cn(
          segmentBtn,
          mode === "canvas" && "bg-white/[0.08] text-white",
        )}
        onClick={() => onModeChange("canvas")}
      >
        <SquaresFour className="h-4 w-4" weight="duotone" aria-hidden />
        Canvas
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "table"}
        className={cn(
          segmentBtn,
          "border-l border-white/15",
          mode === "table" && "bg-white/[0.08] text-white",
        )}
        onClick={() => onModeChange("table")}
      >
        <Table className="h-4 w-4" weight="duotone" aria-hidden />
        Table
      </button>
    </div>
  );
}
