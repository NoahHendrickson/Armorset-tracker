"use client";

import { useMemo, useRef, useState } from "react";
import { useFilterBarCollapseTier } from "@/components/workspace/use-filter-bar-collapse-tier";
import {
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { CLASS_NAMES } from "@/lib/bungie/constants";
import type { ArmorStatName } from "@/lib/db/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { chromeToolbarShellClass } from "@/components/ui/chrome-square-icon-button";
import type { TrackerFormSelectors } from "@/lib/views/tracker-form-selectors";
import {
  gridFiltersHaveUnblockingSelection,
  inventoryFiltersHaveShareableSelection,
  type GridFilterClass,
  type GridFilterRarity,
  type GridFiltersJson,
} from "@/lib/workspace/grid-filters-schema";
import { ShareFilterLinkButton } from "@/components/workspace/share-filter-link-button";
import { ArmorSetsFilterDimension } from "@/components/workspace/armor-sets-filter-dimension";
import { HashCheckboxFilterDimension } from "@/components/workspace/hash-checkbox-filter-dimension";
import { StatCheckboxFilterDimension } from "@/components/workspace/stat-checkbox-filter-dimension";
import { RarityFilterDimension } from "@/components/workspace/rarity-filter-dimension";
import {
  FILTER_BAR_CONTAINER_CLASS,
  FILTER_INLINE_ARCHETYPES,
  FILTER_INLINE_CORE,
  FILTER_INLINE_TUNINGS_TERTIARY,
} from "@/components/workspace/filter-bar-primitives";
import {
  SavedViewsMenu,
  type SavedViewsBarProps,
} from "@/components/workspace/saved-views-menu";
import { TrackerFilterBarOverflowMenus } from "@/components/workspace/tracker-filter-bar-overflow-menus";

const CLASS_TABS: Array<{ value: GridFilterClass; label: string }> = [
  { value: 0, label: "Titan" },
  { value: 1, label: "Hunter" },
  { value: 2, label: "Warlock" },
];

interface ResultNoun {
  singular: string;
  plural: string;
}

interface TrackerFilterBarProps {
  selectors: TrackerFormSelectors;
  value: GridFiltersJson;
  onChange: (next: GridFiltersJson) => void;
  pinnedHashes: readonly string[];
  onTogglePin: (hash: string) => void;
  resultCount: number;
  resultNoun: ResultNoun;
  showTertiaryStatFilter?: boolean;
  showRarityFilter?: boolean;
  savedViews?: SavedViewsBarProps;
  className?: string;
}

export function TrackerFilterBar({
  selectors,
  value,
  onChange,
  pinnedHashes,
  onTogglePin,
  resultCount,
  resultNoun,
  showTertiaryStatFilter = true,
  showRarityFilter = false,
  savedViews,
  className,
}: TrackerFilterBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchUiOpen, setSearchUiOpen] = useState(false);
  const [setsOpen, setSetsOpen] = useState(false);
  const searchExpanded = searchUiOpen || value.search.trim().length > 0;
  const collapseTier = useFilterBarCollapseTier(barRef);

  const sortedSets = useMemo(
    () => selectors.setsByClass[value.class],
    [selectors.setsByClass, value.class],
  );

  const sortedArchetypes = useMemo(
    () => [...selectors.archetypes].sort((a, b) => a.name.localeCompare(b.name)),
    [selectors.archetypes],
  );
  const sortedTunings = useMemo(
    () => [...selectors.tunings].sort((a, b) => a.name.localeCompare(b.name)),
    [selectors.tunings],
  );

  const setHashesAsStrings = useMemo(
    () => value.setHashes.map(String),
    [value.setHashes],
  );

  const selectedSetNames = useMemo(() => {
    const byHash = new Map(sortedSets.map((o) => [o.hash, o.name] as const));
    return value.setHashes
      .map((h) => byHash.get(h))
      .filter((n): n is string => Boolean(n));
  }, [sortedSets, value.setHashes]);

  const armorSetEmptyCopy = selectors.manifestEmpty
    ? "Loading armor sets…"
    : "No sets for this class.";
  const archetypeEmptyCopy = selectors.manifestEmpty
    ? "Loading archetypes…"
    : "No archetypes for this class.";
  const tuningEmptyCopy = selectors.manifestEmpty
    ? "Loading tunings…"
    : "No tunings for this class.";

  function setSetHashesFromStrings(next: string[]) {
    onChange({
      ...value,
      setHashes: next.map(Number).filter((n) => Number.isFinite(n)),
    });
  }

  function toggleArchetype(id: string, checked: boolean) {
    const idNum = Number(id);
    const has = value.archetypeHashes.includes(idNum);
    if (checked && !has) {
      onChange({ ...value, archetypeHashes: [...value.archetypeHashes, idNum] });
    } else if (!checked && has) {
      onChange({
        ...value,
        archetypeHashes: value.archetypeHashes.filter((h) => h !== idNum),
      });
    }
  }

  function toggleTuning(id: string, checked: boolean) {
    const idNum = Number(id);
    const has = value.tuningHashes.includes(idNum);
    if (checked && !has) {
      onChange({ ...value, tuningHashes: [...value.tuningHashes, idNum] });
    } else if (!checked && has) {
      onChange({
        ...value,
        tuningHashes: value.tuningHashes.filter((h) => h !== idNum),
      });
    }
  }

  function toggleStat(stat: ArmorStatName, checked: boolean) {
    const has = value.tertiaryStats.includes(stat);
    if (checked && !has) {
      onChange({ ...value, tertiaryStats: [...value.tertiaryStats, stat] });
    } else if (!checked && has) {
      onChange({
        ...value,
        tertiaryStats: value.tertiaryStats.filter((s) => s !== stat),
      });
    }
  }

  function switchRarity(next: GridFilterRarity) {
    if (next === value.rarity) return;
    onChange({
      ...value,
      rarity: next,
      ...(next === "exotic" ? { setHashes: [] } : {}),
    });
  }

  function switchClass(next: GridFilterClass) {
    if (next === value.class) return;
    const allowed = new Set(selectors.setsByClass[next].map((s) => s.hash));
    onChange({
      ...value,
      class: next,
      setHashes: value.setHashes.filter((h) => allowed.has(h)),
    });
  }

  const showSetFilter = !showRarityFilter || value.rarity !== "exotic";
  const shareEnabled = showRarityFilter
    ? inventoryFiltersHaveShareableSelection(value)
    : gridFiltersHaveUnblockingSelection(value);

  const overflowProps = {
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
    onSetsOpenChange: setSetsOpen,
    onSetHashesFromStrings: setSetHashesFromStrings,
    onToggleArchetype: toggleArchetype,
    onToggleTuning: toggleTuning,
    onToggleStat: toggleStat,
    // Saved views and rarity live in the right-hand action cluster, so they are
    // never stowed into the left "Filters" overflow menu.
    savedViews: undefined,
  };

  return (
    <div
      ref={barRef}
      className={cn(
        FILTER_BAR_CONTAINER_CLASS,
        "flex w-full min-w-0 max-w-full flex-nowrap items-center gap-2 overflow-hidden py-2 sm:gap-3",
        "min-h-[60px]",
        className,
      )}
    >
      <div className={cn(chromeToolbarShellClass, "min-w-0")} role="group" aria-label="Class">
        {CLASS_TABS.map((tab, index) => (
          <button
            key={tab.value}
            type="button"
            className={cn(
              "flex h-9 shrink-0 items-center px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              index > 0 && "border-l border-border",
              value.class === tab.value && "bg-accent text-foreground",
            )}
            onClick={() => switchClass(tab.value)}
            aria-pressed={value.class === tab.value}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {showSetFilter ? (
        <ArmorSetsFilterDimension
          variant="inline"
          options={sortedSets}
          values={setHashesAsStrings}
          onValuesChange={setSetHashesFromStrings}
          selectedNames={selectedSetNames}
          emptyCatalogMessage={armorSetEmptyCopy}
          pinnedHashes={pinnedHashes}
          onTogglePin={onTogglePin}
          classKey={value.class}
          open={setsOpen}
          onOpenChange={setSetsOpen}
          onClear={() => onChange({ ...value, setHashes: [] })}
          inlineWrapperClass={FILTER_INLINE_CORE}
        />
      ) : null}

      <HashCheckboxFilterDimension
        variant="inline"
        label="Archetypes"
        options={sortedArchetypes}
        selectedHashes={value.archetypeHashes}
        onToggle={toggleArchetype}
        onClear={() => onChange({ ...value, archetypeHashes: [] })}
        emptyMessage={archetypeEmptyCopy}
        inlineWrapperClass={FILTER_INLINE_ARCHETYPES}
        menuContentClass="min-w-64"
      />

      {showTertiaryStatFilter ? (
        <StatCheckboxFilterDimension
          variant="inline"
          selectedStats={value.tertiaryStats}
          onToggle={toggleStat}
          onClear={() => onChange({ ...value, tertiaryStats: [] })}
          inlineWrapperClass={FILTER_INLINE_TUNINGS_TERTIARY}
        />
      ) : null}

      <HashCheckboxFilterDimension
        variant="inline"
        label="Tunings"
        options={sortedTunings}
        selectedHashes={value.tuningHashes}
        onToggle={toggleTuning}
        onClear={() => onChange({ ...value, tuningHashes: [] })}
        emptyMessage={tuningEmptyCopy}
        inlineWrapperClass={FILTER_INLINE_TUNINGS_TERTIARY}
        menuContentClass="min-w-56"
      />

      <TrackerFilterBarOverflowMenus {...overflowProps} />

      <p
        className="min-w-0 flex-1 truncate text-xs leading-snug text-muted-foreground/80"
        aria-live="polite"
      >
        Showing {resultCount}{" "}
        {resultCount === 1 ? resultNoun.singular : resultNoun.plural} for{" "}
        {CLASS_NAMES[value.class] ?? "class"}.
      </p>

      {(showRarityFilter || savedViews) && collapseTier !== "filters-menu" ? (
        <div aria-hidden className="h-6 w-px shrink-0 self-center bg-border" />
      ) : null}

      {showRarityFilter ? (
        <RarityFilterDimension
          variant="inline"
          value={value.rarity}
          onChange={switchRarity}
        />
      ) : null}

      {savedViews ? (
        <SavedViewsMenu
          {...savedViews}
          compact={collapseTier === "filters-menu"}
        />
      ) : null}

      <ShareFilterLinkButton
        filters={value}
        disabled={!shareEnabled}
        className="size-9 shrink-0 rounded-none"
      />

      <div className="ml-auto min-w-0">
        {searchExpanded ? (
          <div
            role="search"
            className="relative -my-2 min-h-[60px] min-w-0 lg:max-w-xs"
          >
            <MagnifyingGlass
              weight="regular"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              ref={searchInputRef}
              type="search"
              value={value.search}
              onChange={(e) => onChange({ ...value, search: e.target.value })}
              placeholder="Search armor"
              aria-label="Search armor"
              onBlur={() => {
                if (!value.search.trim()) setSearchUiOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Escape") return;
                if (value.search.trim()) {
                  onChange({ ...value, search: "" });
                } else {
                  setSearchUiOpen(false);
                  e.currentTarget.blur();
                }
              }}
              className="h-[60px] w-full min-w-0 border-0 border-b border-white bg-transparent py-0 ps-9 pe-9 text-sm text-foreground shadow-none outline-none placeholder:text-muted-foreground/80 focus-visible:border-b focus-visible:border-white focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-search-cancel-button]:hidden"
            />
            {value.search ? (
              <button
                type="button"
                aria-label="Clear search"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => onChange({ ...value, search: "" })}
                className="absolute right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-none text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <X weight="bold" className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Search armor"
            aria-expanded={searchExpanded}
            className="size-9 shrink-0 self-center rounded-none border-0 shadow-none hover:bg-accent/50"
            onClick={() => {
              setSearchUiOpen(true);
              queueMicrotask(() =>
                searchInputRef.current?.focus({ preventScroll: true }),
              );
            }}
          >
            <MagnifyingGlass weight="regular" aria-hidden className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
