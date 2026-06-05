import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { TrackerFilterBar } from "./tracker-filter-bar";
import { MOCK_TRACKER_FORM_SELECTORS } from "../../../.storybook/mocks/tracker-options";
import {
  MOCK_GRID_FILTERS_EMPTY,
  MOCK_GRID_FILTERS_POPULATED,
} from "../../../.storybook/mocks/grid-filters";
import {
  MOCK_SAVED_FILTER_VIEW_OWNED,
  MOCK_SAVED_FILTER_VIEW_SHARED,
} from "../../../.storybook/mocks/saved-filter-views";
import type { SavedViewsBarProps } from "./saved-views-menu";
import type { GridFiltersJson } from "@/lib/workspace/grid-filters-schema";

const meta: Meta<typeof TrackerFilterBar> = {
  title: "Workspace/TrackerFilterBar",
  component: TrackerFilterBar,
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof TrackerFilterBar>;

function Render({
  initial,
  showTertiaryStatFilter = true,
  showRarityFilter = false,
  searchPlacement,
  searchDefaultExpanded,
  embedClassInSearch,
  withSavedViews = true,
  width = 960,
}: {
  initial: GridFiltersJson;
  showTertiaryStatFilter?: boolean;
  showRarityFilter?: boolean;
  searchPlacement?: "start" | "end";
  searchDefaultExpanded?: boolean;
  embedClassInSearch?: boolean;
  withSavedViews?: boolean;
  width?: number;
}) {
  const [value, setValue] = useState<GridFiltersJson>(initial);
  const [views, setViews] = useState([
    MOCK_SAVED_FILTER_VIEW_OWNED,
    MOCK_SAVED_FILTER_VIEW_SHARED,
  ]);
  const savedViews: SavedViewsBarProps | undefined = withSavedViews
    ? {
        views,
        activeViewId: null,
        filters: value,
        onViewsChange: setViews,
        onApply: () => {},
        onClearActive: () => {},
      }
    : undefined;
  return (
    <div className="border border-border bg-card px-3" style={{ width }}>
      <TrackerFilterBar
        selectors={MOCK_TRACKER_FORM_SELECTORS}
        value={value}
        onChange={setValue}
        pinnedHashes={[]}
        onTogglePin={() => {}}
        showTertiaryStatFilter={showTertiaryStatFilter}
        showRarityFilter={showRarityFilter}
        searchPlacement={searchPlacement}
        searchDefaultExpanded={searchDefaultExpanded}
        embedClassInSearch={embedClassInSearch}
        savedViews={savedViews}
      />
    </div>
  );
}

export const EmptyFilters: Story = {
  render: () => <Render initial={MOCK_GRID_FILTERS_EMPTY} width={1200} />,
};

export const PopulatedFilters: Story = {
  render: () => <Render initial={MOCK_GRID_FILTERS_POPULATED} width={1200} />,
};

export const TrackerGridNoTertiaryMenu: Story = {
  render: () => (
    <Render
      initial={MOCK_GRID_FILTERS_POPULATED}
      showTertiaryStatFilter={false}
      width={1200}
    />
  ),
};

/** ≥60rem — all filters inline (typical dashboard filter bar width). */
export const WideAllInline: Story = {
  render: () => <Render initial={MOCK_GRID_FILTERS_POPULATED} width={1060} />,
};

/** 52–60rem — tertiary/tunings in More; sets & archetypes stay inline. */
export const MidMoreOverflow: Story = {
  render: () => (
    <Render initial={MOCK_GRID_FILTERS_POPULATED} width={880} showRarityFilter />
  ),
};

/** 44–52rem — archetypes join More; sets/rarity stay inline. */
export const MidMoreWithArchetypes: Story = {
  render: () => (
    <Render initial={MOCK_GRID_FILTERS_POPULATED} width={760} showRarityFilter />
  ),
};

/** <44rem — everything in Filters menu. */
export const NarrowFullFilters: Story = {
  render: () => (
    <Render initial={MOCK_GRID_FILTERS_POPULATED} width={480} showRarityFilter />
  ),
};

export const InventoryTableWithRarity: Story = {
  render: () => (
    <Render initial={MOCK_GRID_FILTERS_POPULATED} showRarityFilter width={1200} />
  ),
};

/** Table view: class icons embedded in search; F focuses search. */
export const InventoryTableSearchPrimary: Story = {
  render: () => (
    <Render
      initial={MOCK_GRID_FILTERS_EMPTY}
      showRarityFilter
      searchPlacement="start"
      searchDefaultExpanded
      embedClassInSearch
      width={1200}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.keyboard("f");
    const search = await canvas.findByRole("searchbox", {
      name: /search armor sets/i,
    });
    await expect(search).toHaveFocus();
  },
};
