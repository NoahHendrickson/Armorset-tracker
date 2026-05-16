import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  EMPTY_INVENTORY,
  MOCK_INVENTORY,
} from "../../../.storybook/mocks/armor-pieces";
import { MOCK_TRACKER_FORM_SELECTORS } from "../../../.storybook/mocks/tracker-options";

import { InventoryTableView } from "./inventory-table-view";

const meta: Meta<typeof InventoryTableView> = {
  title: "Dashboard/InventoryTableView",
  component: InventoryTableView,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof InventoryTableView>;

export const Loaded: Story = {
  render: () => (
    <div className="flex h-[80vh] flex-col bg-background">
      <InventoryTableView
        hasInventory
        inventory={MOCK_INVENTORY}
        selectors={MOCK_TRACKER_FORM_SELECTORS}
        syncWarning={null}
      />
    </div>
  ),
};

export const NoInventory: Story = {
  render: () => (
    <div className="flex h-[80vh] flex-col bg-background">
      <InventoryTableView
        hasInventory={false}
        inventory={EMPTY_INVENTORY}
        selectors={MOCK_TRACKER_FORM_SELECTORS}
        syncWarning={null}
      />
    </div>
  ),
};

export const SyncWarning: Story = {
  render: () => (
    <div className="flex h-[80vh] flex-col bg-background">
      <InventoryTableView
        hasInventory
        inventory={MOCK_INVENTORY}
        selectors={MOCK_TRACKER_FORM_SELECTORS}
        syncWarning="Bungie returned only equipped items. Re-grant the inventory scope."
      />
    </div>
  ),
};
