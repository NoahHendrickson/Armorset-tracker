"use client";

import { useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { TrackerOptionItem } from "@/lib/views/tracker-option";
import {
  FILTER_MENU_CONTENT_CLASS,
  FilterDimensionSubTrigger,
  INLINE_TRIGGER_FRAME_CLASS,
  InlineFilterClearButton,
  InlineFilterTrigger,
} from "@/components/workspace/filter-bar-primitives";

interface HashCheckboxFilterDimensionProps {
  label: string;
  options: TrackerOptionItem[];
  selectedHashes: readonly number[];
  onToggle: (id: string, checked: boolean) => void;
  onClear: () => void;
  emptyMessage: string;
  variant: "inline" | "stowed";
  /** Inline only: wrapper visibility (e.g. `hidden md:inline-flex`). */
  inlineWrapperClass?: string;
  /** Stowed only: sub-trigger visibility (e.g. `md:hidden`). */
  stowedSubTriggerClass?: string;
  menuContentClass?: string;
}

export function HashCheckboxFilterDimension({
  label,
  options,
  selectedHashes,
  onToggle,
  onClear,
  emptyMessage,
  variant,
  inlineWrapperClass = "",
  stowedSubTriggerClass = "",
  menuContentClass,
}: HashCheckboxFilterDimensionProps) {
  const selectedIds = useMemo(
    () => selectedHashes.map(String),
    [selectedHashes],
  );

  const selectedNames = useMemo(() => {
    const byHash = new Map(options.map((o) => [o.hash, o.name] as const));
    return selectedHashes
      .map((h) => byHash.get(h))
      .filter((n): n is string => Boolean(n));
  }, [options, selectedHashes]);

  const menuItems =
    options.length === 0 ? (
      <div className="px-3 py-2.5 text-sm text-muted-foreground/80">
        {emptyMessage}
      </div>
    ) : (
      options.map((opt) => {
        const id = String(opt.hash);
        return (
          <DropdownMenuCheckboxItem
            key={opt.hash}
            checked={selectedIds.includes(id)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(c) => onToggle(id, c)}
          >
            {opt.name}
          </DropdownMenuCheckboxItem>
        );
      })
    );

  if (variant === "inline") {
    return (
      <DropdownMenu modal={false}>
        <div className={cn(INLINE_TRIGGER_FRAME_CLASS, inlineWrapperClass)}>
          <DropdownMenuTrigger asChild>
            <InlineFilterTrigger
              label={label}
              selectedNames={selectedNames}
              active={selectedHashes.length > 0}
              clearSibling={selectedHashes.length > 0}
              className="inline-flex min-w-0"
            />
          </DropdownMenuTrigger>
          <InlineFilterClearButton
            label={label}
            visible={selectedHashes.length > 0}
            onClear={onClear}
          />
        </div>
        <DropdownMenuContent
          align="start"
          className={cn(FILTER_MENU_CONTENT_CLASS, menuContentClass)}
          collisionPadding={16}
        >
          {menuItems}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenuSub>
      <FilterDimensionSubTrigger
        label={label}
        selectionCount={selectedHashes.length}
        className={stowedSubTriggerClass}
      />
      <DropdownMenuSubContent
        className={cn(
          FILTER_MENU_CONTENT_CLASS,
          menuContentClass,
          stowedSubTriggerClass,
        )}
        collisionPadding={16}
      >
        {menuItems}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
