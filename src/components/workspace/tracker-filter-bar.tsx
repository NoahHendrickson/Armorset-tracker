"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  MagnifyingGlass,
  SlidersHorizontal,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { CLASS_NAMES } from "@/lib/bungie/constants";
import type { ArmorStatName } from "@/lib/db/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TrackerFormSelectors } from "@/lib/views/tracker-form-selectors";
import {
  gridFiltersHaveUnblockingSelection,
  type GridFilterClass,
  type GridFiltersJson,
} from "@/lib/workspace/grid-filters-schema";
import { ShareFilterLinkButton } from "@/components/workspace/share-filter-link-button";
import { ArmorSetsFilterDimension } from "@/components/workspace/armor-sets-filter-dimension";
import { HashCheckboxFilterDimension } from "@/components/workspace/hash-checkbox-filter-dimension";
import { StatCheckboxFilterDimension } from "@/components/workspace/stat-checkbox-filter-dimension";

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
  savedViewsSlot?: ReactNode;
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
  savedViewsSlot,
  className,
}: TrackerFilterBarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchUiOpen, setSearchUiOpen] = useState(false);
  const [setsOpen, setSetsOpen] = useState(false);
  const searchExpanded = searchUiOpen || value.search.trim().length > 0;

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
    ? "Sync the manifest first."
    : "No sets for this class.";

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

  function switchClass(next: GridFilterClass) {
    if (next === value.class) return;
    const allowed = new Set(selectors.setsByClass[next].map((s) => s.hash));
    onChange({
      ...value,
      class: next,
      setHashes: value.setHashes.filter((h) => allowed.has(h)),
    });
  }

  const barMinH = "min-h-[52px]";

  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-2 sm:gap-3",
        barMinH,
        className,
      )}
    >
      <div className="flex min-w-0 shrink-0 overflow-hidden rounded-none bg-card">
        {CLASS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={cn(
              "flex h-9 shrink-0 items-center border border-transparent px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              value.class === tab.value &&
                "border-border bg-accent text-foreground",
            )}
            onClick={() => switchClass(tab.value)}
            aria-pressed={value.class === tab.value}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div aria-hidden className="h-6 w-px shrink-0 self-center bg-border" />

      {savedViewsSlot}

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
        inlineWrapperClass="hidden md:inline-flex"
      />

      <HashCheckboxFilterDimension
        variant="inline"
        label="Archetypes"
        options={sortedArchetypes}
        selectedHashes={value.archetypeHashes}
        onToggle={toggleArchetype}
        onClear={() => onChange({ ...value, archetypeHashes: [] })}
        emptyMessage="No archetypes — sync the manifest first."
        inlineWrapperClass="hidden md:inline-flex"
        menuContentClass="min-w-64"
      />

      <HashCheckboxFilterDimension
        variant="inline"
        label="Tunings"
        options={sortedTunings}
        selectedHashes={value.tuningHashes}
        onToggle={toggleTuning}
        onClear={() => onChange({ ...value, tuningHashes: [] })}
        emptyMessage="No tunings — sync the manifest first."
        inlineWrapperClass="hidden lg:inline-flex"
        menuContentClass="min-w-56"
      />

      {showTertiaryStatFilter ? (
        <StatCheckboxFilterDimension
          variant="inline"
          selectedStats={value.tertiaryStats}
          onToggle={toggleStat}
          onClear={() => onChange({ ...value, tertiaryStats: [] })}
          inlineWrapperClass="hidden lg:inline-flex"
        />
      ) : null}

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-label="More filters"
            className="relative h-9 shrink-0 gap-1.5 rounded-none px-3 text-xs lg:hidden"
          >
            <SlidersHorizontal weight="duotone" aria-hidden className="size-4" />
            <span className="hidden sm:inline">Filters</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="min-w-48 rounded-none py-1"
        >
          <ArmorSetsFilterDimension
            variant="stowed"
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
            stowedSubTriggerClass="md:hidden"
          />
          <HashCheckboxFilterDimension
            variant="stowed"
            label="Archetypes"
            options={sortedArchetypes}
            selectedHashes={value.archetypeHashes}
            onToggle={toggleArchetype}
            onClear={() => onChange({ ...value, archetypeHashes: [] })}
            emptyMessage="No archetypes — sync the manifest first."
            stowedSubTriggerClass="md:hidden"
            menuContentClass="min-w-64"
          />
          {showTertiaryStatFilter ? (
            <StatCheckboxFilterDimension
              variant="stowed"
              selectedStats={value.tertiaryStats}
              onToggle={toggleStat}
              onClear={() => onChange({ ...value, tertiaryStats: [] })}
              stowedSubTriggerClass="lg:hidden"
            />
          ) : null}
          <HashCheckboxFilterDimension
            variant="stowed"
            label="Tuning stats"
            options={sortedTunings}
            selectedHashes={value.tuningHashes}
            onToggle={toggleTuning}
            onClear={() => onChange({ ...value, tuningHashes: [] })}
            emptyMessage="No tunings — sync the manifest first."
            stowedSubTriggerClass="lg:hidden"
            menuContentClass="min-w-56"
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <p
        className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground/80"
        aria-live="polite"
      >
        Showing {resultCount}{" "}
        {resultCount === 1 ? resultNoun.singular : resultNoun.plural} for{" "}
        {CLASS_NAMES[value.class] ?? "class"}.
      </p>

      <ShareFilterLinkButton
        filters={value}
        disabled={!gridFiltersHaveUnblockingSelection(value)}
        className="size-9 shrink-0 rounded-none"
      />

      <div className="ml-auto min-w-0">
        {searchExpanded ? (
          <div
            role="search"
            className="relative min-h-[52px] min-w-0 lg:max-w-xs"
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
              className="h-[52px] w-full min-w-0 border-0 border-b border-white bg-transparent py-0 ps-9 pe-9 text-sm text-foreground shadow-none outline-none placeholder:text-muted-foreground/80 focus-visible:border-b focus-visible:border-white focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-search-cancel-button]:hidden"
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
