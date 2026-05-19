"use client";

import {
  forwardRef,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
} from "react";
import {
  CaretDown,
  MagnifyingGlass,
  SlidersHorizontal,
  X,
} from "@phosphor-icons/react/dist/ssr";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArmorSetMultiSelectPanel } from "@/components/views/armor-set-combobox";
import type { TrackerFormSelectors } from "@/components/workspace/new-tracker-dialog";
import {
  type GridFilterClass,
  type GridFiltersJson,
} from "@/lib/workspace/grid-filters-schema";

const FILTER_MENU_CONTENT_CLASS =
  "max-h-[min(60vh,20rem)] min-w-56 overflow-y-auto rounded-none py-2 shadow-xl";

const INLINE_TRIGGER_BASE_CLASS =
  "group/inline-trigger h-9 shrink-0 gap-1.5 rounded-none px-3 text-xs";

/** Wraps Trigger + sibling clear `<button>`; `focus-within` ring avoids nested focus chrome. */
const INLINE_TRIGGER_FRAME_CLASS =
  "relative isolate shrink-0 focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background";

const CLASS_TABS: Array<{ value: GridFilterClass; label: string }> = [
  { value: 0, label: "Titan" },
  { value: 1, label: "Hunter" },
  { value: 2, label: "Warlock" },
];

