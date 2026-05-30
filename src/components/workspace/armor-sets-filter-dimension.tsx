"use client";

import {
  DropdownMenuSub,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { TrackerOptionItem } from "@/lib/views/tracker-option";
import { ArmorSetMultiSelectPanel } from "@/components/views/armor-set-multi-select";
import {
  FilterDimensionSubTrigger,
  INLINE_TRIGGER_FRAME_CLASS,
  InlineFilterClearButton,
  InlineFilterTrigger,
} from "@/components/workspace/filter-bar-primitives";

interface ArmorSetsFilterDimensionProps {
  options: TrackerOptionItem[];
  values: string[];
  onValuesChange: (hashes: string[]) => void;
  selectedNames: readonly string[];
  emptyCatalogMessage: string;
  pinnedHashes: readonly string[];
  onTogglePin: (hash: string) => void;
  classKey: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClear: () => void;
  variant: "inline" | "stowed";
  inlineWrapperClass?: string;
  stowedSubTriggerClass?: string;
}

export function ArmorSetsFilterDimension({
  options,
  values,
  onValuesChange,
  selectedNames,
  emptyCatalogMessage,
  pinnedHashes,
  onTogglePin,
  classKey,
  open,
  onOpenChange,
  onClear,
  variant,
  inlineWrapperClass = "",
  stowedSubTriggerClass = "",
}: ArmorSetsFilterDimensionProps) {
  const label = "Sets";
  const panel = (
    <ArmorSetMultiSelectPanel
      key={classKey}
      options={options}
      values={values}
      onValuesChange={onValuesChange}
      emptyCatalogMessage={emptyCatalogMessage}
      sharpCorners
      pinnedHashes={pinnedHashes}
      onTogglePin={onTogglePin}
      autoFocusSearch={open}
      className="max-h-[min(70vh,22rem)]"
    />
  );

  if (variant === "inline") {
    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <div className={cn(INLINE_TRIGGER_FRAME_CLASS, inlineWrapperClass)}>
          <PopoverTrigger asChild>
            <InlineFilterTrigger
              label={label}
              selectedNames={selectedNames}
              active={values.length > 0}
              clearSibling={values.length > 0}
              className="inline-flex min-w-0"
            />
          </PopoverTrigger>
          <InlineFilterClearButton
            label={label}
            visible={values.length > 0}
            onClear={onClear}
          />
        </div>
        <PopoverContent
          align="start"
          sideOffset={4}
          className="w-[min(90vw,22rem)] min-w-[18rem] rounded-none border-border p-0 shadow-xl"
          collisionPadding={16}
        >
          {panel}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <DropdownMenuSub>
      <FilterDimensionSubTrigger
        label="Armor sets"
        selectionCount={values.length}
        className={stowedSubTriggerClass}
      />
      <DropdownMenuSubContent
        className={cn(
          "w-[min(90vw,22rem)] min-w-[18rem] rounded-none border-border p-0 shadow-xl",
          stowedSubTriggerClass,
        )}
        collisionPadding={16}
      >
        <ArmorSetMultiSelectPanel
          key={`stowed-${classKey}`}
          options={options}
          values={values}
          onValuesChange={onValuesChange}
          emptyCatalogMessage={emptyCatalogMessage}
          sharpCorners
          pinnedHashes={pinnedHashes}
          onTogglePin={onTogglePin}
          autoFocusSearch
          className="max-h-[min(70vh,22rem)]"
        />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
