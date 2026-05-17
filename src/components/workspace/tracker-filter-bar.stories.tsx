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
}: {
  initial: GridFiltersJson;
  showTertiaryStatFilter?: boolean;
}) {
  const [value, setValue] = useState<GridFiltersJson>(initial);
  return (
    <div className="border border-border bg-card px-3" style={{ width: 960 }}>
      <TrackerFilterBar
        selectors={MOCK_TRACKER_FORM_SELECTORS}
        value={value}
        onChange={setValue}
        pinnedHashes={[]}
        onTogglePin={() => {}}
        resultCount={42}
        resultNoun={{ singular: "tracker", plural: "trackers" }}
        showTertiaryStatFilter={showTertiaryStatFilter}
      />
    </div>
  );
}

export const EmptyFilters: Story = {
  render: () => <Render initial={MOCK_GRID_FILTERS_EMPTY} />,
};

export const PopulatedFilters: Story = {
  render: () => <Render initial={MOCK_GRID_FILTERS_POPULATED} />,
};

export const TrackerGridNoTertiaryMenu: Story = {
  render: () => (
    <Render initial={MOCK_GRID_FILTERS_POPULATED} showTertiaryStatFilter={false} />
  ),
};
