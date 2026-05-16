import {
  defaultGridFilters,
  type GridFiltersJson,
} from "@/lib/workspace/grid-filters-schema";

export const MOCK_GRID_FILTERS_EMPTY: GridFiltersJson = defaultGridFilters();

export const MOCK_GRID_FILTERS_POPULATED: GridFiltersJson = {
  version: 1,
  class: 0,
  setHashes: [1001],
  archetypeHashes: [2005],
  tuningHashes: [],
  tertiaryStats: ["Health"],
  search: "",
};
