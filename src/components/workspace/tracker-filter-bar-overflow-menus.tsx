"use client";

import { SlidersHorizontal } from "@phosphor-icons/react/dist/ssr";
import type { ArmorStatName } from "@/lib/db/types";
import type { TrackerOptionItem } from "@/lib/views/tracker-option";
import type { GridFilterRarity, GridFiltersJson } from "@/lib/workspace/grid-filters-schema";
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
} from "@/components/workspace/filter-bar-primitives";
import { HashCheckboxFilterDimension } from "@/components/workspace/hash-checkbox-filter-dimension";
import { RarityFilterDimension } from "@/components/workspace/rarity-filter-dimension";
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
  showRarityFilter: boolean;
  showSetFilter: boolean;
  sortedSets: TrackerOptionItem[];
  sortedArchetypes: TrackerOptionItem[];
  sortedTunings: TrackerOptionItem[];
  setHashesAsStrings: string[];
  selectedSetNames: string[];
  armorSetEmptyCopy: string;
  pinnedHashes: readonly string[];
  onTogglePin: (hash: string) => void;
  setsOpen: boolean;
  onSetsOpenChange: (open: boolean) => void;
  onSetHashesFromStrings: (next: string[]) => void;
  onToggleArchetype: (id: string, checked: boolean) => void;
  onToggleTuning: (id: string, checked: boolean) => void;
  onToggleStat: (stat: ArmorStatName, checked: boolean) => void;
  onSwitchRarity: (next: GridFilterRarity) => void;
  savedViews?: SavedViewsBarProps;
}

export function TrackerFilterBarOverflowMenus({
  collapseTier,
  value,
  onChange,
  showTertiaryStatFilter,
  showRarityFilter,
  showSetFilter,
  sortedSets,
  sortedArchetypes,
  sortedTunings,
  setHashesAsStrings,
  selectedSetNames,
  armorSetEmptyCopy,
  pinnedHashes,
  onTogglePin,
  setsOpen,
  onSetsOpenChange,
  onSetHashesFromStrings,
  onToggleArchetype,
  onToggleTuning,
  onToggleStat,
  onSwitchRarity,
  savedViews,
}: TrackerFilterBarOverflowMenusProps) {
  const moreSelectionCount = countMoreMenuSelections(
    collapseTier,
    value,
    showTertiaryStatFilter,
  );
  const fullFiltersSelectionCount = countFullFiltersSelections(value, {
    showTertiaryStatFilter,
    showRarityFilter,
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
              moreSelectionCount > 0 && INLINE_TRIGGER_ACTIVE_CLASS,
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
              emptyMessage="No archetypes — sync the manifest first."
              menuContentClass="min-w-64"
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
              emptyMessage="No tunings — sync the manifest first."
              menuContentClass="min-w-56"
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
              fullFiltersSelectionCount > 0 && INLINE_TRIGGER_ACTIVE_CLASS,
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
          {showRarityFilter ? (
            <RarityFilterDimension
              variant="stowed"
              value={value.rarity}
              onChange={onSwitchRarity}
              stowedSubTriggerClass={FILTER_STOWED_IN_FILTERS_CORE}
            />
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
            emptyMessage="No archetypes — sync the manifest first."
            menuContentClass="min-w-64"
            stowedSubTriggerClass={FILTER_STOWED_IN_FILTERS_ARCHETYPES}
          />
          <HashCheckboxFilterDimension
            variant="stowed"
            label="Tunings"
            options={sortedTunings}
            selectedHashes={value.tuningHashes}
            onToggle={onToggleTuning}
            onClear={() => onChange({ ...value, tuningHashes: [] })}
            emptyMessage="No tunings — sync the manifest first."
            menuContentClass="min-w-56"
            stowedSubTriggerClass={FILTER_STOWED_IN_FILTERS_TUNINGS_TERTIARY}
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
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
