"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CaretDown,
  Check,
  MagnifyingGlass,
  PushPin,
  X,
} from "@phosphor-icons/react/dist/ssr";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  checkboxBoxClassName,
  checkboxIconClassName,
} from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { TrackerOptionItem } from "@/lib/views/tracker-option";

const TRIGGER_CLASSES =
  "flex h-9 w-full items-center justify-between gap-2 text-left whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1";

/**
 * Splits options into a `pinned` (in pin order) and `unpinned` (catalog order)
 * pair. Pinned options that are no longer in the catalog are silently dropped.
 * When `query` is non-empty, the pinned section is suppressed and all matches
 * appear in a single flat list so search results are not visually fragmented.
 */
function partitionByPin<T extends { hash: number | string }>(
  filtered: readonly T[],
  pinnedHashes: readonly string[] | undefined,
  query: string,
): { pinned: T[]; unpinned: T[]; sectioned: boolean } {
  if (!pinnedHashes || pinnedHashes.length === 0 || query.trim().length > 0) {
    return { pinned: [], unpinned: filtered.slice(), sectioned: false };
  }
  const pinSet = new Set(pinnedHashes);
  const byHash = new Map(filtered.map((o) => [String(o.hash), o]));
  const pinned: T[] = [];
  for (const h of pinnedHashes) {
    const opt = byHash.get(h);
    if (opt) pinned.push(opt);
  }
  const unpinned = filtered.filter((o) => !pinSet.has(String(o.hash)));
  return { pinned, unpinned, sectioned: pinned.length > 0 };
}

interface PinButtonProps {
  pinned: boolean;
  name: string;
  onToggle: () => void;
}

/**
 * Trailing pin/unpin affordance on each option row. Not in tab order — the
 * listbox uses Arrow keys for navigation, and clicking the pin must not
 * trigger row selection.
 */
function PinButton({ pinned, name, onToggle }: PinButtonProps) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={pinned ? `Unpin ${name}` : `Pin ${name} to top`}
      title={pinned ? "Unpin" : "Pin to top"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      onMouseDown={(e) => {
        /* Keep input focus / prevent the row's onMouseEnter highlight churn. */
        e.preventDefault();
      }}
      className={cn(
        "absolute right-1.5 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md transition-opacity",
        "hover:bg-foreground/10 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        pinned
          ? "opacity-100 text-popover-foreground"
          : "text-popover-foreground/60 opacity-0 group-hover:opacity-100",
      )}
    >
      <PushPin
        weight={pinned ? "fill" : "regular"}
        aria-hidden
        className="h-3.5 w-3.5"
      />
    </button>
  );
}

function PinnedSectionLabel() {
  return (
    <li
      role="presentation"
      aria-hidden
      className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
    >
      Pinned sets
    </li>
  );
}

function PinnedSectionDivider() {
  return (
    <li
      role="presentation"
      aria-hidden
      className="mx-2 mb-1 mt-1 border-t border-border"
    />
  );
}

/** Matches {@link DropdownMenuCheckboxItem} indicator styling in filter menus. */
function ListboxCheckboxIndicator({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        checkboxBoxClassName,
        "pointer-events-none absolute left-2 top-1/2 -translate-y-1/2",
        checked &&
          "border-primary bg-primary text-primary-foreground",
      )}
    >
      {checked ? (
        <Check weight="bold" className={checkboxIconClassName} />
      ) : null}
    </span>
  );
}

interface SearchClearButtonProps {
  onClear: () => void;
}

/**
 * Trailing affordance inside the search bar that wipes the typed query.
 * `onMouseDown` preventDefault keeps focus on the input across the click so
 * the user can keep typing without an extra Tab — matches the pattern used by
 * `PinButton` above.
 */
function SearchClearButton({ onClear }: SearchClearButtonProps) {
  return (
    <button
      type="button"
      aria-label="Clear search"
      title="Clear search"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClear}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors",
        "text-muted-foreground hover:bg-foreground/10 hover:text-popover-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <X weight="bold" aria-hidden className="h-3.5 w-3.5" />
    </button>
  );
}

