"use client";

import { SlidersHorizontal } from "@phosphor-icons/react/dist/ssr";
import type { ArmorStatName } from "@/lib/db/types";
import type { TrackerOptionItem } from "@/lib/views/tracker-option";
import type { GridFiltersJson } from "@/lib/workspace/grid-filters-schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArmorSetsFilterDimension } from "@/components/workspace/armor-sets-filter-dimension";
import {
  countFullFiltersSelections,
  countMoreMenuSelections,
  tierIncludesMoreMenuDimension,
  type FilterBarCollapseTier,
} from "@/components/workspace/filter-bar-collapse-policy";
import {
  FILTER_FULL_MENU_BUTTON,
  FILTER_MORE_MENU_BUTTON,
  FILTER_STOWED_IN_FILTERS_ARCHETYPES,
  FILTER_STOWED_IN_FILTERS_CORE,
  FILTER_STOWED_IN_FILTERS_TUNINGS_TERTIARY,
  INLINE_TRIGGER_ACTIVE_CLASS,
  INLINE_TRIGGER_IDLE_CLASS,
} from "@/components/workspace/filter-bar-primitives";
import { HashCheckboxFilterDimension } from "@/components/workspace/hash-checkbox-filter-dimension";
import {
  SavedViewsMenu,
  type SavedViewsBarProps,
} from "@/components/workspace/saved-views-menu";
import { StatCheckboxFilterDimension } from "@/components/workspace/stat-checkbox-filter-dimension";

export interface TrackerFilterBarOverflowMenusProps {
  collapseTier: FilterBarCollapseTier;
  value: GridFiltersJson;
  onChange: (next: GridFiltersJson) => void;
  showTertiaryStatFilter: boolean;
  showSetFilter: boolean;
  sortedSets: TrackerOptionItem[];
  sortedArchetypes: TrackerOptionItem[];
  sortedTunings: TrackerOptionItem[];
  setHashesAsStrings: string[];
  selectedSetNames: string[];
  armorSetEmptyCopy: string;
  archetypeEmptyCopy: string;
  tuningEmptyCopy: string;
  pinnedHashes: readonly string[];
  onTogglePin: (hash: string) => void;
  setsOpen: boolean;
  onSetsOpenChange: (open: boolean) => void;
  onSetHashesFromStrings: (next: string[]) => void;
  onToggleArchetype: (id: string, checked: boolean) => void;
  onToggleTuning: (id: string, checked: boolean) => void;
  onToggleStat: (stat: ArmorStatName, checked: boolean) => void;
  savedViews?: SavedViewsBarProps;
}

