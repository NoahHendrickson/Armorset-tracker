"use client";

import { Check, PushPin, X } from "@phosphor-icons/react/dist/ssr";
import {
  checkboxBoxClassName,
  checkboxIconClassName,
} from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export const ARMOR_SET_TRIGGER_CLASSES =
  "flex h-9 w-full items-center justify-between gap-2 text-left whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1";

/**
 * Splits options into pinned (in pin order) and unpinned (catalog order).
 * When `query` is non-empty, pinned section is suppressed.
 */
export function partitionByPin<T extends { hash: number | string }>(
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

export function PinButton({
  pinned,
  name,
  onToggle,
}: {
  pinned: boolean;
  name: string;
  onToggle: () => void;
}) {
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

export function PinnedSectionLabel() {
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

export function PinnedSectionDivider() {
  return (
    <li
      role="presentation"
      aria-hidden
      className="mx-2 mb-1 mt-1 border-t border-border"
    />
  );
}

/** Matches {@link DropdownMenuCheckboxItem} indicator styling in filter menus. */
export function ListboxCheckboxIndicator({ checked }: { checked: boolean }) {
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

export function SearchClearButton({ onClear }: { onClear: () => void }) {
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

export function armorSetMultiSummary(
  values: string[],
  options: { hash: number | string; name: string }[],
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
