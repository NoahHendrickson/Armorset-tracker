"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CaretDown, Check, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { TrackerOptionItem } from "@/lib/views/tracker-option";
import {
  ARMOR_SET_TRIGGER_CLASSES,
  partitionByPin,
  PinButton,
  PinnedSectionDivider,
  PinnedSectionLabel,
  SearchClearButton,
} from "@/components/views/armor-set-listbox";

export {
  ArmorSetMultiCombobox,
  ArmorSetMultiSelectPanel,
  type ArmorSetMultiComboboxProps,
  type ArmorSetMultiSelectPanelProps,
} from "@/components/views/armor-set-multi-select";

interface ArmorSetComboboxProps {
  id?: string;
  options: TrackerOptionItem[];
  value: string;
  onValueChange: (hash: string) => void;
  disabled?: boolean;
  placeholder?: string;
  emptyCatalogMessage?: string;
  sharpCorners?: boolean;
  invalid?: boolean;
  portalContainer?: HTMLElement | null;
  pinnedHashes?: readonly string[];
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
    selectedOption?.name ?? (!value ? "Select an armor set" : "");

  useLayoutEffect(() => {
    if (open && triggerRef.current)
      setPanelWidth(triggerRef.current.offsetWidth);
  }, [open]);

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
            ARMOR_SET_TRIGGER_CLASSES,
            sharpCorners && "rounded-none",
            invalid &&
              "border-2 border-destructive focus-visible:ring-2 focus-visible:ring-destructive/90",
          )}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {!value
              ? (placeholder ?? "Select an armor set")
              : displayLabel || "Unknown set"}
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