export function TrackerFilterBarOverflowMenus({
  collapseTier,
  value,
  onChange,
  showTertiaryStatFilter,
  showSetFilter,
  sortedSets,
  sortedArchetypes,
  sortedTunings,
  setHashesAsStrings,
  selectedSetNames,
  armorSetEmptyCopy,
  archetypeEmptyCopy,
  tuningEmptyCopy,
  pinnedHashes,
  onTogglePin,
  setsOpen,
  onSetsOpenChange,
  onSetHashesFromStrings,
  onToggleArchetype,
  onToggleTuning,
  onToggleStat,
  savedViews,
}: TrackerFilterBarOverflowMenusProps) {
  const moreSelectionCount = countMoreMenuSelections(
    collapseTier,
    value,
    showTertiaryStatFilter,
  );
  const fullFiltersSelectionCount = countFullFiltersSelections(value, {
    showTertiaryStatFilter,
    savedViews,
  });

  const showArchetypesInMore = tierIncludesMoreMenuDimension(
    collapseTier,
    "archetypes",
  );
  const showTuningsInMore = tierIncludesMoreMenuDimension(
    collapseTier,
    "tunings",
  );
  const showTertiaryInMore =
    showTertiaryStatFilter &&
    tierIncludesMoreMenuDimension(collapseTier, "tertiary");

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-label="More filters"
            className={cn(
              "relative h-9 shrink-0 gap-1.5 rounded-none px-3 text-xs",
              FILTER_MORE_MENU_BUTTON,
              moreSelectionCount > 0
                ? INLINE_TRIGGER_ACTIVE_CLASS
                : INLINE_TRIGGER_IDLE_CLASS,
            )}
          >
            <SlidersHorizontal weight="duotone" aria-hidden className="size-4" />
            <span>More</span>
            {moreSelectionCount > 0 ? (
              <span
                className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-none bg-primary px-1 text-[10px] font-semibold leading-none tabular-nums text-primary-foreground"
                title={`${moreSelectionCount} active`}
              >
                {moreSelectionCount}
              </span>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="min-w-48 rounded-none py-1"
        >
          {showArchetypesInMore ? (
            <HashCheckboxFilterDimension
              variant="stowed"
              label="Archetypes"
              options={sortedArchetypes}
              selectedHashes={value.archetypeHashes}
              onToggle={onToggleArchetype}
              onClear={() => onChange({ ...value, archetypeHashes: [] })}
              emptyMessage={archetypeEmptyCopy}
              menuContentClass="min-w-64"
            />
          ) : null}
          {showTertiaryInMore ? (
            <StatCheckboxFilterDimension
              variant="stowed"
              selectedStats={value.tertiaryStats}
              onToggle={onToggleStat}
              onClear={() => onChange({ ...value, tertiaryStats: [] })}
            />
          ) : null}
          {showTuningsInMore ? (
            <HashCheckboxFilterDimension
              variant="stowed"
              label="Tunings"
              options={sortedTunings}
              selectedHashes={value.tuningHashes}
              onToggle={onToggleTuning}
              onClear={() => onChange({ ...value, tuningHashes: [] })}
              emptyMessage={tuningEmptyCopy}
              menuContentClass="min-w-56"
            />
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-label="Filters"
            className={cn(
              "relative h-9 shrink-0 gap-1.5 rounded-none px-3 text-xs",
              FILTER_FULL_MENU_BUTTON,
              fullFiltersSelectionCount > 0
                ? INLINE_TRIGGER_ACTIVE_CLASS
                : INLINE_TRIGGER_IDLE_CLASS,
            )}
          >
            <SlidersHorizontal weight="duotone" aria-hidden className="size-4" />
            <span>Filters</span>
            {fullFiltersSelectionCount > 0 ? (
              <span
                className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-none bg-primary px-1 text-[10px] font-semibold leading-none tabular-nums text-primary-foreground"
                title={`${fullFiltersSelectionCount} active filter${fullFiltersSelectionCount === 1 ? "" : "s"}`}
              >
                {fullFiltersSelectionCount}
              </span>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="min-w-48 rounded-none py-1"
        >
          {savedViews ? (
            <SavedViewsMenu {...savedViews} variant="stowed" />
          ) : null}
          {showSetFilter ? (
            <ArmorSetsFilterDimension
              variant="stowed"
              options={sortedSets}
              values={setHashesAsStrings}
              onValuesChange={onSetHashesFromStrings}
              selectedNames={selectedSetNames}
              emptyCatalogMessage={armorSetEmptyCopy}
              pinnedHashes={pinnedHashes}
              onTogglePin={onTogglePin}
              classKey={value.class}
              open={setsOpen}
              onOpenChange={onSetsOpenChange}
              onClear={() => onChange({ ...value, setHashes: [] })}
              stowedSubTriggerClass={FILTER_STOWED_IN_FILTERS_CORE}
            />
          ) : null}
          <HashCheckboxFilterDimension
            variant="stowed"
            label="Archetypes"
            options={sortedArchetypes}
            selectedHashes={value.archetypeHashes}
            onToggle={onToggleArchetype}
            onClear={() => onChange({ ...value, archetypeHashes: [] })}
            emptyMessage={archetypeEmptyCopy}
            menuContentClass="min-w-64"
            stowedSubTriggerClass={FILTER_STOWED_IN_FILTERS_ARCHETYPES}
          />
          {showTertiaryStatFilter ? (
            <StatCheckboxFilterDimension
              variant="stowed"
              selectedStats={value.tertiaryStats}
              onToggle={onToggleStat}
              onClear={() => onChange({ ...value, tertiaryStats: [] })}
              stowedSubTriggerClass={FILTER_STOWED_IN_FILTERS_TUNINGS_TERTIARY}
            />
          ) : null}
          <HashCheckboxFilterDimension
            variant="stowed"
            label="Tunings"
            options={sortedTunings}
            selectedHashes={value.tuningHashes}
            onToggle={onToggleTuning}
            onClear={() => onChange({ ...value, tuningHashes: [] })}
            emptyMessage={tuningEmptyCopy}
            menuContentClass="min-w-56"
            stowedSubTriggerClass={FILTER_STOWED_IN_FILTERS_TUNINGS_TERTIARY}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