/** Comma-joined summary capped at two names, then "+N". Falls back to label when empty. */
function summarizeSelection(names: readonly string[], fallback: string): string {
  if (names.length === 0) return fallback;
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]}, ${names[1]}`;
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

interface InlineFilterTriggerProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  selectedNames: readonly string[];
  active: boolean;
  /**
   * When true, the frame mounts a sibling clear button + this trigger reserves
   * a `w-5` spacer between label and caret so the overlay aligns like
   * `label · ✕ · ⌄`.
   */
  clearSibling?: boolean;
}

/**
 * Dropdown / popover trigger for one filter dimension. Uses `forwardRef` so
 * Radix `Trigger asChild` can attach ref + props (including `data-state`).
 *
 * When `clearSibling`, pair with `<InlineFilterClearButton />` inside a wrapper
 * with `INLINE_TRIGGER_FRAME_CLASS` — the clear control must not live inside
 * this `<button>` for valid HTML / accessibility.
 */
const InlineFilterTrigger = forwardRef<
  HTMLButtonElement,
  InlineFilterTriggerProps
>(({ label, selectedNames, active, clearSibling, className, ...props }, ref) => {
  const summary = summarizeSelection(selectedNames, label);
  return (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      aria-label={`${label} filter`}
      className={cn(
        INLINE_TRIGGER_BASE_CLASS,
        "focus-visible:ring-0 focus-visible:ring-offset-0",
        active
          ? "border-primary/60 bg-primary/10 font-medium text-foreground hover:border-primary/70 hover:bg-primary/20 hover:text-foreground data-[state=open]:border-primary/60 data-[state=open]:bg-primary/10 data-[state=open]:text-foreground"
          : "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
        className,
      )}
      {...props}
    >
      <span className="min-w-0 max-w-[14rem] flex-1 truncate text-left">{summary}</span>
      {clearSibling ? (
        /* Reserves horizontal space between label and caret; clear overlays this slot */
        <span aria-hidden className="inline-block w-5 shrink-0" />
      ) : null}
      <CaretDown
        weight="duotone"
        aria-hidden
        className="!size-3.5 shrink-0 opacity-60 transition group-hover/inline-trigger:opacity-90 group-data-[state=open]/inline-trigger:rotate-180"
      />
    </Button>
  );
});
InlineFilterTrigger.displayName = "InlineFilterTrigger";

/** Sibling clear button for an inline dimension; sits in the same wrapper as `INLINE_TRIGGER_FRAME_CLASS`. */
function InlineFilterClearButton({
  label,
  visible,
  onClear,
}: {
  label: string;
  visible: boolean;
  onClear: () => void;
}) {
  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label={`Clear ${label} filter`}
      title={`Clear ${label} filter`}
      onClick={() => {
        onClear();
      }}
      className="group/clear pointer-events-auto absolute inset-y-0 right-8 z-10 flex w-5 items-center justify-center rounded-none border-0 bg-transparent p-0 text-muted-foreground shadow-none hover:text-foreground focus-visible:outline-none"
    >
      <X
        weight="bold"
        aria-hidden
        className="!size-3.5 opacity-60 transition group-hover/clear:opacity-90"
      />
    </button>
  );
}

/** Per-dimension badge on the stowed submenu rows. */
function FilterDimensionSubTrigger({
  label,
  selectionCount,
  className,
}: {
  label: string;
  selectionCount: number;
  className?: string;
}) {
  const active = selectionCount > 0;
  return (
    <DropdownMenuSubTrigger
      inset
      className={cn(active && "font-medium text-foreground", className)}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {active ? (
          <span
            className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-none bg-primary px-1 text-[10px] font-semibold leading-none tabular-nums text-primary-foreground"
            title={`${selectionCount} selected`}
          >
            {selectionCount}
          </span>
        ) : null}
      </span>
    </DropdownMenuSubTrigger>
  );
}

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
  /** Tracker grid hides tertiary filtering; inventory table keeps it enabled. */
  showTertiaryStatFilter?: boolean;
  className?: string;
}

/**
 * Filter + class-tab + search bar shared between the Tracker grid view and the
 * Table view. Each filter dimension is its own inline dropdown trigger at wide
 * widths; below `lg` the secondary dimensions collapse into a single Filters
 * dropdown, and below `md` all dimensions collapse — matching the prior UX.
 */
export function TrackerFilterBar({
  selectors,
  value,
  onChange,
  pinnedHashes,
  onTogglePin,
  resultCount,
  resultNoun,
  showTertiaryStatFilter = true,
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
  const archetypeHashesAsStrings = useMemo(
    () => value.archetypeHashes.map(String),
    [value.archetypeHashes],
  );
  const tuningHashesAsStrings = useMemo(
    () => value.tuningHashes.map(String),
    [value.tuningHashes],
  );

  const selectedSetNames = useMemo(() => {
    const byHash = new Map(sortedSets.map((o) => [o.hash, o.name] as const));
    return value.setHashes
      .map((h) => byHash.get(h))
      .filter((n): n is string => Boolean(n));
  }, [sortedSets, value.setHashes]);

  const selectedArchetypeNames = useMemo(() => {
    const byHash = new Map(
      sortedArchetypes.map((o) => [o.hash, o.name] as const),
    );
    return value.archetypeHashes
      .map((h) => byHash.get(h))
      .filter((n): n is string => Boolean(n));
  }, [sortedArchetypes, value.archetypeHashes]);

  const selectedTuningNames = useMemo(() => {
    const byHash = new Map(sortedTunings.map((o) => [o.hash, o.name] as const));
    return value.tuningHashes
      .map((h) => byHash.get(h))
      .filter((n): n is string => Boolean(n));
  }, [sortedTunings, value.tuningHashes]);

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

  /**
   * Sets inline trigger is hidden under `md`; Archetypes inline trigger hidden
   * under `md`; Tunings & Tertiary inline triggers hidden under `lg`. The
   * legacy Filters button is hidden at `lg` (nothing left to stow) and renders
   * only the dimensions that are NOT currently inline. We use CSS responsive
   * utilities so both versions live in the DOM and there's no JS breakpoint.
   */
  const renderSetsSubmenu = (
    <DropdownMenuSub>
      <FilterDimensionSubTrigger
        label="Armor sets"
        selectionCount={value.setHashes.length}
        className="md:hidden"
      />
      <DropdownMenuSubContent
        className="w-[min(90vw,22rem)] min-w-[18rem] rounded-none border-border p-0 shadow-xl md:hidden"
        collisionPadding={16}
      >
        <ArmorSetMultiSelectPanel
          key={`stowed-${value.class}`}
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
  );

  const renderArchetypesSubmenu = (
    <DropdownMenuSub>
      <FilterDimensionSubTrigger
        label="Archetypes"
        selectionCount={value.archetypeHashes.length}
        className="md:hidden"
      />
      <DropdownMenuSubContent
        className={cn(FILTER_MENU_CONTENT_CLASS, "min-w-64 md:hidden")}
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
  );

  const renderTuningsSubmenu = (
    <DropdownMenuSub>
      <FilterDimensionSubTrigger
        label="Tuning stats"
        selectionCount={value.tuningHashes.length}
        className="lg:hidden"
      />
      <DropdownMenuSubContent
        className={cn(FILTER_MENU_CONTENT_CLASS, "min-w-56 lg:hidden")}
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
  );

  const renderTertiarySubmenu = showTertiaryStatFilter ? (
    <DropdownMenuSub>
      <FilterDimensionSubTrigger
        label="Tertiary stats"
        selectionCount={value.tertiaryStats.length}
        className="lg:hidden"
      />
      <DropdownMenuSubContent
        className={cn(FILTER_MENU_CONTENT_CLASS, "min-w-48 lg:hidden")}
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
  ) : null;

  /** Match expanded search (`h-[52px]` input rail) so the bar height stays fixed when collapsed. */
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

      <Popover open={setsOpen} onOpenChange={setSetsOpen}>
        <div className={cn(INLINE_TRIGGER_FRAME_CLASS, "hidden md:inline-flex")}>
          <PopoverTrigger asChild>
            <InlineFilterTrigger
              label="Sets"
              selectedNames={selectedSetNames}
              active={value.setHashes.length > 0}
              clearSibling={value.setHashes.length > 0}
              className="inline-flex min-w-0"
            />
          </PopoverTrigger>
          <InlineFilterClearButton
            label="Sets"
            visible={value.setHashes.length > 0}
            onClear={() => onChange({ ...value, setHashes: [] })}
          />
        </div>
        <PopoverContent
          align="start"
          sideOffset={4}
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
            autoFocusSearch={setsOpen}
            className="max-h-[min(70vh,22rem)]"
          />
        </PopoverContent>
      </Popover>

      <DropdownMenu modal={false}>
        <div className={cn(INLINE_TRIGGER_FRAME_CLASS, "hidden md:inline-flex")}>
          <DropdownMenuTrigger asChild>
            <InlineFilterTrigger
              label="Archetypes"
              selectedNames={selectedArchetypeNames}
              active={value.archetypeHashes.length > 0}
              clearSibling={value.archetypeHashes.length > 0}
              className="inline-flex min-w-0"
            />
          </DropdownMenuTrigger>
          <InlineFilterClearButton
            label="Archetypes"
            visible={value.archetypeHashes.length > 0}
            onClear={() => onChange({ ...value, archetypeHashes: [] })}
          />
        </div>
        <DropdownMenuContent
          align="start"
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
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu modal={false}>
        <div className={cn(INLINE_TRIGGER_FRAME_CLASS, "hidden lg:inline-flex")}>
          <DropdownMenuTrigger asChild>
            <InlineFilterTrigger
              label="Tunings"
              selectedNames={selectedTuningNames}
              active={value.tuningHashes.length > 0}
              clearSibling={value.tuningHashes.length > 0}
              className="inline-flex min-w-0"
            />
          </DropdownMenuTrigger>
          <InlineFilterClearButton
            label="Tunings"
            visible={value.tuningHashes.length > 0}
            onClear={() => onChange({ ...value, tuningHashes: [] })}
          />
        </div>
        <DropdownMenuContent
          align="start"
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
        </DropdownMenuContent>
      </DropdownMenu>

      {showTertiaryStatFilter ? (
        <DropdownMenu modal={false}>
          <div className={cn(INLINE_TRIGGER_FRAME_CLASS, "hidden lg:inline-flex")}>
            <DropdownMenuTrigger asChild>
              <InlineFilterTrigger
                label="Tertiary stats"
                selectedNames={value.tertiaryStats}
                active={value.tertiaryStats.length > 0}
                clearSibling={value.tertiaryStats.length > 0}
                className="inline-flex min-w-0"
              />
            </DropdownMenuTrigger>
            <InlineFilterClearButton
              label="Tertiary stats"
              visible={value.tertiaryStats.length > 0}
              onClear={() => onChange({ ...value, tertiaryStats: [] })}
            />
          </div>
          <DropdownMenuContent
            align="start"
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
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-label="More filters"
            className={cn(
              "relative h-9 shrink-0 gap-1.5 rounded-none px-3 text-xs lg:hidden",
            )}
          >
            <SlidersHorizontal weight="duotone" aria-hidden className="size-4" />
            <span className="hidden sm:inline">Filters</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="min-w-48 rounded-none py-1"
        >
          {renderSetsSubmenu}
          {renderArchetypesSubmenu}
          {renderTertiarySubmenu}
          {renderTuningsSubmenu}
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
