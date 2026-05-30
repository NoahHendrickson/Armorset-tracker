"use client";

import {
  GRID_FILTER_RARITY_VALUES,
  type GridFilterRarity,
} from "@/lib/workspace/grid-filters-schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  FILTER_MENU_CONTENT_CLASS,
  FilterDimensionSubTrigger,
  INLINE_TRIGGER_FRAME_CLASS,
  InlineFilterTrigger,
} from "@/components/workspace/filter-bar-primitives";

const RARITY_LABELS: Record<GridFilterRarity, string> = {
  legendary: "Legendary",
  exotic: "Exotic",
};

const LABEL = "Rarity";

interface RarityFilterDimensionProps {
  value: GridFilterRarity;
  onChange: (next: GridFilterRarity) => void;
  variant: "inline" | "stowed";
  inlineWrapperClass?: string;
  stowedSubTriggerClass?: string;
}

export function RarityFilterDimension({
  value,
  onChange,
  variant,
  inlineWrapperClass = "",
  stowedSubTriggerClass = "",
}: RarityFilterDimensionProps) {
  // Default (legendary) reads as the neutral baseline; only highlight when the
  // user has switched away from it.
  const active = value !== "legendary";

  const menuItems = (
    <DropdownMenuRadioGroup
      value={value}
      onValueChange={(v) => onChange(v as GridFilterRarity)}
    >
      {GRID_FILTER_RARITY_VALUES.map((rarity) => (
        <DropdownMenuRadioItem key={rarity} value={rarity}>
          {RARITY_LABELS[rarity]}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );

  if (variant === "inline") {
    return (
      <DropdownMenu modal={false}>
        <div className={cn(INLINE_TRIGGER_FRAME_CLASS, inlineWrapperClass)}>
          <DropdownMenuTrigger asChild>
            <InlineFilterTrigger
              label={LABEL}
              selectedNames={[RARITY_LABELS[value]]}
              active={active}
              className="inline-flex min-w-0"
            />
          </DropdownMenuTrigger>
        </div>
        <DropdownMenuContent
          align="start"
          className={cn(FILTER_MENU_CONTENT_CLASS, "min-w-40")}
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
        label={LABEL}
        selectionCount={active ? 1 : 0}
        className={stowedSubTriggerClass}
      />
      <DropdownMenuSubContent
        className={cn(FILTER_MENU_CONTENT_CLASS, "min-w-40", stowedSubTriggerClass)}
        collisionPadding={16}
      >
        {menuItems}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
