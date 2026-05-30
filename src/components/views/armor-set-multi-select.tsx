"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CaretDown, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { TrackerOptionItem } from "@/lib/views/tracker-option";
import {
  armorSetMultiSummary,
  ListboxCheckboxIndicator,
  partitionByPin,
  PinButton,
  PinnedSectionDivider,
  PinnedSectionLabel,
  SearchClearButton,
  ARMOR_SET_TRIGGER_CLASSES,
} from "@/components/views/armor-set-listbox";

export interface ArmorSetMultiSelectPanelProps {
  listboxDomId?: string;
  options: TrackerOptionItem[];
  values: string[];
  onValuesChange: (hashes: string[]) => void;
  emptyCatalogMessage?: string;
  sharpCorners?: boolean;
  pinnedHashes?: readonly string[];
  onTogglePin?: (hash: string) => void;
  className?: string;
  autoFocusSearch?: boolean;
}

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

export interface ArmorSetMultiComboboxProps {
  id?: string;
  options: TrackerOptionItem[];
  values: string[];
  onValuesChange: (hashes: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  emptyCatalogMessage?: string;
  sharpCorners?: boolean;
  triggerClassName?: string;
  summaryEmptyClassName?: string;
  caretClassName?: string;
  portalContainer?: HTMLElement | null;
  pinnedHashes?: readonly string[];
  onTogglePin?: (hash: string) => void;
  "aria-label"?: string;
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
              : cn(ARMOR_SET_TRIGGER_CLASSES, sharpCorners && "rounded-none")
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
