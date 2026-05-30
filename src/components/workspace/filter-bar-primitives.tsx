"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { CaretDown, X } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";

export const FILTER_MENU_CONTENT_CLASS =
  "max-h-[min(60vh,20rem)] min-w-56 overflow-y-auto rounded-none py-2 shadow-xl";

export const INLINE_TRIGGER_BASE_CLASS =
  "group/inline-trigger h-9 shrink-0 gap-1.5 rounded-none px-3 text-xs";

/** Brand-green border + light fill — filter triggers and action success flashes. */
export const INLINE_TRIGGER_ACTIVE_CLASS =
  "border-primary/60 bg-primary/10 font-medium text-foreground hover:border-primary/70 hover:bg-primary/20 hover:text-foreground";

/** Brighter than filter triggers — full border, stronger fill, saturated label. */
export const INLINE_TRIGGER_SUCCESS_FLASH_CLASS =
  "border-primary bg-primary/20 font-semibold text-primary inventory-action-success-flash";

export const INLINE_TRIGGER_FRAME_CLASS =
  "relative isolate shrink-0 focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background";

export function summarizeSelection(
  names: readonly string[],
  fallback: string,
): string {
  if (names.length === 0) return fallback;
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]}, ${names[1]}`;
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

interface InlineFilterTriggerProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  selectedNames: readonly string[];
  active: boolean;
  clearSibling?: boolean;
}

export const InlineFilterTrigger = forwardRef<
  HTMLButtonElement,
  InlineFilterTriggerProps
>(({ label, selectedNames, active, clearSibling, className, ...props }, ref) => {
  const summary = summarizeSelection(selectedNames, label);
  return (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      aria-label={`${label} filter`}
      className={cn(
        INLINE_TRIGGER_BASE_CLASS,
        "focus-visible:ring-0 focus-visible:ring-offset-0",
        active
          ? cn(
              INLINE_TRIGGER_ACTIVE_CLASS,
              "data-[state=open]:border-primary/60 data-[state=open]:bg-primary/10 data-[state=open]:text-foreground",
            )
          : "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
        className,
      )}
      {...props}
    >
      <span className="min-w-0 max-w-[14rem] flex-1 truncate text-left">
        {summary}
      </span>
      {clearSibling ? (
        <span aria-hidden className="inline-block w-5 shrink-0" />
      ) : null}
      <CaretDown
        weight="duotone"
        aria-hidden
        className="!size-3.5 shrink-0 opacity-60 transition group-hover/inline-trigger:opacity-90 group-data-[state=open]/inline-trigger:rotate-180"
      />
    </Button>
  );
});
InlineFilterTrigger.displayName = "InlineFilterTrigger";

export function InlineFilterClearButton({
  label,
  visible,
  onClear,
}: {
  label: string;
  visible: boolean;
  onClear: () => void;
}) {
  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label={`Clear ${label} filter`}
      title={`Clear ${label} filter`}
      onClick={onClear}
      className="group/clear pointer-events-auto absolute inset-y-0 right-8 z-10 flex w-5 items-center justify-center rounded-none border-0 bg-transparent p-0 text-muted-foreground shadow-none hover:text-foreground focus-visible:outline-none"
    >
      <X
        weight="bold"
        aria-hidden
        className="!size-3.5 opacity-60 transition group-hover/clear:opacity-90"
      />
    </button>
  );
}

export function FilterDimensionSubTrigger({
  label,
  selectionCount,
  className,
}: {
  label: string;
  selectionCount: number;
  className?: string;
}) {
  const active = selectionCount > 0;
  return (
    <DropdownMenuSubTrigger
      inset
      className={cn(active && "font-medium text-foreground", className)}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {active ? (
          <span
            className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-none bg-primary px-1 text-[10px] font-semibold leading-none tabular-nums text-primary-foreground"
            title={`${selectionCount} selected`}
          >
            {selectionCount}
          </span>
        ) : null}
      </span>
    </DropdownMenuSubTrigger>
  );
}
