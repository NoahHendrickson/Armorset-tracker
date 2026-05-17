import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { GridWorkspace } from "./grid-workspace";
import { MOCK_TRACKER_FORM_SELECTORS } from "../../../.storybook/mocks/tracker-options";
import { MOCK_GRID_LOOKUP_PAYLOAD } from "../../../.storybook/mocks/grid-lookup";
import {
  MOCK_GRID_FILTERS_EMPTY,
  MOCK_GRID_FILTERS_POPULATED,
} from "../../../.storybook/mocks/grid-filters";

const meta: Meta<typeof GridWorkspace> = {
  title: "Workspace/GridWorkspace",
  component: GridWorkspace,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof GridWorkspace>;

function EmptyStory() {
  const [filters, setFilters] = useState(MOCK_GRID_FILTERS_EMPTY);
  return (
    <div style={{ height: "100vh" }}>
      <GridWorkspace
        banners={null}
        syncWarning={null}
        hasInventory={false}
        selectors={MOCK_TRACKER_FORM_SELECTORS}
        inventory={[]}
        lookupPayload={MOCK_GRID_LOOKUP_PAYLOAD}
        filters={filters}
        onFiltersChange={setFilters}
      />
    </div>
  );
}

function PopulatedStory() {
  const [filters, setFilters] = useState(MOCK_GRID_FILTERS_POPULATED);
  return (
    <div style={{ height: "100vh" }}>
      <GridWorkspace
        banners={null}
        syncWarning={null}
        hasInventory={false}
        selectors={MOCK_TRACKER_FORM_SELECTORS}
        inventory={[]}
        lookupPayload={MOCK_GRID_LOOKUP_PAYLOAD}
        filters={filters}
        onFiltersChange={setFilters}
      />
    </div>
  );
}

export const EmptyState: Story = {
  render: EmptyStory,
};

export const PopulatedFilters: Story = {
  render: PopulatedStory,
};
