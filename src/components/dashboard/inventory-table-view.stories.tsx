import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  EMPTY_INVENTORY,
  MOCK_INVENTORY,
} from "../../../.storybook/mocks/armor-pieces";
import { MOCK_GRID_FILTERS_EMPTY } from "../../../.storybook/mocks/grid-filters";
import { MOCK_TRACKER_FORM_SELECTORS } from "../../../.storybook/mocks/tracker-options";
import {
  MOCK_WORKSPACE_HEALTH_EMPTY_CACHE,
  MOCK_WORKSPACE_HEALTH_LOADED,
  MOCK_WORKSPACE_HEALTH_NO_CACHE,
  MOCK_WORKSPACE_HEALTH_NO_MANIFEST,
} from "../../../.storybook/mocks/workspace-health";
import { WorkspaceSyncProvider } from "./workspace-sync-status";

import { InventoryTableView } from "./inventory-table-view";

const meta: Meta<typeof InventoryTableView> = {
  title: "Dashboard/InventoryTableView",
  component: InventoryTableView,
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

type Story = StoryObj<typeof InventoryTableView>;

function LoadedShell() {
  const [filters, setFilters] = useState(MOCK_GRID_FILTERS_EMPTY);
  return (
    <div className="flex h-[80vh] flex-col bg-background">
      <InventoryTableView
        hasInventory
        inventory={MOCK_INVENTORY}
        selectors={MOCK_TRACKER_FORM_SELECTORS}
        syncWarning={null}
        filters={filters}
        onFiltersChange={setFilters}
      />
    </div>
  );
}

function NoInventoryShell() {
  const [filters, setFilters] = useState(MOCK_GRID_FILTERS_EMPTY);
  return (
    <div className="flex h-[80vh] flex-col bg-background">
      <InventoryTableView
        hasInventory={false}
        inventory={EMPTY_INVENTORY}
        selectors={MOCK_TRACKER_FORM_SELECTORS}
        syncWarning={null}
        filters={filters}
        onFiltersChange={setFilters}
      />
    </div>
  );
}

function SyncWarningShell() {
  const [filters, setFilters] = useState(MOCK_GRID_FILTERS_EMPTY);
  return (
    <div className="flex h-[80vh] flex-col bg-background">
      <InventoryTableView
        hasInventory
        inventory={MOCK_INVENTORY}
        selectors={MOCK_TRACKER_FORM_SELECTORS}
        syncWarning="Bungie returned only equipped items. Re-grant the inventory scope."
        filters={filters}
        onFiltersChange={setFilters}
      />
    </div>
  );
}

export const Loaded: Story = {
  render: LoadedShell,
  parameters: { workspaceHealth: MOCK_WORKSPACE_HEALTH_LOADED },
};

export const NoInventory: Story = {
  render: NoInventoryShell,
  parameters: { workspaceHealth: MOCK_WORKSPACE_HEALTH_NO_CACHE },
};

export const SyncWarning: Story = {
  render: SyncWarningShell,
  parameters: { workspaceHealth: MOCK_WORKSPACE_HEALTH_LOADED },
};

export const ManifestNotReady: Story = {
  render: NoInventoryShell,
  parameters: { workspaceHealth: MOCK_WORKSPACE_HEALTH_NO_MANIFEST },
};

export const EmptyInventoryCache: Story = {
  render: () => {
    const [filters, setFilters] = useState(MOCK_GRID_FILTERS_EMPTY);
    return (
      <div className="flex h-[80vh] flex-col bg-background">
        <InventoryTableView
          hasInventory
          inventory={EMPTY_INVENTORY}
          selectors={MOCK_TRACKER_FORM_SELECTORS}
          syncWarning={null}
          filters={filters}
          onFiltersChange={setFilters}
        />
      </div>
    );
  },
  parameters: { workspaceHealth: MOCK_WORKSPACE_HEALTH_EMPTY_CACHE },
};
