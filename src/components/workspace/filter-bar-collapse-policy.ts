import type { GridFiltersJson } from "@/lib/workspace/grid-filters-schema";
import type { SavedViewsBarProps } from "@/components/workspace/saved-views-menu";

/**
 * Single source of truth for filter-bar collapse breakpoints (rem).
 * Must stay in sync with container-query classes in filter-bar-primitives.tsx.
 */
export const FILTER_BAR_COLLAPSE_BREAKPOINTS_REM = {
  fullInline: 72,
  moreTunings: 64,
  moreAll: 56,
} as const;

export type FilterBarCollapseTier =
  | "full-inline"
  | "more-tunings"
  | "more-all"
  | "filters-menu";

export type MoreMenuDimension = "archetypes" | "tunings" | "tertiary";

/** Dimensions shown inside the mid-width "More" menu per tier (portaled — needs JS). */
export const MORE_MENU_DIMENSIONS: Record<
  FilterBarCollapseTier,
  readonly MoreMenuDimension[]
> = {
  "full-inline": [],
  "more-tunings": ["tunings", "tertiary"],
  "more-all": ["archetypes", "tunings", "tertiary"],
  "filters-menu": [],
};

export function tierIncludesMoreMenuDimension(
  tier: FilterBarCollapseTier,
  dimension: MoreMenuDimension,
): boolean {
  return MORE_MENU_DIMENSIONS[tier].includes(dimension);
}

export function getFilterBarCollapseTier(widthPx: number): FilterBarCollapseTier {
  const rootFontSize =
    typeof document !== "undefined"
      ? Number.parseFloat(getComputedStyle(document.documentElement).fontSize) ||
        16
      : 16;

  const widthRem = widthPx / rootFontSize;
  const bp = FILTER_BAR_COLLAPSE_BREAKPOINTS_REM;

  if (widthRem >= bp.fullInline) return "full-inline";
  if (widthRem >= bp.moreTunings) return "more-tunings";
  if (widthRem >= bp.moreAll) return "more-all";
  return "filters-menu";
}

export function countMoreMenuSelections(
  tier: FilterBarCollapseTier,
  value: Pick<GridFiltersJson, "archetypeHashes" | "tuningHashes" | "tertiaryStats">,
  showTertiaryStatFilter: boolean,
): number {
  let count = 0;
  for (const dimension of MORE_MENU_DIMENSIONS[tier]) {
    if (dimension === "archetypes") count += value.archetypeHashes.length;
    if (dimension === "tunings") count += value.tuningHashes.length;
    if (dimension === "tertiary" && showTertiaryStatFilter) {
      count += value.tertiaryStats.length;
    }
  }
  return count;
}

export function countFullFiltersSelections(
  value: GridFiltersJson,
  options: {
    showTertiaryStatFilter: boolean;
    showRarityFilter: boolean;
    savedViews?: SavedViewsBarProps;
  },
): number {
  let count =
    value.setHashes.length +
    value.archetypeHashes.length +
    value.tuningHashes.length;
  if (options.showTertiaryStatFilter) {
    count += value.tertiaryStats.length;
  }
  if (options.showRarityFilter && value.rarity !== "legendary") count += 1;
  if (options.savedViews?.activeViewId) count += 1;
  return count;
}
