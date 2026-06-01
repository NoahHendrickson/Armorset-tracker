"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useFilterBarCollapseTier } from "@/components/workspace/use-filter-bar-collapse-tier";
import {
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { CLASS_NAMES } from "@/lib/bungie/constants";
import type { ArmorStatName } from "@/lib/db/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  INLINE_TRIGGER_ACTIVE_CLASS,
  INLINE_TRIGGER_FRAME_CLASS,
  INLINE_TRIGGER_IDLE_CLASS,
} from "@/components/workspace/filter-bar-primitives";
import {
  SavedViewsMenu,
  type SavedViewsBarProps,
} from "@/components/workspace/saved-views-menu";
import { ClassSwitcher } from "@/components/workspace/class-switcher";
import { TrackerFilterBarOverflowMenus } from "@/components/workspace/tracker-filter-bar-overflow-menus";

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
  /** Table view: search is the primary control — leftmost and always visible. */
  searchPlacement?: "start" | "end";
  searchDefaultExpanded?: boolean;
  /** Table view: embed compact icon-only class switcher inside the search compound. */
  embedClassInSearch?: boolean;
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
  searchPlacement = "end",
  searchDefaultExpanded = false,
  embedClassInSearch = false,
  savedViews,
  className,
}: TrackerFilterBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchUiOpen, setSearchUiOpen] = useState(searchDefaultExpanded);
  const [setsOpen, setSetsOpen] = useState(false);
  const searchExpanded =
    searchDefaultExpanded ||
    searchUiOpen ||
    value.search.trim().length > 0;
  const searchPlaceholder = embedClassInSearch
    ? "Press F to search"
    : searchPlacement === "start"
      ? "Search sets (e.g. ferro smoke)"
      : "Search armor";
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

  const searchActive = value.search.trim().length > 0;

  useEffect(() => {
    if (!embedClassInSearch || !searchDefaultExpanded) return;

    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key !== "f" && e.key !== "F") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      setSearchUiOpen(true);
      searchInputRef.current?.focus({ preventScroll: true });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [embedClassInSearch, searchDefaultExpanded]);

  const searchInputProps = {
    ref: searchInputRef,
    type: "search" as const,
    value: value.search,
    onChange: (e: ChangeEvent<HTMLInputElement>) =>
      onChange({ ...value, search: e.target.value }),
    placeholder: searchPlaceholder,
    "aria-label": "Search armor sets",
    onBlur: () => {
      if (!searchDefaultExpanded && !value.search.trim()) {
        setSearchUiOpen(false);
      }
    },
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Escape") return;
      if (value.search.trim()) {
        onChange({ ...value, search: "" });
      } else if (!searchDefaultExpanded) {
        setSearchUiOpen(false);
        e.currentTarget.blur();
      }
    },
  };

  const clearSearchButton = (embedded = false) =>
    value.search ? (
      <button
        type="button"
        aria-label="Clear search"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => onChange({ ...value, search: "" })}
        className={cn(
          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-none text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          !embedded && "absolute right-2 top-1/2 -translate-y-1/2",
        )}
      >
        <X weight="bold" className="h-3.5 w-3.5" aria-hidden />
      </button>
    ) : null;

  const searchField = searchExpanded ? (
    embedClassInSearch ? (
      <div
        role="search"
        className={cn(
          "relative isolate shrink-0 flex h-9 min-w-0 items-stretch border",
          "w-80 sm:w-96 lg:w-[26rem]",
          "focus-within:outline-none",
          searchActive
            ? INLINE_TRIGGER_ACTIVE_CLASS
            : cn(
                INLINE_TRIGGER_IDLE_CLASS,
                "border-border focus-within:border-primary/60 focus-within:bg-primary/5",
              ),
        )}
      >
        <div className="relative flex min-w-0 flex-1 items-center gap-1 ps-8 pe-2">
          <MagnifyingGlass
            weight="regular"
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            {...searchInputProps}
            className="h-full min-w-0 flex-1 border-0 bg-transparent py-0 text-xs shadow-none outline-none placeholder:text-muted-foreground/80 focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-search-cancel-button]:hidden"
          />
          {clearSearchButton(true)}
        </div>
        <ClassSwitcher
          variant="condensed"
          value={value.class}
          onChange={switchClass}
        />
      </div>
    ) : (
      <div
        role="search"
        className={cn(
          INLINE_TRIGGER_FRAME_CLASS,
          "relative min-w-0",
          searchPlacement === "start"
            ? "w-44 shrink-0 sm:w-52 lg:w-60"
            : "lg:max-w-xs",
        )}
      >
        <MagnifyingGlass
          weight="regular"
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          {...searchInputProps}
          className={cn(
            "h-9 w-full min-w-0 rounded-none border border-border py-0 ps-9 pe-9 text-xs shadow-none outline-none placeholder:text-muted-foreground/80 focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-search-cancel-button]:hidden",
            searchActive
              ? INLINE_TRIGGER_ACTIVE_CLASS
              : INLINE_TRIGGER_IDLE_CLASS,
          )}
        />
        {clearSearchButton()}
      </div>
    )
  ) : (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Search armor sets"
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
  );

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
      {searchPlacement === "start" ? (
        <div className="shrink-0">{searchField}</div>
      ) : null}

      {!embedClassInSearch ? (
        <ClassSwitcher value={value.class} onChange={switchClass} />
      ) : null}

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

      {searchPlacement === "end" ? (
        <div className="ml-auto min-w-0 shrink-0">{searchField}</div>
      ) : null}
    </div>
  );
}
