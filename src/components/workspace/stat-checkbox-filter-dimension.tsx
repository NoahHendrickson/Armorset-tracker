"use client";

import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  FILTER_MENU_CONTENT_CLASS,
  FilterDimensionSubTrigger,
  INLINE_TRIGGER_FRAME_CLASS,
  InlineFilterClearButton,
  InlineFilterTrigger,
} from "@/components/workspace/filter-bar-primitives";

interface StatCheckboxFilterDimensionProps {
  selectedStats: readonly ArmorStatName[];
  onToggle: (stat: ArmorStatName, checked: boolean) => void;
  onClear: () => void;
  variant: "inline" | "stowed";
  inlineWrapperClass?: string;
  stowedSubTriggerClass?: string;
}

export function StatCheckboxFilterDimension({
  selectedStats,
  onToggle,
  onClear,
  variant,
  inlineWrapperClass = "",
  stowedSubTriggerClass = "",
}: StatCheckboxFilterDimensionProps) {
  const label = "Tertiary stats";
  const menuItems = ARMOR_STAT_NAMES.map((stat) => (
    <DropdownMenuCheckboxItem
      key={stat}
      checked={selectedStats.includes(stat)}
      onSelect={(e) => e.preventDefault()}
      onCheckedChange={(c) => onToggle(stat, c)}
    >
      {stat}
    </DropdownMenuCheckboxItem>
  ));

  if (variant === "inline") {
    return (
      <DropdownMenu modal={false}>
        <div className={cn(INLINE_TRIGGER_FRAME_CLASS, inlineWrapperClass)}>
          <DropdownMenuTrigger asChild>
            <InlineFilterTrigger
              label={label}
              selectedNames={selectedStats}
              active={selectedStats.length > 0}
              clearSibling={selectedStats.length > 0}
              className="inline-flex min-w-0"
            />
          </DropdownMenuTrigger>
          <InlineFilterClearButton
            label={label}
            visible={selectedStats.length > 0}
            onClear={onClear}
          />
        </div>
        <DropdownMenuContent
          align="start"
          className={cn(FILTER_MENU_CONTENT_CLASS, "min-w-48")}
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
        selectionCount={selectedStats.length}
        className={stowedSubTriggerClass}
      />
      <DropdownMenuSubContent
        className={cn(
          FILTER_MENU_CONTENT_CLASS,
          "min-w-48",
          stowedSubTriggerClass,
        )}
        collisionPadding={16}
      >
        {menuItems}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
