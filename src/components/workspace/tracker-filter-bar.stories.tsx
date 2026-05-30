import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { TrackerFilterBar } from "./tracker-filter-bar";
import { MOCK_TRACKER_FORM_SELECTORS } from "../../../.storybook/mocks/tracker-options";
import {
  MOCK_GRID_FILTERS_EMPTY,
  MOCK_GRID_FILTERS_POPULATED,
} from "../../../.storybook/mocks/grid-filters";
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
  width = 960,
}: {
  initial: GridFiltersJson;
  showTertiaryStatFilter?: boolean;
  showRarityFilter?: boolean;
  width?: number;
}) {
  const [value, setValue] = useState<GridFiltersJson>(initial);
  return (
    <div className="border border-border bg-card px-3" style={{ width }}>
      <TrackerFilterBar
        selectors={MOCK_TRACKER_FORM_SELECTORS}
        value={value}
        onChange={setValue}
        pinnedHashes={[]}
        onTogglePin={() => {}}
        resultCount={42}
        resultNoun={{ singular: "tracker", plural: "trackers" }}
        showTertiaryStatFilter={showTertiaryStatFilter}
        showRarityFilter={showRarityFilter}
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

/** ≥72rem — all filters inline. */
export const WideAllInline: Story = {
  render: () => <Render initial={MOCK_GRID_FILTERS_POPULATED} width={1200} />,
};

/** 64–72rem — tunings/tertiary in More; sets & archetypes stay inline. */
export const MidMoreOverflow: Story = {
  render: () => (
    <Render initial={MOCK_GRID_FILTERS_POPULATED} width={1080} showRarityFilter />
  ),
};

/** 56–64rem — archetypes join More; sets/rarity stay inline. */
export const MidMoreWithArchetypes: Story = {
  render: () => (
    <Render initial={MOCK_GRID_FILTERS_POPULATED} width={960} showRarityFilter />
  ),
};

/** <56rem — everything in Filters menu. */
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
