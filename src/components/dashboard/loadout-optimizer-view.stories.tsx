import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, waitFor, within } from "storybook/test";

import {
  MOCK_OPTIMIZER_INVENTORY,
  MOCK_INVENTORY,
} from "../../../.storybook/mocks/armor-pieces";
import { MOCK_GRID_FILTERS_EMPTY } from "../../../.storybook/mocks/grid-filters";
import type { GridFiltersJson } from "@/lib/workspace/grid-filters-schema";
import { MOCK_OPTIMIZER_LOOKUP } from "../../../.storybook/mocks/optimizer-lookup";
import { MOCK_GRID_LOOKUP_PAYLOAD } from "../../../.storybook/mocks/grid-lookup";
import { MOCK_WORKSPACE_HEALTH_LOADED } from "../../../.storybook/mocks/workspace-health";
import { WorkspaceSyncProvider } from "./workspace-sync-status";

import { LoadoutOptimizerView } from "./loadout-optimizer-view";

const meta: Meta<typeof LoadoutOptimizerView> = {
  title: "Dashboard/LoadoutOptimizerView",
  component: LoadoutOptimizerView,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <WorkspaceSyncProvider health={MOCK_WORKSPACE_HEALTH_LOADED}>
        <Story />
      </WorkspaceSyncProvider>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof LoadoutOptimizerView>;

function OptimizerShell({
  inventory = MOCK_OPTIMIZER_INVENTORY,
}: {
  inventory?: typeof MOCK_OPTIMIZER_INVENTORY;
}) {
  const [filters, setFilters] = useState(MOCK_GRID_FILTERS_EMPTY);
  return (
    <div className="flex h-[80vh] flex-col bg-background">
      <LoadoutOptimizerView
        hasInventory
        inventory={inventory}
        syncWarning={null}
        filters={filters}
        onFiltersChange={setFilters}
        optimizerLookup={MOCK_OPTIMIZER_LOOKUP}
        statIconByName={MOCK_GRID_LOOKUP_PAYLOAD.statIconByName}
      />
    </div>
  );
}

export const Ready: Story = {
  render: () => <OptimizerShell />,
};

export const GeneratesBuilds: Story = {
  render: () => <OptimizerShell />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const weaponsSlider = await canvas.findByRole("slider", {
      name: /weapons minimum/i,
    });
    fireEvent.input(weaponsSlider, { target: { value: "100" } });
    await waitFor(() =>
      expect(weaponsSlider).toHaveAttribute("aria-valuenow", "100"),
    );
  },
};

export const WithFullMockInventory: Story = {
  render: () => <OptimizerShell inventory={MOCK_INVENTORY} />,
};

export const WithWarlockSubclass: Story = {
  render: () => {
    const [filters, setFilters] = useState<GridFiltersJson>({
      ...MOCK_GRID_FILTERS_EMPTY,
      class: 2,
    });
    return (
      <div className="flex h-[80vh] flex-col bg-background">
        <LoadoutOptimizerView
          hasInventory
          inventory={MOCK_OPTIMIZER_INVENTORY}
          syncWarning={null}
          filters={filters}
          onFiltersChange={setFilters}
          optimizerLookup={MOCK_OPTIMIZER_LOOKUP}
          statIconByName={MOCK_GRID_LOOKUP_PAYLOAD.statIconByName}
        />
      </div>
    );
  },
};
