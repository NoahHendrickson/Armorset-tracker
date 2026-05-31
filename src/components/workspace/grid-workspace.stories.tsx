import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { GridWorkspace } from "./grid-workspace";
import { MOCK_TRACKER_FORM_SELECTORS } from "../../../.storybook/mocks/tracker-options";
import { MOCK_GRID_LOOKUP_PAYLOAD } from "../../../.storybook/mocks/grid-lookup";
import {
  MOCK_GRID_FILTERS_EMPTY,
  MOCK_GRID_FILTERS_POPULATED,
} from "../../../.storybook/mocks/grid-filters";
import {
  MOCK_WORKSPACE_HEALTH_LOADED,
  MOCK_WORKSPACE_HEALTH_NO_MANIFEST,
} from "../../../.storybook/mocks/workspace-health";
import { WorkspaceSyncProvider } from "@/components/dashboard/workspace-sync-status";

const meta: Meta<typeof GridWorkspace> = {
  title: "Workspace/GridWorkspace",
  component: GridWorkspace,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story, ctx) => (
      <WorkspaceSyncProvider
        health={
          (ctx.parameters.workspaceHealth as typeof MOCK_WORKSPACE_HEALTH_LOADED) ??
          MOCK_WORKSPACE_HEALTH_LOADED
        }
      >
        <Story />
      </WorkspaceSyncProvider>
    ),
  ],
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
  parameters: { workspaceHealth: MOCK_WORKSPACE_HEALTH_LOADED },
};

export const PopulatedFilters: Story = {
  render: PopulatedStory,
  parameters: { workspaceHealth: MOCK_WORKSPACE_HEALTH_LOADED },
};

export const ManifestNotReady: Story = {
  render: EmptyStory,
  parameters: { workspaceHealth: MOCK_WORKSPACE_HEALTH_NO_MANIFEST },
};
