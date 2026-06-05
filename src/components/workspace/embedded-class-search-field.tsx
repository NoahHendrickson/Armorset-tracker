"use client";

import type { ChangeEvent, KeyboardEvent, Ref } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react/dist/ssr";
import type { GridFilterClass } from "@/lib/workspace/grid-filters-schema";
import { cn } from "@/lib/utils";
import {
  ClassSwitcher,
  EMBEDDED_SEARCH_ACTIVE_FILL,
  EMBEDDED_SEARCH_CLASS,
} from "@/components/workspace/class-switcher";

export interface EmbeddedClassSearchFieldProps {
  search: string;
  onSearchChange: (next: string) => void;
  classValue: GridFilterClass;
  onClassChange: (next: GridFilterClass) => void;
  placeholder?: string;
  searchInputRef?: Ref<HTMLInputElement>;
  onSearchBlur?: () => void;
  onSearchKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
}

/** Table inventory search + condensed {@link ClassSwitcher}. */
export function EmbeddedClassSearchField({
  search,
  onSearchChange,
  classValue,
  onClassChange,
  placeholder = "Press F to search",
  searchInputRef,
  onSearchBlur,
  onSearchKeyDown,
  className,
}: EmbeddedClassSearchFieldProps) {
  const shellActive = search.trim().length > 0;

  return (
    <div
      role="search"
      className={cn(
        "relative flex h-9 min-w-0 items-stretch overflow-hidden",
        "w-80 border border-border sm:w-96 lg:w-[26rem]",
        "focus-within:outline-none",
        EMBEDDED_SEARCH_CLASS,
        "focus-within:bg-background/80 dark:focus-within:bg-accent/80",
        shellActive && EMBEDDED_SEARCH_ACTIVE_FILL,
        className,
      )}
    >
      <div className="relative flex min-w-0 flex-1 items-center gap-1 ps-8 pe-2">
        <MagnifyingGlass
          weight="regular"
          className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/35"
          aria-hidden
        />
        <input
          ref={searchInputRef}
          type="search"
          value={search}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onSearchChange(e.target.value)
          }
          onBlur={onSearchBlur}
          onKeyDown={onSearchKeyDown}
          placeholder={placeholder}
          aria-label="Search armor sets"
          className="h-full min-w-0 flex-1 border-0 bg-transparent py-0 text-xs shadow-none outline-none placeholder:text-foreground/35 focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-search-cancel-button]:hidden"
        />
        {search ? (
          <button
            type="button"
            aria-label="Clear search"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => onSearchChange("")}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-none text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <X weight="bold" className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      <ClassSwitcher
        variant="condensed"
        value={classValue}
        onChange={onClassChange}
      />
    </div>
  );
}