interface ArmorSetComboboxProps {
  id?: string;
  options: TrackerOptionItem[];
  value: string;
  onValueChange: (hash: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Shown inside the panel when the catalog has no armor sets yet. */
  emptyCatalogMessage?: string;
  /** Square field styling (e.g. new tracker popover). */
  sharpCorners?: boolean;
  /** Highlight as invalid (e.g. after submit with empty required value). */
  invalid?: boolean;
  /**
   * Mount the popover inside this element instead of `document.body`.
   * Required for wheel scrolling inside a Radix modal (RemoveScroll only allows scroll in dialog shards).
   */
  portalContainer?: HTMLElement | null;
  /**
   * Hashes (as strings) of armor sets to surface at the top in a "Pinned sets"
   * section. Order is preserved. When `onTogglePin` is also provided, each row
   * gets a trailing pin/unpin button.
   */
  pinnedHashes?: readonly string[];
  /**
   * Called when the user toggles a pin from a row's pin button. When omitted,
   * pin affordances are hidden (the section can still be shown read-only via
   * `pinnedHashes`).
   */
  onTogglePin?: (hash: string) => void;
  "aria-label"?: string;
}

export function ArmorSetCombobox({
  id,
  options,
  value,
  onValueChange,
  disabled,
  placeholder,
  emptyCatalogMessage = "No sets available — sync the manifest first.",
  sharpCorners = false,
  invalid = false,
  portalContainer,
  pinnedHashes,
  onTogglePin,
  "aria-label": ariaLabel,
}: ArmorSetComboboxProps) {
  const listboxId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [panelWidth, setPanelWidth] = useState<number | undefined>();
  const [highlightIndex, setHighlightIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q.length) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const { pinned, unpinned, sectioned } = useMemo(
    () => partitionByPin(filtered, pinnedHashes, query),
    [filtered, pinnedHashes, query],
  );
  const displayedOptions = useMemo(
    () => [...pinned, ...unpinned],
    [pinned, unpinned],
  );

  const pinnedSet = useMemo(
    () => new Set(pinnedHashes ?? []),
    [pinnedHashes],
  );

  const selectedOption = options.find((o) => String(o.hash) === value);
  const displayLabel =
    selectedOption?.name ??
    (!value ? "Select an armor set" : "");

  useLayoutEffect(() => {
    if (open && triggerRef.current)
      setPanelWidth(triggerRef.current.offsetWidth);
  }, [open]);

  /** Collapse resets when the picker closes (`onOpenChange` or after pick). */
  function closeAndReset(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
      setHighlightIndex(0);
    }
  }

  function select(hash: string) {
    onValueChange(hash);
    closeAndReset(false);
  }

  const focusedIndex =
    displayedOptions.length === 0
      ? 0
      : Math.min(Math.max(0, highlightIndex), displayedOptions.length - 1);

