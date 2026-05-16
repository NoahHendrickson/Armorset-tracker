"use client";

import { useMemo, useRef, useState } from "react";
import { MagnifyingGlass, SlidersHorizontal, X } from "@phosphor-icons/react/dist/ssr";
import { CLASS_NAMES } from "@/lib/bungie/constants";
import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArmorSetMultiSelectPanel } from "@/components/views/armor-set-combobox";
import type { TrackerFormSelectors } from "@/components/workspace/new-tracker-dialog";
import {
  type GridFilterClass,
  type GridFiltersJson,
} from "@/lib/workspace/grid-filters-schema";

const FILTER_MENU_CONTENT_CLASS =
  "max-h-[min(60vh,20rem)] min-w-56 overflow-y-auto rounded-none py-2 shadow-xl";

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
  /** Render inside the table-view header (uses TableHead container styles). */
  variant?: "standalone" | "table-header";
  className?: string;
}

/**
 * Filter + class-tab + search bar shared between the Tracker grid view and the
 * Table view. Mirrors the table view's prior inline filter dropdown — class
 * change prunes set selections to class-valid options.
 */
export function TrackerFilterBar({
  selectors,
  value,
  onChange,
  pinnedHashes,
  onTogglePin,
  resultCount,
  resultNoun,
  variant = "standalone",
  className,
}: TrackerFilterBarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchUiOpen, setSearchUiOpen] = useState(false);
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

  const activeFilterDimCount = useMemo(() => {
    let n = 0;
    if (value.setHashes.length > 0) n += 1;
    if (value.archetypeHashes.length > 0) n += 1;
    if (value.tuningHashes.length > 0) n += 1;
    if (value.tertiaryStats.length > 0) n += 1;
    return n;
  }, [value]);

  const setHashesAsStrings = useMemo(
    () => value.setHashes.map(String),
    [value.setHashes],
  );
  const archetypeHashesAsStrings = useMemo(
    () => value.archetypeHashes.map(String),
    [value.archetypeHashes],
  );
  const tuningHashesAsStrings = useMemo(
    () => value.tuningHashes.map(String),
    [value.tuningHashes],
  );

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
    const allowed = new Set(
      selectors.setsByClass[next].map((s) => s.hash),
    );
    onChange({
      ...value,
      class: next,
      setHashes: value.setHashes.filter((h) => allowed.has(h)),
    });
  }

  /** Match expanded search (`h-[52px]` input rail) so the bar height stays fixed when collapsed. */
  const barMinH = "min-h-[52px]";

  const wrapperClass =
    variant === "table-header"
      ? cn("grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2", barMinH)
      : cn("flex min-w-0 items-center gap-2 sm:gap-3", barMinH);

  return (
    <div className={cn(wrapperClass, className)}>
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

      <div className="flex min-w-0 shrink-0 items-center gap-2 self-center sm:gap-3">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              aria-label="Armor filters"
              className="relative h-9 shrink-0 gap-1.5 rounded-none px-3 text-xs"
            >
              <SlidersHorizontal weight="duotone" aria-hidden className="size-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterDimCount > 0 ? (
                <span
                  className="flex h-4 min-w-4 items-center justify-center rounded-none bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
                  aria-hidden
                >
                  {activeFilterDimCount}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="min-w-48 rounded-none py-1"
          >
            <DropdownMenuSub>
              <DropdownMenuSubTrigger inset>Armor sets</DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                className="w-[min(90vw,22rem)] min-w-[18rem] rounded-none border-border p-0 shadow-xl"
                collisionPadding={16}
              >
                <ArmorSetMultiSelectPanel
                  key={value.class}
                  options={sortedSets}
                  values={setHashesAsStrings}
                  onValuesChange={setSetHashesFromStrings}
                  emptyCatalogMessage={armorSetEmptyCopy}
                  sharpCorners
                  pinnedHashes={pinnedHashes}
                  onTogglePin={onTogglePin}
                  autoFocusSearch
                  className="max-h-[min(70vh,22rem)]"
                />
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger inset>Archetypes</DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                className={cn(FILTER_MENU_CONTENT_CLASS, "min-w-64")}
                collisionPadding={16}
              >
                {sortedArchetypes.length === 0 ? (
                  <div className="px-3 py-2.5 text-sm text-muted-foreground/80">
                    No archetypes — sync the manifest first.
                  </div>
                ) : (
                  sortedArchetypes.map((a) => {
                    const id = String(a.hash);
                    return (
                      <DropdownMenuCheckboxItem
                        key={a.hash}
                        checked={archetypeHashesAsStrings.includes(id)}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={(c) => toggleArchetype(id, c)}
                      >
                        {a.name}
                      </DropdownMenuCheckboxItem>
                    );
                  })
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger inset>Tertiary stats</DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                className={cn(FILTER_MENU_CONTENT_CLASS, "min-w-48")}
                collisionPadding={16}
              >
                {ARMOR_STAT_NAMES.map((stat) => (
                  <DropdownMenuCheckboxItem
                    key={stat}
                    checked={value.tertiaryStats.includes(stat)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(c) => toggleStat(stat, c)}
                  >
                    {stat}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger inset>Tuning stats</DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                className={cn(FILTER_MENU_CONTENT_CLASS, "min-w-56")}
                collisionPadding={16}
              >
                {sortedTunings.length === 0 ? (
                  <div className="px-3 py-2.5 text-sm text-muted-foreground/80">
                    No tunings — sync the manifest first.
                  </div>
                ) : (
                  sortedTunings.map((t) => {
                    const id = String(t.hash);
                    return (
                      <DropdownMenuCheckboxItem
                        key={t.hash}
                        checked={tuningHashesAsStrings.includes(id)}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={(c) => toggleTuning(id, c)}
                      >
                        {t.name}
                      </DropdownMenuCheckboxItem>
                    );
                  })
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
        <p
          className="min-w-0 text-xs leading-snug text-muted-foreground/80"
          aria-live="polite"
        >
          Showing {resultCount}{" "}
          {resultCount === 1 ? resultNoun.singular : resultNoun.plural} for{" "}
          {CLASS_NAMES[value.class] ?? "class"}.
        </p>
      </div>

      <div className="min-w-0 justify-self-end">
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
