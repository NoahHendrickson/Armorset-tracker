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

const TRIGGER_CLASSES =
  "flex h-9 w-full items-center justify-between gap-2 text-left whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1";

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
    filtered.length === 0 ? 0 : Math.min(Math.max(0, highlightIndex), filtered.length - 1);

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
            open && filtered[focusedIndex]
              ? `${listboxId}-${filtered[focusedIndex].hash}`
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
        <div className="flex max-h-[min(90vh,24rem)] flex-col overflow-hidden">
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
                if (!filtered.length) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlightIndex((i) =>
                    Math.min(i + 1, filtered.length - 1),
                  );
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlightIndex((i) => Math.max(i - 1, 0));
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  const picked = filtered[focusedIndex];
                  if (picked) select(String(picked.hash));
                }
                if (e.key === "Home") {
                  e.preventDefault();
                  setHighlightIndex(0);
                }
                if (e.key === "End") {
                  e.preventDefault();
                  setHighlightIndex(filtered.length - 1);
                }
              }}
            />
          </div>
          <ul
            id={listboxId}
            role="listbox"
            data-skip-canvas-wheel=""
            className="max-h-60 min-h-0 touch-pan-y overflow-y-auto overscroll-contain px-0 py-1 motion-reduce:scroll-auto"
          >
            {filtered.length === 0 ? (
            <li className="px-2 py-2.5 text-sm text-muted-foreground">
              {options.length === 0 ? emptyCatalogMessage : "No matches."}
            </li>
          ) : (
            filtered.map((opt, idx) => {
              const sel = String(opt.hash) === value;
              const active = idx === focusedIndex;
              return (
                <li
                  key={opt.hash}
                  id={`${listboxId}-${opt.hash}`}
                  role="option"
                  aria-selected={sel}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center rounded-none px-2 py-1.5 pr-9 text-sm text-popover-foreground outline-none transition-colors",
                    active && "bg-accent text-accent-foreground",
                  )}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  onClick={() => select(String(opt.hash))}
                >
                  <span className="truncate">{opt.name}</span>
                  {sel ? (
                    <span className="pointer-events-none absolute right-2 top-1/2 flex h-3.5 w-3.5 -translate-y-1/2 items-center justify-center">
                      <Check
                        weight="duotone"
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-accent-foreground" : "text-popover-foreground",
                        )}
                      />
                    </span>
                  ) : null}
                </li>
              );
            })
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
  "aria-label"?: string;
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
  "aria-label": ariaLabel,
}: ArmorSetMultiComboboxProps) {
  const listboxId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [panelWidth, setPanelWidth] = useState<number | undefined>();
  const [highlightIndex, setHighlightIndex] = useState(0);

  const valueSet = useMemo(() => new Set(values), [values]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q.length) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const summary = armorSetMultiSummary(values, options, placeholder);

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

  function toggle(hashStr: string) {
    const next = valueSet.has(hashStr)
      ? values.filter((h) => h !== hashStr)
      : [...values, hashStr];
    onValuesChange(next);
  }

  const focusedIndex =
    filtered.length === 0 ? 0 : Math.min(Math.max(0, highlightIndex), filtered.length - 1);

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
          queueMicrotask(() => searchRef.current?.focus({ preventScroll: true }));
        }}
      >
        <div className="flex max-h-[min(90vh,24rem)] flex-col overflow-hidden">
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
                if (!filtered.length) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlightIndex((i) =>
                    Math.min(i + 1, filtered.length - 1),
                  );
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlightIndex((i) => Math.max(i - 1, 0));
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  const picked = filtered[focusedIndex];
                  if (picked) toggle(String(picked.hash));
                }
                if (e.key === "Home") {
                  e.preventDefault();
                  setHighlightIndex(0);
                }
                if (e.key === "End") {
                  e.preventDefault();
                  setHighlightIndex(filtered.length - 1);
                }
              }}
            />
          </div>
          <ul
            id={listboxId}
            role="listbox"
            aria-multiselectable
            data-skip-canvas-wheel=""
            className="max-h-60 min-h-0 touch-pan-y overflow-y-auto overscroll-contain px-0 py-1 motion-reduce:scroll-auto"
          >
            {filtered.length === 0 ? (
              <li className="px-2 py-2.5 text-sm text-muted-foreground">
                {options.length === 0 ? emptyCatalogMessage : "No matches."}
              </li>
            ) : (
              filtered.map((opt, idx) => {
                const sel = valueSet.has(String(opt.hash));
                const active = idx === focusedIndex;
                return (
                  <li
                    key={opt.hash}
                    id={`${listboxId}-${opt.hash}`}
                    role="option"
                    aria-selected={sel}
                    className={cn(
                      "relative flex w-full cursor-pointer select-none items-center rounded-none px-2 py-1.5 pr-9 text-sm text-popover-foreground outline-none transition-colors",
                      active && "bg-accent text-accent-foreground",
                    )}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    onClick={() => toggle(String(opt.hash))}
                  >
                    <span className="truncate">{opt.name}</span>
                    {sel ? (
                      <span className="pointer-events-none absolute right-2 top-1/2 flex h-3.5 w-3.5 -translate-y-1/2 items-center justify-center">
                        <Check
                          weight="duotone"
                          className={cn(
                            "h-4 w-4 shrink-0",
                            active ? "text-accent-foreground" : "text-popover-foreground",
                          )}
                        />
                      </span>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