  return (
    <Popover open={open} onOpenChange={closeAndReset}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={
            open && displayedOptions[focusedIndex]
              ? `${listboxId}-${displayedOptions[focusedIndex].hash}`
              : undefined
          }
          aria-label={ariaLabel}
          aria-invalid={invalid ? true : undefined}
          disabled={disabled}
          className={cn(
            TRIGGER_CLASSES,
            sharpCorners && "rounded-none",
            invalid &&
              "border-2 border-destructive focus-visible:ring-2 focus-visible:ring-destructive/90",
          )}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {!value ? placeholder ?? "Select an armor set" : displayLabel || "Unknown set"}
          </span>
          <CaretDown
            weight="duotone"
            aria-hidden
            className={cn(
              "h-4 w-4 shrink-0 opacity-50 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        container={portalContainer}
        data-skip-canvas-wheel=""
        className={cn(
          "z-[90] flex flex-col overflow-hidden border border-border bg-popover p-0 text-popover-foreground shadow-xl outline-none",
          sharpCorners ? "rounded-none" : "rounded-lg",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:duration-150",
        )}
        style={panelWidth ? { width: panelWidth } : undefined}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          queueMicrotask(() => searchRef.current?.focus({ preventScroll: true }));
        }}
      >
        <div className="flex max-h-[min(90vh,26rem)] flex-col overflow-hidden">
          <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-2 pb-2 pt-1.5">
            <MagnifyingGlass
              weight="regular"
              className="pointer-events-none h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightIndex(0);
              }}
              placeholder="Search armor sets..."
              aria-label="Search armor sets"
              className={cn(
                "h-8 w-full min-w-0 bg-transparent px-2 py-0 text-sm text-foreground caret-foreground outline-none placeholder:text-muted-foreground",
                "border-0 border-transparent shadow-none ring-0 focus:border-transparent focus-visible:ring-0 focus:ring-0",
                sharpCorners ? "rounded-none" : "rounded-md",
              )}
              onKeyDown={(e) => {
                if (!displayedOptions.length) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlightIndex((i) =>
                    Math.min(i + 1, displayedOptions.length - 1),
                  );
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlightIndex((i) => Math.max(i - 1, 0));
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  const picked = displayedOptions[focusedIndex];
                  if (picked) select(String(picked.hash));
                }
                if (e.key === "Home") {
                  e.preventDefault();
                  setHighlightIndex(0);
                }
                if (e.key === "End") {
                  e.preventDefault();
                  setHighlightIndex(displayedOptions.length - 1);
                }
              }}
            />
            {query.length > 0 ? (
              <SearchClearButton
                onClear={() => {
                  setQuery("");
                  setHighlightIndex(0);
                  searchRef.current?.focus({ preventScroll: true });
                }}
              />
            ) : null}
          </div>
          <ul
            id={listboxId}
            role="listbox"
            data-skip-canvas-wheel=""
            className="menu-scrollbar max-h-72 min-h-0 touch-pan-y overflow-y-auto overscroll-contain px-0 py-1 motion-reduce:scroll-auto"
          >
            {displayedOptions.length === 0 ? (
              <li className="px-2 py-2.5 text-sm text-muted-foreground">
                {options.length === 0 ? emptyCatalogMessage : "No matches."}
              </li>
            ) : (
              <>
                {sectioned ? <PinnedSectionLabel /> : null}
                {pinned.map((opt, pinIdx) => {
                  const idx = pinIdx;
                  const sel = String(opt.hash) === value;
                  const active = idx === focusedIndex;
                  const isPinned = pinnedSet.has(String(opt.hash));
                  return (
                    <li
                      key={opt.hash}
                      id={`${listboxId}-${opt.hash}`}
                      role="option"
                      aria-selected={sel}
                      className={cn(
                        "group relative flex w-full cursor-pointer select-none items-center rounded-none px-2 py-1.5 pr-16 text-sm text-popover-foreground outline-none transition-colors",
                        active && "bg-accent text-accent-foreground",
                      )}
                      onMouseEnter={() => setHighlightIndex(idx)}
                      onClick={() => select(String(opt.hash))}
                    >
                      <span className="truncate">{opt.name}</span>
                      {sel ? (
                        <span className="pointer-events-none absolute right-9 top-1/2 flex h-3.5 w-3.5 -translate-y-1/2 items-center justify-center">
                          <Check
                            weight="duotone"
                            className={cn(
                              "h-4 w-4 shrink-0",
                              active
                                ? "text-accent-foreground"
                                : "text-popover-foreground",
                            )}
                          />
                        </span>
                      ) : null}
                      {onTogglePin ? (
                        <PinButton
                          pinned={isPinned}
                          name={opt.name}
                          onToggle={() => onTogglePin(String(opt.hash))}
                        />
                      ) : null}
                    </li>
                  );
                })}
                {sectioned ? <PinnedSectionDivider /> : null}
                {unpinned.map((opt, unpinnedIdx) => {
                  const idx = pinned.length + unpinnedIdx;
                  const sel = String(opt.hash) === value;
                  const active = idx === focusedIndex;
                  const isPinned = pinnedSet.has(String(opt.hash));
                  return (
                    <li
                      key={opt.hash}
                      id={`${listboxId}-${opt.hash}`}
                      role="option"
                      aria-selected={sel}
                      className={cn(
                        "group relative flex w-full cursor-pointer select-none items-center rounded-none px-2 py-1.5 text-sm text-popover-foreground outline-none transition-colors",
                        onTogglePin ? "pr-16" : "pr-9",
                        active && "bg-accent text-accent-foreground",
                      )}
                      onMouseEnter={() => setHighlightIndex(idx)}
                      onClick={() => select(String(opt.hash))}
                    >
                      <span className="truncate">{opt.name}</span>
                      {sel ? (
                        <span
                          className={cn(
                            "pointer-events-none absolute top-1/2 flex h-3.5 w-3.5 -translate-y-1/2 items-center justify-center",
                            onTogglePin ? "right-9" : "right-2",
                          )}
                        >
                          <Check
                            weight="duotone"
                            className={cn(
                              "h-4 w-4 shrink-0",
                              active
                                ? "text-accent-foreground"
                                : "text-popover-foreground",
                            )}
                          />
                        </span>
                      ) : null}
                      {onTogglePin ? (
                        <PinButton
                          pinned={isPinned}
                          name={opt.name}
                          onToggle={() => onTogglePin(String(opt.hash))}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </>
            )}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export interface ArmorSetMultiComboboxProps {
  id?: string;
  options: TrackerOptionItem[];
  /** Selected armor set hashes as strings. Empty = no filter (all sets). */
  values: string[];
  onValuesChange: (hashes: string[]) => void;
  disabled?: boolean;
  /** Shown on the trigger when nothing is selected. */
  placeholder?: string;
  emptyCatalogMessage?: string;
  sharpCorners?: boolean;
  /**
   * When set, replaces the default trigger styles entirely (use for themed surfaces
   * e.g. dashboard table filters). Avoids merging with default `TRIGGER_CLASSES`.
   */
  triggerClassName?: string;
  /** Muted summary when {@link values} is empty and {@link triggerClassName} is used. */
  summaryEmptyClassName?: string;
  caretClassName?: string;
  portalContainer?: HTMLElement | null;
  /** See {@link ArmorSetComboboxProps.pinnedHashes}. */
  pinnedHashes?: readonly string[];
  /** See {@link ArmorSetComboboxProps.onTogglePin}. */
  onTogglePin?: (hash: string) => void;
  "aria-label"?: string;
}

export interface ArmorSetMultiSelectPanelProps {
  /** When provided, used as the listbox element `id` (e.g. combobox `aria-controls`). */
  listboxDomId?: string;
  options: TrackerOptionItem[];
  values: string[];
  onValuesChange: (hashes: string[]) => void;
  emptyCatalogMessage?: string;
  sharpCorners?: boolean;
  pinnedHashes?: readonly string[];
  onTogglePin?: (hash: string) => void;
  /** Outer wrapper (`flex` column + max-height). */
  className?: string;
  /**
   * Focus the armor-set search field after mount (e.g. popover or submenu
   * opened). Pass the parent `open` flag so focusing runs when it becomes true.
   */
  autoFocusSearch?: boolean;
}

/**
 * List + search shell shared by {@link ArmorSetMultiCombobox} and nested filter
 * UIs (e.g. dashboard inventory mega-menu).
 */
export function ArmorSetMultiSelectPanel({
  listboxDomId,
  options,
  values,
  onValuesChange,
  emptyCatalogMessage = "No sets available — sync the manifest first.",
  sharpCorners = false,
  pinnedHashes,
  onTogglePin,
  className,
  autoFocusSearch = false,
}: ArmorSetMultiSelectPanelProps) {
  const autoListboxId = useId();
  const listboxId = listboxDomId ?? autoListboxId;
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);

  const valueSet = useMemo(() => new Set(values), [values]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q.length) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const { pinned, unpinned, sectioned } = useMemo(
    () => partitionByPin(filtered, pinnedHashes, query),
    [filtered, pinnedHashes, query],
  );
  const displayedOptions = useMemo(
    () => [...pinned, ...unpinned],
    [pinned, unpinned],
  );

  const pinnedSet = useMemo(
    () => new Set(pinnedHashes ?? []),
    [pinnedHashes],
  );

  useLayoutEffect(() => {
    if (!autoFocusSearch) return;
    queueMicrotask(() => searchRef.current?.focus({ preventScroll: true }));
  }, [autoFocusSearch]);

  function toggle(hashStr: string) {
    const next = valueSet.has(hashStr)
      ? values.filter((h) => h !== hashStr)
      : [...values, hashStr];
    onValuesChange(next);
  }

  const focusedIndex =
    displayedOptions.length === 0
      ? 0
      : Math.min(Math.max(0, highlightIndex), displayedOptions.length - 1);

  return (
    <div
      className={cn(
        "flex max-h-[min(90vh,26rem)] flex-col overflow-hidden",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-2 pb-2 pt-1.5">
        <MagnifyingGlass
          weight="regular"
          className="pointer-events-none h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlightIndex(0);
          }}
          placeholder="Search armor sets..."
          aria-label="Search armor sets"
          className={cn(
            "h-8 w-full min-w-0 bg-transparent px-2 py-0 text-sm text-foreground caret-foreground outline-none placeholder:text-muted-foreground",
            "border-0 border-transparent shadow-none ring-0 focus:border-transparent focus-visible:ring-0 focus:ring-0",
            sharpCorners ? "rounded-none" : "rounded-md",
          )}
          onKeyDown={(e) => {
            if (!displayedOptions.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlightIndex((i) =>
                Math.min(i + 1, displayedOptions.length - 1),
              );
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlightIndex((i) => Math.max(i - 1, 0));
            }
            if (e.key === "Enter") {
              e.preventDefault();
              const picked = displayedOptions[focusedIndex];
              if (picked) toggle(String(picked.hash));
            }
            if (e.key === "Home") {
              e.preventDefault();
              setHighlightIndex(0);
            }
            if (e.key === "End") {
              e.preventDefault();
              setHighlightIndex(displayedOptions.length - 1);
            }
          }}
        />
        {query.length > 0 ? (
          <SearchClearButton
            onClear={() => {
              setQuery("");
              setHighlightIndex(0);
              searchRef.current?.focus({ preventScroll: true });
            }}
          />
        ) : null}
      </div>
      <ul
        id={listboxId}
        role="listbox"
        aria-multiselectable
        data-skip-canvas-wheel=""
        className="menu-scrollbar max-h-72 min-h-0 touch-pan-y overflow-y-auto overscroll-contain px-0 py-1 motion-reduce:scroll-auto"
      >
        {displayedOptions.length === 0 ? (
          <li className="px-2 py-2.5 text-sm text-muted-foreground">
            {options.length === 0 ? emptyCatalogMessage : "No matches."}
          </li>
        ) : (
          <>
            {sectioned ? <PinnedSectionLabel /> : null}
            {pinned.map((opt, pinIdx) => {
              const idx = pinIdx;
              const sel = valueSet.has(String(opt.hash));
              const active = idx === focusedIndex;
              const isPinned = pinnedSet.has(String(opt.hash));
              return (
                <li
                  key={opt.hash}
                  id={`${listboxId}-${opt.hash}`}
                  role="option"
                  aria-selected={sel}
                  className={cn(
                    "group relative flex w-full cursor-pointer select-none items-center rounded-none py-1.5 pl-8 pr-9 text-sm text-popover-foreground outline-none transition-colors",
                    active && "bg-accent text-accent-foreground",
                  )}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  onClick={() => toggle(String(opt.hash))}
                >
                  <ListboxCheckboxIndicator checked={sel} />
                  <span className="truncate">{opt.name}</span>
                  {onTogglePin ? (
                    <PinButton
                      pinned={isPinned}
                      name={opt.name}
                      onToggle={() => onTogglePin(String(opt.hash))}
                    />
                  ) : null}
                </li>
              );
            })}
            {sectioned ? <PinnedSectionDivider /> : null}
            {unpinned.map((opt, unpinnedIdx) => {
              const idx = pinned.length + unpinnedIdx;
              const sel = valueSet.has(String(opt.hash));
              const active = idx === focusedIndex;
              const isPinned = pinnedSet.has(String(opt.hash));
              return (
                <li
                  key={opt.hash}
                  id={`${listboxId}-${opt.hash}`}
                  role="option"
                  aria-selected={sel}
                  className={cn(
                    "group relative flex w-full cursor-pointer select-none items-center rounded-none py-1.5 pl-8 text-sm text-popover-foreground outline-none transition-colors",
                    onTogglePin ? "pr-9" : "pr-2",
                    active && "bg-accent text-accent-foreground",
                  )}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  onClick={() => toggle(String(opt.hash))}
                >
                  <ListboxCheckboxIndicator checked={sel} />
                  <span className="truncate">{opt.name}</span>
                  {onTogglePin ? (
                    <PinButton
                      pinned={isPinned}
                      name={opt.name}
                      onToggle={() => onTogglePin(String(opt.hash))}
                    />
                  ) : null}
                </li>
              );
            })}
          </>
        )}
      </ul>
    </div>
  );
}

function armorSetMultiSummary(
  values: string[],
  options: TrackerOptionItem[],
  placeholder: string,
): string {
  if (values.length === 0) return placeholder;
  const names = values
    .map((v) => options.find((o) => String(o.hash) === v)?.name)
    .filter((n): n is string => Boolean(n));
  if (names.length === 0) return placeholder;
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]}, ${names[1]}`;
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

export function ArmorSetMultiCombobox({
  id,
  options,
  values,
  onValuesChange,
  disabled,
  placeholder = "All armor sets",
  emptyCatalogMessage = "No sets available — sync the manifest first.",
  sharpCorners = false,
  triggerClassName,
  summaryEmptyClassName,
  caretClassName,
  portalContainer,
  pinnedHashes,
  onTogglePin,
  "aria-label": ariaLabel,
}: ArmorSetMultiComboboxProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxStableId = useId();
  const [open, setOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState<number | undefined>();

  const summary = armorSetMultiSummary(values, options, placeholder);

  useLayoutEffect(() => {
    if (open && triggerRef.current)
      setPanelWidth(triggerRef.current.offsetWidth);
  }, [open]);

  function closeAndReset(nextOpen: boolean) {
    setOpen(nextOpen);
  }

  return (
    <Popover open={open} onOpenChange={closeAndReset}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? listboxStableId : undefined}
          aria-label={ariaLabel}
          disabled={disabled}
          className={
            triggerClassName !== undefined
              ? triggerClassName
              : cn(TRIGGER_CLASSES, sharpCorners && "rounded-none")
          }
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              values.length === 0 &&
                (summaryEmptyClassName ?? "text-muted-foreground"),
            )}
          >
            {summary}
          </span>
          <CaretDown
            weight="duotone"
            aria-hidden
            className={cn(
              "h-4 w-4 shrink-0 transition-transform",
              open && "rotate-180",
              caretClassName ?? "opacity-50",
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        container={portalContainer}
        data-skip-canvas-wheel=""
        className={cn(
          "z-[90] flex flex-col overflow-hidden border border-border bg-popover p-0 text-popover-foreground shadow-xl outline-none",
          sharpCorners ? "rounded-none" : "rounded-lg",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:duration-150",
        )}
        style={panelWidth ? { width: panelWidth } : undefined}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          /* Search focus is delegated to ArmorSetMultiSelectPanel. */
        }}
      >
        <ArmorSetMultiSelectPanel
          listboxDomId={listboxStableId}
          options={options}
          values={values}
          onValuesChange={onValuesChange}
          emptyCatalogMessage={emptyCatalogMessage}
          sharpCorners={sharpCorners}
          pinnedHashes={pinnedHashes}
          onTogglePin={onTogglePin}
          autoFocusSearch={open}
        />
      </PopoverContent>
    </Popover>
  );
}
